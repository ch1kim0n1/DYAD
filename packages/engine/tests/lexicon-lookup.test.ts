import { describe, it, expect } from 'bun:test';
import { LexiconLookup } from '../src/lexicon-lookup.js';

describe('issue #12 + #15: LexiconLookup loads at runtime and scores text', () => {
  const l = new LexiconLookup();

  it('NRC lookup returns scores for known emotion words', () => {
    const happy = l.getNRCEmotions('happy');
    expect(happy?.joy).toBe(true);
    expect(happy?.positive).toBe(true);
  });

  it('AFINN lookup returns numeric valence', () => {
    expect(l.getAFINNScore('great')).toBeGreaterThan(0);
    expect(l.getAFINNScore('awful')).toBeLessThan(0);
  });

  it('recognises intensifiers', () => {
    expect(l.isIntensifier('very')).toBe(true);
    expect(l.isIntensifier('apple')).toBe(false);
  });

  it('calculateNRCScores returns scores in [0,1]', () => {
    const s = l.calculateNRCScores('I am so happy and grateful and trusting');
    expect(s.nrc_joy).toBeGreaterThan(0);
    expect(s.nrc_positive).toBeGreaterThan(0);
    expect(s.nrc_joy).toBeLessThanOrEqual(1);
  });

  it('calculateAFINNValence applies intensifier multiplier', () => {
    const plain = l.calculateAFINNValence('happy');
    const boosted = l.calculateAFINNValence('very happy');
    expect(boosted.afinn_valence).toBeGreaterThanOrEqual(plain.afinn_valence);
    expect(boosted.intensifier_rate).toBeGreaterThan(0);
  });

  it('handles empty input cleanly', () => {
    const s = l.calculateNRCScores('');
    expect(s.nrc_joy).toBe(0);
    const a = l.calculateAFINNValence('');
    expect(a.afinn_valence).toBe(0);
  });
});
