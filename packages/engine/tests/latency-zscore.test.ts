import { describe, it, expect } from 'bun:test';
import { LatencyZScore } from '../src/latency-zscore.js';
import { NormalizedMessage } from '@dyad/shared';

function msg(id: string, participant: string, t: number): NormalizedMessage {
  return {
    message_id: id,
    participant_id: participant,
    is_from_me: participant === 'me',
    text: '',
    timestamp: new Date(t).toISOString(),
    chat_id: 'c',
  };
}

describe('issue #19: per-sender rolling latency z-score', () => {
  it('returns 0 with no prior observations', () => {
    const z = new LatencyZScore();
    expect(z.zScoreFor('p1', 1000)).toBe(0);
  });

  it('computes higher z-scores for unusually slow responses', () => {
    const z = new LatencyZScore();
    // Baseline with variance around ~1s so std > 0
    const baseline = [800, 1000, 1200, 900, 1100, 950, 1050, 1000, 1150, 850];
    for (const t of baseline) z.observe('p1', t);
    const fast = z.zScoreFor('p1', 1000);
    const slow = z.zScoreFor('p1', 100_000);
    expect(slow).toBeGreaterThan(fast);
  });

  it('isolates statistics per participant', () => {
    const z = new LatencyZScore();
    for (let i = 0; i < 10; i++) z.observe('p1', 1000);
    for (let i = 0; i < 10; i++) z.observe('p2', 100_000);
    expect(z.getStatistics('p1').mean).toBeLessThan(z.getStatistics('p2').mean);
  });

  it('computeMessageZScores produces map keyed by message_id', () => {
    const base = Date.now();
    const messages = [
      msg('m1', 'a', base),
      msg('m2', 'b', base + 1_000),
      msg('m3', 'a', base + 2_000),
      msg('m4', 'b', base + 4_000),
    ];
    const z = new LatencyZScore();
    const out = z.computeMessageZScores(messages);
    expect(out.size).toBe(4);
  });
});
