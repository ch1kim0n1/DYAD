/**
 * Consensus Mechanism for Multi-Model Escalation
 *
 * Implements similarity-based consensus between Tier 1 and Tier 2 outputs
 * to determine which output to accept when escalation occurs.
 */

export interface ConsensusResult {
  similarity: number;
  decision: 'tier1' | 'tier2' | 'merge' | 'escalate_tier3';
  reason: string;
}

export interface OutputComparison {
  tier1Output: string;
  tier2Output: string;
  tier1Confidence: number;
  tier2Confidence: number;
}

/**
 * Compute semantic similarity between two text outputs
 * 
 * Uses a simple token-based Jaccard similarity as a fallback.
 * In production, this would use embedding-based similarity.
 */
function computeSimilarity(output1: string, output2: string): number {
  // Tokenize and normalize
  const tokens1 = new Set(output1.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tokens2 = new Set(output2.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  
  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }
  
  // Jaccard similarity
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  return intersection.size / union.size;
}

/**
 * Determine consensus decision based on similarity and confidence scores
 */
export function determineConsensus(
  comparison: OutputComparison,
  consensusThreshold: number = 0.8
): ConsensusResult {
  const similarity = computeSimilarity(comparison.tier1Output, comparison.tier2Output);
  
  // High similarity: accept Tier 1 (cheaper, faster)
  if (similarity > consensusThreshold) {
    return {
      similarity,
      decision: 'tier1',
      reason: `High similarity (${similarity.toFixed(2)} > ${consensusThreshold}), accepting cheaper Tier 1 output`,
    };
  }
  
  // Low similarity: accept Tier 2 (higher quality)
  if (similarity < 0.5) {
    return {
      similarity,
      decision: 'tier2',
      reason: `Low similarity (${similarity.toFixed(2)} < 0.5), accepting higher-quality Tier 2 output`,
    };
  }
  
  // Medium similarity: merge or escalate based on confidence
  if (comparison.tier2Confidence > comparison.tier1Confidence + 0.1) {
    return {
      similarity,
      decision: 'tier2',
      reason: `Medium similarity but Tier 2 has significantly higher confidence (${comparison.tier2Confidence.toFixed(2)} vs ${comparison.tier1Confidence.toFixed(2)})`,
    };
  }
  
  // Medium similarity with similar confidence: merge outputs
  return {
    similarity,
    decision: 'merge',
    reason: `Medium similarity (${similarity.toFixed(2)}) with similar confidence, merging outputs`,
  };
}

/**
 * Merge two outputs when consensus cannot be reached
 */
export function mergeOutputs(tier1Output: string, tier2Output: string): string {
  // Simple merge: concatenate with delimiter
  // In production, this would use more sophisticated merging
  return `[MERGED]\n\nTier 1:\n${tier1Output}\n\n---\n\nTier 2:\n${tier2Output}`;
}
