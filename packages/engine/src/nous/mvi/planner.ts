/**
 * NOUS MVI knapsack planner — 0-1 knapsack for optimal Hog query selection.
 *
 * Maximizes expected information gain (bits) per credit cost.
 * For n ≤ 50 candidates: classical DP O(n × 10·B) where B is budget in credits.
 * For n > 50: greedy fallback (sort by value/weight ratio).
 *
 * Expected information gain = H(prior) - H(expected_posterior) over targeted BeliefNodes.
 * Computed via MentalizationGraph.getNodeEntropy().
 */
import type { MviCandidate, MviPlan } from '@dyad/shared';

export type { MviPlan };

// ════════════════════════════════════════════════════════════════════════════
// 0-1 Knapsack DP
// ════════════════════════════════════════════════════════════════════════════

interface KnapsackItem {
  candidate: MviCandidate;
  index: number;
}

interface KnapsackState {
  totalValue: number;
  totalWeight: number;
  indices: number[];
}

function knapsackDP(items: KnapsackItem[], budget: number): KnapsackState {
  const n = items.length;
  if (n === 0) return { totalValue: 0, totalWeight: 0, indices: [] };

  // Scale budget to integer (credits are already integers)
  const B = Math.floor(budget);
  
  // DP table: dp[i][w] = max value using first i items with weight w
  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(B + 1).fill(0));
  const selected: boolean[][] = Array(n + 1).fill(null).map(() => Array(B + 1).fill(false));

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const weight = item.candidate.cost_credits;
    const value = item.candidate.expected_information_gain;

    for (let w = 0; w <= B; w++) {
      // Don't take item
      dp[i][w] = dp[i - 1][w];

      // Take item if it fits and improves value
      if (weight <= w && dp[i - 1][w - weight] + value > dp[i][w]) {
        dp[i][w] = dp[i - 1][w - weight] + value;
        selected[i][w] = true;
      }
    }
  }

  // Backtrack to find selected items
  let w = B;
  const indices: number[] = [];
  for (let i = n; i > 0; i--) {
    if (selected[i][w]) {
      indices.push(items[i - 1].index);
      w -= items[i - 1].candidate.cost_credits;
    }
  }

  const totalValue = dp[n][B];
  const totalWeight = indices.reduce((sum, idx) => sum + items[idx].candidate.cost_credits, 0);

  return { totalValue, totalWeight, indices };
}

// ════════════════════════════════════════════════════════════════════════════
// Greedy fallback (for n > 50)
// ════════════════════════════════════════════════════════════════════════════

function greedyKnapsack(items: KnapsackItem[], budget: number): KnapsackState {
  // Sort by value/weight ratio (information gain per credit)
  const sorted = [...items].sort((a, b) => {
    const ratioA = a.candidate.expected_information_gain / Math.max(a.candidate.cost_credits, 1);
    const ratioB = b.candidate.expected_information_gain / Math.max(b.candidate.cost_credits, 1);
    return ratioB - ratioA;
  });

  const indices: number[] = [];
  let totalWeight = 0;
  let totalValue = 0;

  for (const item of sorted) {
    if (totalWeight + item.candidate.cost_credits <= budget) {
      indices.push(item.index);
      totalWeight += item.candidate.cost_credits;
      totalValue += item.candidate.expected_information_gain;
    }
  }

  return { totalValue, totalWeight, indices };
}

// ════════════════════════════════════════════════════════════════════════════
// MVI Planner
// ════════════════════════════════════════════════════════════════════════════

export class MviPlanner {
  /**
   * Select optimal Hog queries subject to credit budget.
   * Uses DP for ≤50 candidates, greedy for >50.
   */
  static plan(candidates: MviCandidate[], budget: number): MviPlan {
    if (candidates.length === 0 || budget <= 0) {
      return {
        selected: [],
        rejected: candidates,
        total_cost: 0,
        total_information_gain: 0,
        budget,
        algorithm: 'knapsack_dp',
      };
    }

    const items: KnapsackItem[] = candidates.map((c, i) => ({ candidate: c, index: i }));
    const algorithm = candidates.length <= 50 ? 'knapsack_dp' : 'greedy_fallback';

    const result = algorithm === 'knapsack_dp' 
      ? knapsackDP(items, budget)
      : greedyKnapsack(items, budget);

    const selected = result.indices.map(i => candidates[i]);
    const selectedSet = new Set(result.indices);
    const rejected = candidates.filter((_, i) => !selectedSet.has(i));

    return {
      selected,
      rejected,
      total_cost: result.totalWeight,
      total_information_gain: result.totalValue,
      budget,
      algorithm,
    };
  }
}
