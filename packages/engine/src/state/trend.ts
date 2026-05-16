import type { RelationshipModel } from '@dyad/shared';

/**
 * Week-over-week trend comparison (#89). Pure function — no IO. Caller
 * supplies the current model and the previous-week snapshot (loaded from
 * GBrain via getModelHistory, or null when not enough data).
 */
export type TrendDirection = 'up_better' | 'up_worse' | 'down_better' | 'down_worse' | 'flat';

export interface TrendMetric {
  name: string;
  previous: number;
  current: number;
  deltaPct: number;            // signed, e.g. +0.5 for +50%
  direction: TrendDirection;
}

export interface RelationshipTrend {
  metrics: TrendMetric[];
  narrative: string;
  available: boolean;          // false when previous is null / not enough data
}

const FORMAT = (n: number): number => Math.round(n * 1000) / 1000;

function deltaPct(prev: number, curr: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1;
  return FORMAT((curr - prev) / Math.abs(prev));
}

function direction(prev: number, curr: number, higherIsBetter: boolean): TrendDirection {
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return 'flat';
  if (d > 0) return higherIsBetter ? 'up_better' : 'up_worse';
  return higherIsBetter ? 'down_worse' : 'down_better';
}

function summarise(metrics: TrendMetric[]): string {
  const wins = metrics.filter(m => m.direction === 'up_better' || m.direction === 'down_better').length;
  const losses = metrics.filter(m => m.direction === 'up_worse' || m.direction === 'down_worse').length;
  if (wins === metrics.length) return 'Your strongest week in a while.';
  if (losses === metrics.length) return 'A tougher week than the last.';
  if (wins > losses) return 'Mostly improving compared to last week.';
  if (losses > wins) return 'Mostly slipping compared to last week.';
  return 'A mixed week — roughly steady.';
}

export function computeRelationshipTrend(
  current: RelationshipModel | null,
  previous: RelationshipModel | null,
): RelationshipTrend {
  if (!current || !previous) {
    return { metrics: [], narrative: 'Not enough history yet — check back next week.', available: false };
  }
  const metrics: TrendMetric[] = [
    {
      name: 'Positive:Negative ratio',
      previous: previous.five_to_one_ratio,
      current: current.five_to_one_ratio,
      deltaPct: deltaPct(previous.five_to_one_ratio, current.five_to_one_ratio),
      direction: direction(previous.five_to_one_ratio, current.five_to_one_ratio, true),
    },
    {
      name: "Partner's bid response",
      previous: previous.bid_response_rate.partner_response_rate,
      current: current.bid_response_rate.partner_response_rate,
      deltaPct: deltaPct(previous.bid_response_rate.partner_response_rate, current.bid_response_rate.partner_response_rate),
      direction: direction(previous.bid_response_rate.partner_response_rate, current.bid_response_rate.partner_response_rate, true),
    },
    {
      name: 'Repair labor balance',
      previous: Math.abs(previous.repair_labor_index),
      current: Math.abs(current.repair_labor_index),
      deltaPct: deltaPct(Math.abs(previous.repair_labor_index), Math.abs(current.repair_labor_index)),
      // Lower absolute value is better
      direction: direction(Math.abs(previous.repair_labor_index), Math.abs(current.repair_labor_index), false),
    },
    {
      name: 'Mirroring',
      previous: previous.mirroring_index,
      current: current.mirroring_index,
      deltaPct: deltaPct(previous.mirroring_index, current.mirroring_index),
      direction: direction(previous.mirroring_index, current.mirroring_index, true),
    },
  ];
  return { metrics, narrative: summarise(metrics), available: true };
}
