/**
 * PII redactor — strips phone numbers, emails, and configured names from text
 * before it leaves the device. Read-once env config:
 *   - DYAD_PARTNER_NAME → redacted to [PARTNER]
 *   - DYAD_USER_NAME    → redacted to [USER]
 */
export interface PIIRedactorOptions {
  partnerName?: string;
  userName?: string;
  extraNames?: string[];
  enabled?: boolean;
}

export class PIIRedactor {
  // International + US: +CC?, separators, optional parens, 7–14 digits total.
  private phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  private emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  private urlPattern = /https?:\/\/[^\s]+/g;
  private customNames: Map<string, string>;
  private enabled: boolean;

  constructor(options: PIIRedactorOptions = {}) {
    this.enabled = options.enabled ?? (process.env.DYAD_PII_REDACTION !== 'false');
    this.customNames = new Map();

    const partner = options.partnerName ?? process.env.DYAD_PARTNER_NAME;
    if (partner && partner.trim()) this.customNames.set(partner.trim().toLowerCase(), '[PARTNER]');

    const user = options.userName ?? process.env.DYAD_USER_NAME;
    if (user && user.trim()) this.customNames.set(user.trim().toLowerCase(), '[USER]');

    for (const n of options.extraNames ?? []) {
      if (n && n.trim()) this.customNames.set(n.trim().toLowerCase(), '[NAME]');
    }
  }

  redact(text: string): string {
    if (!this.enabled || !text) return text;
    let out = text;
    out = out.replace(this.urlPattern, '[URL]');
    out = out.replace(this.emailPattern, '[EMAIL]');
    out = out.replace(this.phonePattern, m => {
      // Skip very short digit runs (e.g. years like 2024)
      const digits = m.replace(/\D/g, '');
      return digits.length >= 7 ? '[PHONE]' : m;
    });

    for (const [name, replacement] of this.customNames.entries()) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      out = out.replace(regex, replacement);
    }
    return out;
  }

  redactBatch(texts: string[]): string[] {
    return texts.map(t => this.redact(t));
  }

  addCustomNames(names: string[], replacement: string = '[NAME]'): void {
    for (const n of names) {
      if (n && n.trim()) this.customNames.set(n.trim().toLowerCase(), replacement);
    }
  }
}
