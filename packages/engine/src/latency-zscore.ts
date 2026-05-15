import { NormalizedMessage } from '@dyad/shared';

interface PerSenderStats {
  history: number[];
  mean: number;
  m2: number;        // sum of squared deviations (Welford)
  count: number;
}

/**
 * LatencyZScore — z-score of response latency per sender, using a rolling window.
 *
 * Each participant has their own response-time baseline (mean, std) computed
 * over the last `windowSize` observations. The z-score for a new latency
 * tells us how unusual that response time is *for that participant*.
 */
export class LatencyZScore {
  private windowSize: number;
  private statsByParticipant: Map<string, PerSenderStats> = new Map();

  constructor(windowSize: number = 200) {
    this.windowSize = windowSize;
  }

  /**
   * Compute z-scores for each message in chronological order. The score for
   * a given message reflects how its response latency compares to that
   * sender's prior latencies (rolling window, exclusive of current).
   */
  computeMessageZScores(messages: NormalizedMessage[]): Map<string, number> {
    const ordered = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const zScores = new Map<string, number>();
    let prev: NormalizedMessage | undefined;

    for (const current of ordered) {
      if (!prev || prev.participant_id === current.participant_id) {
        zScores.set(current.message_id, 0);
        prev = current;
        continue;
      }
      const latencyMs =
        new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime();
      const z = this.zScoreFor(current.participant_id, latencyMs);
      zScores.set(current.message_id, z);
      this.observe(current.participant_id, latencyMs);
      prev = current;
    }
    return zScores;
  }

  /**
   * Z-score for `latencyMs` against `participantId`'s current rolling stats.
   * Does NOT update stats. Returns 0 if there's no baseline yet.
   */
  zScoreFor(participantId: string, latencyMs: number): number {
    const s = this.statsByParticipant.get(participantId);
    if (!s || s.count < 2) return 0;
    const variance = s.m2 / (s.count - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (latencyMs - s.mean) / std;
  }

  /**
   * Record a new latency observation for a participant (online Welford).
   */
  observe(participantId: string, latencyMs: number): void {
    let s = this.statsByParticipant.get(participantId);
    if (!s) {
      s = { history: [], mean: 0, m2: 0, count: 0 };
      this.statsByParticipant.set(participantId, s);
    }

    if (s.history.length >= this.windowSize) {
      const removed = s.history.shift()!;
      const oldCount = s.count;
      const oldMean = s.mean;
      s.count = oldCount - 1;
      if (s.count === 0) {
        s.mean = 0;
        s.m2 = 0;
      } else {
        s.mean = (oldMean * oldCount - removed) / s.count;
        s.m2 = Math.max(0, s.m2 - (removed - oldMean) * (removed - s.mean));
      }
    }

    s.history.push(latencyMs);
    s.count += 1;
    const delta = latencyMs - s.mean;
    s.mean += delta / s.count;
    s.m2 += delta * (latencyMs - s.mean);
  }

  getStatistics(participantId: string): { mean: number; stdDev: number; count: number } {
    const s = this.statsByParticipant.get(participantId);
    if (!s || s.count < 2) return { mean: 0, stdDev: 0, count: s?.count ?? 0 };
    return {
      mean: s.mean,
      stdDev: Math.sqrt(s.m2 / (s.count - 1)),
      count: s.count,
    };
  }

  reset(): void {
    this.statsByParticipant.clear();
  }
}
