import type { NormalizedEmail, RawEmail } from '@dyad/shared';
import * as crypto from 'node:crypto';

export class EmailNormalizer {
  normalize(raw: RawEmail, redacted?: { subject?: string; body?: string; snippet?: string }): NormalizedEmail {
    return {
      message_id: this.messageId(raw.gmail_id),
      gmail_id: raw.gmail_id,
      from_id: this.fromId(raw.from),
      subject: redacted?.subject ?? raw.subject,
      snippet: redacted?.snippet ?? raw.snippet,
      body_text: redacted?.body ?? raw.body_text,
      timestamp: new Date(raw.internal_date).toISOString(),
      has_ics_attachment: raw.has_ics_attachment,
    };
  }

  normalizeBatch(
    rawEmails: RawEmail[],
    redactedByGmailId?: Map<string, { subject?: string; body?: string; snippet?: string }>
  ): NormalizedEmail[] {
    return rawEmails.map((raw) => {
      const redacted = redactedByGmailId?.get(raw.gmail_id);
      return this.normalize(raw, redacted);
    });
  }

  private messageId(gmailId: string): string {
    return crypto.createHash('sha256').update(gmailId).digest('hex');
  }

  private fromId(from: string): string {
    const normalized = from.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }
}
