import { FeatureVector, NormalizedMessage } from '@dyad/shared';

/**
 * Pearson product-moment correlation between self and partner
 * AFINN valence scores over a rolling window.
 *
 * Returns 0 when fewer than 5 paired observations exist. Result is
 * clamped to [-1, 1].
 *
 * Pairing rule: time-adjacent messages where the senders alternate
 * (self → partner or partner → self) are paired as (self_score, partner_score),
 * using the message of the most recent self / partner respectively.
 */
export function computeMirroringIndex(
  features: FeatureVector[],
  messages: NormalizedMessage[],
  windowSize: number = 20
): number {
  const featureById = new Map(features.map(f => [f.message_id, f]));

  // Sort by timestamp ascending
  const ordered = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const selfScores: number[] = [];
  const partnerScores: number[] = [];

  let pendingSelf: number | null = null;
  let pendingPartner: number | null = null;

  for (const msg of ordered) {
    const f = featureById.get(msg.message_id);
    if (!f) continue;
    const v = f.afinn_valence;
    if (msg.is_from_me) {
      pendingSelf = v;
      if (pendingPartner !== null) {
        selfScores.push(pendingSelf);
        partnerScores.push(pendingPartner);
        pendingSelf = null;
        pendingPartner = null;
      }
    } else {
      pendingPartner = v;
      if (pendingSelf !== null) {
        selfScores.push(pendingSelf);
        partnerScores.push(pendingPartner);
        pendingSelf = null;
        pendingPartner = null;
      }
    }
  }

  // Keep only the most recent `windowSize` pairs
  const start = Math.max(0, selfScores.length - windowSize);
  const xs = selfScores.slice(start);
  const ys = partnerScores.slice(start);

  if (xs.length < 5) return 0;
  return clamp(pearsonR(xs, ys), -1, 1);
}

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
