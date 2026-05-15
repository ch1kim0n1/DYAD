import { describe, it, expect } from 'bun:test';
import { AffectPass } from '../src/affect-pass.js';
import { NormalizedMessage } from '@dyad/shared';

function mkMsg(text: string): NormalizedMessage {
  return {
    message_id: 'm', participant_id: 'p', is_from_me: false,
    text, timestamp: new Date().toISOString(), chat_id: 'c',
  };
}

describe('issue #15: AffectPass', () => {
  const a = new AffectPass();

  it('produces NRC + AFINN merged scores for a message', () => {
    const s = a.processMessage(mkMsg('I am happy and grateful'));
    expect(s.nrc_joy).toBeGreaterThan(0);
    expect(s.afinn_valence).toBeGreaterThanOrEqual(0);
  });

  it('processBatch returns a map keyed by message_id', () => {
    const m1 = mkMsg('happy');
    const m2 = { ...mkMsg('sad'), message_id: 'm2' };
    const out = a.processBatch([m1, m2]);
    expect(out.size).toBe(2);
    expect(out.get('m2')).toBeDefined();
  });

  it('handles empty text', () => {
    const s = a.processMessage(mkMsg(''));
    expect(s.nrc_joy).toBe(0);
    expect(s.afinn_valence).toBe(0);
  });
});
