import { z } from 'zod';

/**
 * Base Receipt Schema - Unified Core + Tool-Specific Extensions
 * 
 * This schema provides a unified receipt format across all G-Stack tools
 * while preserving tool-specific granularity through the tool_data field.
 */

export const BaseReceiptSchema = z.object({
  receipt_id: z.string().uuid(),
  tool: z.enum(['gmirror', 'gorchestrator', 'gtom', 'gagent', 'glearn', 'gstack']),
  timestamp: z.string().datetime(),
  status: z.enum(['success', 'failed', 'partial']),
  
  // Standardized metrics (required)
  cost_usd: z.number(),
  latency_ms: z.number(),
  tokens_used: z.number(),
  llm_calls: z.number(),
  
  // Normalized quality scores (required)
  quality: z.object({
    correctness: z.number().min(0).max(1),      // 0-1
    efficiency: z.number().min(0).max(1),       // 0-1
    robustness: z.number().min(0).max(1),       // 0-1
    clarity: z.number().min(0).max(1),          // 0-1
    authenticity: z.number().min(0).max(1),     // 0-1
  }),
  
  // Tool-specific data (optional, tool-specific schema)
  tool_data: z.record(z.any()).optional(),
  
  // Optional: schema version for migration
  schema_version: z.literal('base-v1').default('base-v1'),
});

export type BaseReceipt = z.infer<typeof BaseReceiptSchema>;

/**
 * Receipt Mapper
 * 
 * Converts tool-specific receipts to BaseReceipt format and vice versa.
 */
export class ReceiptMapper {
  /**
   * Convert tool-specific receipt to BaseReceipt
   */
  static toBaseReceipt(tool: string, toolReceipt: any): BaseReceipt {
    // Extract core metrics
    const cost_usd = toolReceipt.cost_usd || 0;
    const latency_ms = toolReceipt.latency_ms || 0;
    const tokens_used = toolReceipt.tokens_used || 0;
    const llm_calls = toolReceipt.llm_calls || 1;
    
    // Calculate normalized quality scores from tool-specific data
    const quality = ReceiptMapper.normalizeQualityScores(tool, toolReceipt);
    
    // Determine status
    const status = ReceiptMapper.determineStatus(tool, toolReceipt);
    
    return {
      receipt_id: toolReceipt.receipt_id || crypto.randomUUID(),
      tool: tool as any,
      timestamp: toolReceipt.timestamp || new Date().toISOString(),
      status,
      cost_usd,
      latency_ms,
      tokens_used,
      llm_calls,
      quality,
      tool_data: toolReceipt,
      schema_version: 'base-v1',
    };
  }
  
  /**
   * Normalize quality scores from tool-specific data
   */
  private static normalizeQualityScores(tool: string, toolReceipt: any): {
    correctness: number;
    efficiency: number;
    robustness: number;
    clarity: number;
    authenticity: number;
  } {
    // Default scores
    const defaults = {
      correctness: 0.5,
      efficiency: 0.5,
      robustness: 0.5,
      clarity: 0.5,
      authenticity: 0.5,
    };
    
    switch (tool) {
      case 'gmirror':
        // GMirror has scores: correctness, user_outcome, robustness, risk, confidence
        const mirrorScores = toolReceipt.scores || {};
        return {
          correctness: ReceiptMapper.normalizeScore(mirrorScores.correctness?.score),
          efficiency: 1 - (toolReceipt.cost_breakdown?.total_cost_usd || 0) / 10, // Normalize cost
          robustness: ReceiptMapper.normalizeScore(mirrorScores.robustness?.score),
          clarity: ReceiptMapper.normalizeScore(mirrorScores.confidence?.score),
          authenticity: 0.8, // GMirror focuses on synthetic user testing
        };
        
      case 'gorchestrator':
        // GOrchestrator uses overall_score from rubric
        const orchScore = toolReceipt.overall_score || 0.5;
        return {
          correctness: orchScore,
          efficiency: 1 - (toolReceipt.total_cost_usd || 0) / 20,
          robustness: toolReceipt.hard_gates_passed ? 1 : 0.5,
          clarity: orchScore,
          authenticity: orchScore,
        };
        
      case 'gtom':
        // GToM has authenticity_score
        return {
          correctness: 0.7,
          efficiency: 1 - (toolReceipt.cost_usd || 0) / 5,
          robustness: toolReceipt.vulnerability_detected ? 0.3 : 0.9,
          clarity: 0.7,
          authenticity: ReceiptMapper.normalizeScore(toolReceipt.authenticity_score),
        };
        
      case 'gagent':
        // GAgent uses pipeline results
        return {
          correctness: toolReceipt.success ? 0.9 : 0.3,
          efficiency: 1 - (toolReceipt.cost_usd || 0) / 20,
          robustness: toolReceipt.error_rate ? 1 - toolReceipt.error_rate : 0.7,
          clarity: 0.7,
          authenticity: 0.7,
        };
        
      case 'glearn':
        // GLearn has pattern mining metrics
        return {
          correctness: toolReceipt.counterfactual_score || 0.5,
          efficiency: 1 - (toolReceipt.cost_usd || 0) / 10,
          robustness: toolReceipt.stability_score || 0.5,
          clarity: 0.7,
          authenticity: 0.7,
        };
        
      case 'gstack':
        // GStack has code review findings
        const issueCount = toolReceipt.total_issues || 0;
        return {
          correctness: 1 - Math.min(issueCount / 10, 1),
          efficiency: 1 - (toolReceipt.cost_usd || 0) / 5,
          robustness: 0.8,
          clarity: 0.8,
          authenticity: 0.9,
        };
        
      default:
        return defaults;
    }
  }
  
  /**
   * Normalize a score to 0-1 range
   */
  private static normalizeScore(score?: number): number {
    if (score === undefined || score === null) return 0.5;
    if (score >= 0 && score <= 1) return score;
    if (score >= 1 && score <= 5) return score / 5;
    if (score >= 1 && score <= 10) return score / 10;
    return 0.5;
  }
  
  /**
   * Determine status from tool-specific receipt
   */
  private static determineStatus(tool: string, toolReceipt: any): 'success' | 'failed' | 'partial' {
    switch (tool) {
      case 'gmirror':
        return toolReceipt.overall === 'pass' ? 'success' : 'failed';
        
      case 'gorchestrator':
        if (toolReceipt.winner) return 'success';
        if (toolReceipt.attempts?.some((a: any) => a.status === 'success')) return 'partial';
        return 'failed';
        
      case 'gtom':
        return toolReceipt.vulnerability_detected ? 'failed' : 'success';
        
      case 'gagent':
        return toolReceipt.success ? 'success' : 'failed';
        
      case 'glearn':
        return toolReceipt.proposals_generated > 0 ? 'success' : 'partial';
        
      case 'gstack':
        return toolReceipt.total_issues === 0 ? 'success' : 'partial';
        
      default:
        return 'success';
    }
  }
  
  /**
   * Extract tool-specific data from BaseReceipt
   */
  static getToolData(baseReceipt: BaseReceipt, tool: string): any {
    return baseReceipt.tool_data || {};
  }
  
  /**
   * Validate BaseReceipt
   */
  static validate(receipt: any): receipt is BaseReceipt {
    return BaseReceiptSchema.safeParse(receipt).success;
  }
}
