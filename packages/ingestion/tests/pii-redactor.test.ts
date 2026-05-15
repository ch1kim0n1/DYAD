import { describe, it, expect } from 'bun:test';
import { PIIRedactor } from '../src/pii-redactor.js';

describe('issue #9: PII redaction', () => {
  it('redacts emails', () => {
    const r = new PIIRedactor({ enabled: true });
    expect(r.redact('email me at foo@bar.com')).toContain('[EMAIL]');
  });

  it('redacts US phone numbers', () => {
    const r = new PIIRedactor({ enabled: true });
    expect(r.redact('call 555-123-4567 now')).toContain('[PHONE]');
  });

  it('redacts international phone numbers', () => {
    const r = new PIIRedactor({ enabled: true });
    const out = r.redact('Reach me at +1 (555) 555-5555 anytime');
    expect(out).toContain('[PHONE]');
  });

  it('redacts DYAD_PARTNER_NAME to [PARTNER]', () => {
    const r = new PIIRedactor({ partnerName: 'Sasha' });
    expect(r.redact('Sasha said hi')).toBe('[PARTNER] said hi');
  });

  it('redacts URLs', () => {
    const r = new PIIRedactor({ enabled: true });
    expect(r.redact('see https://example.com/x')).toContain('[URL]');
  });

  it('skips redaction when disabled', () => {
    const r = new PIIRedactor({ enabled: false });
    expect(r.redact('foo@bar.com')).toBe('foo@bar.com');
  });
});
