/**
 * Normalized Output Axes for Cross-Tool Comparison
 * 
 * Provides:
 * - Standardized output schema for all tools
 * - Normalized metrics for comparison
 * - Cross-tool compatibility
 */

export interface NormalizedOutput {
  tool: string;
  task_id: string;
  timestamp: string;
  
  // Core metrics
  success: boolean;
  score: number; // 0-1 normalized
  
  // Cost metrics
  cost_usd: number;
  tokens_used: number;
  llm_calls: number;
  
  // Latency metrics
  latency_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  
  // Quality dimensions
  correctness?: number; // 0-1
  efficiency?: number; // 0-1
  robustness?: number; // 0-1
  clarity?: number; // 0-1
  authenticity?: number; // 0-1
  
  // Tool-specific metadata
  metadata?: Record<string, any>;
}

export interface NormalizedAxes {
  // Success rate
  success_rate: number;
  
  // Average score
  avg_score: number;
  
  // Cost efficiency (score per dollar)
  cost_efficiency: number;
  
  // Time efficiency (score per second)
  time_efficiency: number;
  
  // Token efficiency (score per token)
  token_efficiency: number;
  
  // Quality breakdown
  avg_correctness: number;
  avg_efficiency: number;
  avg_robustness: number;
  avg_clarity: number;
  avg_authenticity: number;
}

/**
 * Normalize tool output to standard schema
 */
export function normalizeOutput(
  tool: string,
  rawOutput: any
): NormalizedOutput {
  const base: NormalizedOutput = {
    tool,
    task_id: rawOutput.task_id || rawOutput.request_id || 'unknown',
    timestamp: rawOutput.timestamp || new Date().toISOString(),
    success: rawOutput.success !== undefined ? rawOutput.success : rawOutput.status === 'completed',
    score: normalizeScore(rawOutput),
    cost_usd: rawOutput.total_cost_usd || rawOutput.cost_breakdown?.total_cost_usd || 0,
    tokens_used: rawOutput.tokens_used || rawOutput.trace?.total_tokens || 0,
    llm_calls: rawOutput.llm_calls || 0,
    latency_ms: rawOutput.latency_ms || rawOutput.wall_time_ms || 0,
    p50_ms: rawOutput.p50_ms || 0,
    p95_ms: rawOutput.p95_ms || 0,
    p99_ms: rawOutput.p99_ms || 0,
    metadata: rawOutput.metadata || {},
  };

  // Extract quality dimensions if available
  if (rawOutput.scores) {
    base.correctness = rawOutput.scores.correctness?.score || rawOutput.scores.correctness || 0;
    base.efficiency = rawOutput.scores.efficiency?.score || rawOutput.scores.efficiency || 0;
    base.robustness = rawOutput.scores.robustness?.score || rawOutput.scores.robustness || 0;
    base.clarity = rawOutput.scores.clarity?.score || rawOutput.scores.clarity || 0;
    base.authenticity = rawOutput.scores.authenticity?.score || rawOutput.scores.authenticity || 0;
  }

  if (rawOutput.dimensions) {
    base.correctness = rawOutput.dimensions.correctness || base.correctness;
    base.efficiency = rawOutput.dimensions.efficiency || base.efficiency;
    base.robustness = rawOutput.dimensions.robustness || base.robustness;
  }

  return base;
}

/**
 * Normalize score to 0-1 range
 */
function normalizeScore(rawOutput: any): number {
  if (rawOutput.score !== undefined) return rawOutput.score;
  if (rawOutput.overall_score !== undefined) return rawOutput.overall_score;
  if (rawOutput.overall === 'pass') return 1;
  if (rawOutput.overall === 'fail') return 0;
  if (rawOutput.verdict === 'pass') return 1;
  if (rawOutput.verdict === 'fail') return 0;
  return 0.5; // Default
}

/**
 * Calculate normalized axes from a set of outputs
 */
export function calculateNormalizedAxes(outputs: NormalizedOutput[]): NormalizedAxes {
  const count = outputs.length;
  if (count === 0) {
    return {
      success_rate: 0,
      avg_score: 0,
      cost_efficiency: 0,
      time_efficiency: 0,
      token_efficiency: 0,
      avg_correctness: 0,
      avg_efficiency: 0,
      avg_robustness: 0,
      avg_clarity: 0,
      avg_authenticity: 0,
    };
  }

  const successCount = outputs.filter(o => o.success).length;
  const avgScore = outputs.reduce((sum, o) => sum + o.score, 0) / count;
  const avgCost = outputs.reduce((sum, o) => sum + o.cost_usd, 0) / count;
  const avgLatency = outputs.reduce((sum, o) => sum + o.latency_ms, 0) / count;
  const avgTokens = outputs.reduce((sum, o) => sum + o.tokens_used, 0) / count;

  const costEfficiency = avgCost > 0 ? avgScore / avgCost : 0;
  const timeEfficiency = avgLatency > 0 ? avgScore / (avgLatency / 1000) : 0;
  const tokenEfficiency = avgTokens > 0 ? avgScore / avgTokens : 0;

  const validCorrectness = outputs.filter(o => o.correctness !== undefined);
  const avgCorrectness = validCorrectness.length > 0
    ? validCorrectness.reduce((sum, o) => sum + (o.correctness || 0), 0) / validCorrectness.length
    : 0;

  const validEfficiency = outputs.filter(o => o.efficiency !== undefined);
  const avgEfficiencyDim = validEfficiency.length > 0
    ? validEfficiency.reduce((sum, o) => sum + (o.efficiency || 0), 0) / validEfficiency.length
    : 0;

  const validRobustness = outputs.filter(o => o.robustness !== undefined);
  const avgRobustness = validRobustness.length > 0
    ? validRobustness.reduce((sum, o) => sum + (o.robustness || 0), 0) / validRobustness.length
    : 0;

  const validClarity = outputs.filter(o => o.clarity !== undefined);
  const avgClarity = validClarity.length > 0
    ? validClarity.reduce((sum, o) => sum + (o.clarity || 0), 0) / validClarity.length
    : 0;

  const validAuthenticity = outputs.filter(o => o.authenticity !== undefined);
  const avgAuthenticity = validAuthenticity.length > 0
    ? validAuthenticity.reduce((sum, o) => sum + (o.authenticity || 0), 0) / validAuthenticity.length
    : 0;

  return {
    success_rate: successCount / count,
    avg_score: avgScore,
    cost_efficiency: costEfficiency,
    time_efficiency: timeEfficiency,
    token_efficiency: tokenEfficiency,
    avg_correctness: avgCorrectness,
    avg_efficiency: avgEfficiencyDim,
    avg_robustness: avgRobustness,
    avg_clarity: avgClarity,
    avg_authenticity: avgAuthenticity,
  };
}

/**
 * Compare outputs across tools
 */
export function compareTools(toolOutputs: Map<string, NormalizedOutput[]>): Map<string, NormalizedAxes> {
  const comparison = new Map<string, NormalizedAxes>();

  for (const [tool, outputs] of toolOutputs.entries()) {
    const axes = calculateNormalizedAxes(outputs);
    comparison.set(tool, axes);
  }

  return comparison;
}
