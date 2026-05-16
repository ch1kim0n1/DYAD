import type { RelationshipModel } from '@dyad/shared';

/**
 * Relationship health score (#91). Weighted blend of the five core
 * metrics into a single 0–100 integer.
 *
 * Weights:
 *   five_to_one_ratio              30%  (capped at 5; anything above is full credit)
 *   partner bid response rate      25%
 *   self bid response rate         15%
 *   mirroring index                15%  (rescaled from [-1,1] to [0,1])
 *   repair labor balance           15%  (1 - |index|; balanced is best)
 *
 * Bands:
 *   80-100  Thriving
 *   60-79   Stable
 *   40-59   Navigating
 *   20-39   Strained
 *    0-19   In Crisis
 */
export interface HealthScoreComponent {
  name: string;
  value: number;       // 0..1
  weight: number;      // 0..1
  contribution: number;// value * weight * 100
}

export interface HealthScore {
  score: number;
  band: 'Thriving' | 'Stable' | 'Navigating' | 'Strained' | 'In Crisis';
  components: HealthScoreComponent[];
}

function band(score: number): HealthScore['band'] {
  if (score >= 80) return 'Thriving';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Navigating';
  if (score >= 20) return 'Strained';
  return 'In Crisis';
}

export function computeHealthScore(model: RelationshipModel): HealthScore {
  const components: HealthScoreComponent[] = [
    { name: 'Positive:Negative ratio', value: Math.min(model.five_to_one_ratio / 5, 1), weight: 0.30, contribution: 0 },
    { name: "Partner's bid response",  value: clamp01(model.bid_response_rate.partner_response_rate), weight: 0.25, contribution: 0 },
    { name: "Your bid response",       value: clamp01(model.bid_response_rate.user_response_rate),    weight: 0.15, contribution: 0 },
    { name: 'Mirroring',               value: clamp01((model.mirroring_index + 1) / 2),               weight: 0.15, contribution: 0 },
    { name: 'Repair balance',          value: clamp01(1 - Math.abs(model.repair_labor_index)),        weight: 0.15, contribution: 0 },
  ];
  let total = 0;
  for (const c of components) {
    c.contribution = c.value * c.weight * 100;
    total += c.contribution;
  }
  const score = Math.round(total);
  return { score, band: band(score), components };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
