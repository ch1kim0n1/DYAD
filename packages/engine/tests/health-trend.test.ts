import { describe, it, expect } from 'bun:test';
import { computeHealthScore, computeRelationshipTrend } from '../src/index.js';
import type { RelationshipModel } from '@dyad/shared';

function rel(overrides: Partial<RelationshipModel> = {}): RelationshipModel {
  return {
    dyad_id: 'd',
    ppr_bidirectional: { user_to_partner: 0.5, partner_to_user: 0.5 },
    five_to_one_ratio: 5,
    bid_response_rate: { user_response_rate: 0.5, partner_response_rate: 0.5 },
    repair_labor_index: 0,
    mirroring_index: 0,
    gottman_status: 'warning',
    open_loops: [],
    rupture_repair_ledger: [],
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('issue #91: computeHealthScore', () => {
  it('returns 0–100 with sane defaults', () => {
    const s = computeHealthScore(rel());
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it('rewards high ratio + high response + good mirroring', () => {
    const s = computeHealthScore(rel({
      five_to_one_ratio: 7,
      bid_response_rate: { user_response_rate: 0.9, partner_response_rate: 0.95 },
      mirroring_index: 0.7,
      repair_labor_index: 0.05,
    }));
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.band).toBe('Thriving');
  });

  it('produces low score for failing inputs', () => {
    const s = computeHealthScore(rel({
      five_to_one_ratio: 0.2,
      bid_response_rate: { user_response_rate: 0.2, partner_response_rate: 0.1 },
      mirroring_index: -0.5,
      repair_labor_index: 0.9,
    }));
    expect(s.score).toBeLessThan(40);
    expect(['Strained', 'In Crisis']).toContain(s.band);
  });

  it('exposes per-component breakdown', () => {
    const s = computeHealthScore(rel());
    expect(s.components.length).toBe(5);
    expect(s.components.map(c => c.weight).reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
  });
});

describe('issue #89: computeRelationshipTrend', () => {
  it('reports unavailable when there is no previous snapshot', () => {
    const t = computeRelationshipTrend(rel(), null);
    expect(t.available).toBe(false);
  });

  it('flags improvement in bid response rate', () => {
    const prev = rel({ bid_response_rate: { user_response_rate: 0.5, partner_response_rate: 0.4 } });
    const curr = rel({ bid_response_rate: { user_response_rate: 0.5, partner_response_rate: 0.8 } });
    const t = computeRelationshipTrend(curr, prev);
    const m = t.metrics.find(x => x.name.includes("Partner's bid response"));
    expect(m?.direction).toBe('up_better');
    expect(m?.deltaPct).toBeGreaterThan(0);
  });

  it('flags worsening repair balance (rising |index|)', () => {
    const prev = rel({ repair_labor_index: 0.1 });
    const curr = rel({ repair_labor_index: 0.7 });
    const t = computeRelationshipTrend(curr, prev);
    const m = t.metrics.find(x => x.name === 'Repair labor balance');
    expect(m?.direction).toBe('up_worse');
  });
});
