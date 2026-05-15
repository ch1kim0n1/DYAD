import { describe, it, expect } from 'bun:test';
import { FunctionWordParser } from '../src/function-word-parser.js';

describe('issue #13: function-word parser', () => {
  const p = new FunctionWordParser();

  it('returns all-zero rates for empty text', () => {
    const r = p.parse('');
    expect(r.fw_i).toBe(0);
    expect(r.fw_we).toBe(0);
  });

  it('counts first-person singular', () => {
    const r = p.parse('I think I should go because I want to');
    expect(r.fw_i).toBeGreaterThan(0);
  });

  it('counts absolutist words', () => {
    const r = p.parse('you always do this and never listen');
    expect(r.fw_abs).toBeGreaterThan(0);
    expect(r.fw_you).toBeGreaterThan(0);
  });

  it('counts tentative words', () => {
    const r = p.parse('maybe perhaps we could try');
    expect(r.fw_tent).toBeGreaterThan(0);
    expect(r.fw_we).toBeGreaterThan(0);
  });

  it('counts cognitive process words', () => {
    const r = p.parse('I think because I know');
    expect(r.fw_cog).toBeGreaterThan(0);
  });

  it('rates sum to <= 1 per category', () => {
    const r = p.parse('I I I I me me my');
    expect(r.fw_i).toBeGreaterThan(0);
    expect(r.fw_i).toBeLessThanOrEqual(1);
  });
});
