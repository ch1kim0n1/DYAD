/**
 * NOUS MVI Planner tests
 */
import { describe, it, expect } from 'bun:test';
import { MviPlanner } from '../src/nous/mvi/planner.js';
import type { MviCandidate } from '@dyad/shared';

describe('MviPlanner', () => {
  it('returns empty plan for zero budget', () => {
    const candidates: MviCandidate[] = [
      {
        id: 'c1',
        capability: 'deep_research',
        payload: {},
        cost_credits: 3,
        expected_information_gain: 0.5,
        target_belief_ids: ['b1'],
        rationale: 'test',
      },
    ];
    
    const plan = MviPlanner.plan(candidates, 0);
    
    expect(plan.selected).toEqual([]);
    expect(plan.rejected).toEqual(candidates);
    expect(plan.total_cost).toBe(0);
    expect(plan.total_information_gain).toBe(0);
  });

  it('returns empty plan for no candidates', () => {
    const plan = MviPlanner.plan([], 10);
    
    expect(plan.selected).toEqual([]);
    expect(plan.rejected).toEqual([]);
    expect(plan.total_cost).toBe(0);
    expect(plan.total_information_gain).toBe(0);
  });

  it('selects optimal items within budget using DP', () => {
    const candidates: MviCandidate[] = [
      {
        id: 'c1',
        capability: 'deep_research',
        payload: {},
        cost_credits: 3,
        expected_information_gain: 0.6,
        target_belief_ids: ['b1'],
        rationale: 'high value',
      },
      {
        id: 'c2',
        capability: 'deep_research',
        payload: {},
        cost_credits: 2,
        expected_information_gain: 0.4,
        target_belief_ids: ['b2'],
        rationale: 'medium value',
      },
      {
        id: 'c3',
        capability: 'deep_research',
        payload: {},
        cost_credits: 5,
        expected_information_gain: 0.8,
        target_belief_ids: ['b3'],
        rationale: 'best value but expensive',
      },
    ];
    
    const plan = MviPlanner.plan(candidates, 5);
    
    expect(plan.total_cost).toBeLessThanOrEqual(5);
    expect(plan.total_information_gain).toBeGreaterThan(0);
    expect(plan.algorithm).toBe('knapsack_dp');
  });

  it('uses greedy fallback for >50 candidates', () => {
    const candidates: MviCandidate[] = Array.from({ length: 51 }, (_, i) => ({
      id: `c${i}`,
      capability: 'deep_research',
      payload: {},
      cost_credits: 1,
      expected_information_gain: 0.1,
      target_belief_ids: [`b${i}`],
      rationale: 'test',
    }));
    
    const plan = MviPlanner.plan(candidates, 10);
    
    expect(plan.algorithm).toBe('greedy_fallback');
    expect(plan.selected.length).toBe(10);
    expect(plan.total_cost).toBe(10);
  });

  it('correctly separates selected from rejected', () => {
    const candidates: MviCandidate[] = [
      {
        id: 'c1',
        capability: 'deep_research',
        payload: {},
        cost_credits: 2,
        expected_information_gain: 0.5,
        target_belief_ids: ['b1'],
        rationale: 'affordable',
      },
      {
        id: 'c2',
        capability: 'deep_research',
        payload: {},
        cost_credits: 10,
        expected_information_gain: 1.0,
        target_belief_ids: ['b2'],
        rationale: 'too expensive',
      },
    ];
    
    const plan = MviPlanner.plan(candidates, 5);
    
    expect(plan.selected).toHaveLength(1);
    expect(plan.selected[0].id).toBe('c1');
    expect(plan.rejected).toHaveLength(1);
    expect(plan.rejected[0].id).toBe('c2');
  });

  it('maximizes information gain within budget', () => {
    const candidates: MviCandidate[] = [
      {
        id: 'c1',
        capability: 'deep_research',
        payload: {},
        cost_credits: 3,
        expected_information_gain: 0.3,
        target_belief_ids: ['b1'],
        rationale: 'low efficiency',
      },
      {
        id: 'c2',
        capability: 'deep_research',
        payload: {},
        cost_credits: 3,
        expected_information_gain: 0.9,
        target_belief_ids: ['b2'],
        rationale: 'high efficiency',
      },
    ];
    
    const plan = MviPlanner.plan(candidates, 3);
    
    // Should select c2 (higher information gain for same cost)
    expect(plan.selected).toHaveLength(1);
    expect(plan.selected[0].id).toBe('c2');
    expect(plan.total_information_gain).toBe(0.9);
  });
});
