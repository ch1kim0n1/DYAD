import { FeatureVector, NormalizedMessage, PredictiveDivergenceResult } from '@dyad/shared';

const WINDOW = 5;
const DIVERGENCE_THRESHOLD = 0.3;

/**
 * Predictive divergence — flag when self and partner emotional trajectories
 * point in opposite directions over the last `WINDOW` messages each.
 *
 * Implementation:
 *   1. For each side, take the last `WINDOW` AFINN valence values.
 *   2. Fit a least-squares slope (valence per message index).
 *   3. Detect when the two slopes have opposite signs and
 *      |self_trend - partner_trend| > DIVERGENCE_THRESHOLD.
 */
export class PredictiveDivergenceDetector {
  detect(
    features: FeatureVector[],
    messages: NormalizedMessage[]
  ): PredictiveDivergenceResult {
    const featureById = new Map(features.map(f => [f.message_id, f]));
    const ordered = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const selfValences: number[] = [];
    const partnerValences: number[] = [];
    for (const m of ordered) {
      const f = featureById.get(m.message_id);
      if (!f) continue;
      (m.is_from_me ? selfValences : partnerValences).push(f.afinn_valence);
    }

    const selfWindow = selfValences.slice(-WINDOW);
    const partnerWindow = partnerValences.slice(-WINDOW);

    if (selfWindow.length < WINDOW || partnerWindow.length < WINDOW) {
      return {
        detected: false,
        self_trend: 0,
        partner_trend: 0,
        divergence_score: 0,
        window_size: Math.min(selfWindow.length, partnerWindow.length),
      };
    }

    const selfTrend = leastSquaresSlope(selfWindow);
    const partnerTrend = leastSquaresSlope(partnerWindow);
    const divergence = Math.abs(selfTrend - partnerTrend);
    const oppositeSign = (selfTrend > 0 && partnerTrend < 0) || (selfTrend < 0 && partnerTrend > 0);
    const detected = oppositeSign && divergence > DIVERGENCE_THRESHOLD;

    return {
      detected,
      self_trend: selfTrend,
      partner_trend: partnerTrend,
      divergence_score: divergence,
      window_size: WINDOW,
    };
  }
}

/**
 * Slope of y over x = 0..n-1, by ordinary least squares.
 */
function leastSquaresSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;             // mean of 0..n-1
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}
