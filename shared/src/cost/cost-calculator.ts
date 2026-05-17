/**
 * Cost Calculator for LLM API calls
 * 
 * Provides token-to-cost conversion for various LLM providers and models.
 */

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelPricing {
  prompt_per_1k: number;  // USD per 1K prompt tokens
  completion_per_1k: number;  // USD per 1K completion tokens
}

/**
 * Pricing data for common models (USD per 1K tokens)
 */
const PRICING_DATA: Record<string, ModelPricing> = {
  // Anthropic Claude
  'claude-3-5-sonnet-20241022': { prompt_per_1k: 0.003, completion_per_1k: 0.015 },
  'claude-3-5-haiku-20241022': { prompt_per_1k: 0.0008, completion_per_1k: 0.004 },
  'claude-3-opus-20240229': { prompt_per_1k: 0.015, completion_per_1k: 0.075 },
  'claude-3-sonnet-20240229': { prompt_per_1k: 0.003, completion_per_1k: 0.015 },
  'claude-3-haiku-20240307': { prompt_per_1k: 0.00025, completion_per_1k: 0.00125 },
  
  // OpenAI GPT-4
  'gpt-4-turbo-2024-04-09': { prompt_per_1k: 0.01, completion_per_1k: 0.03 },
  'gpt-4-turbo-preview': { prompt_per_1k: 0.01, completion_per_1k: 0.03 },
  'gpt-4': { prompt_per_1k: 0.03, completion_per_1k: 0.06 },
  'gpt-4-32k': { prompt_per_1k: 0.06, completion_per_1k: 0.12 },
  
  // OpenAI GPT-3.5
  'gpt-3.5-turbo-0125': { prompt_per_1k: 0.0005, completion_per_1k: 0.0015 },
  'gpt-3.5-turbo-1106': { prompt_per_1k: 0.001, completion_per_1k: 0.002 },
  
  // Default fallback pricing
  'default': { prompt_per_1k: 0.001, completion_per_1k: 0.002 },
};

export class CostCalculator {
  /**
   * Calculate cost from token usage and model
   */
  static calculateCost(model: string, usage: TokenUsage): number {
    const pricing = PRICING_DATA[model] || PRICING_DATA['default'];
    
    const promptCost = (usage.prompt_tokens / 1000) * pricing.prompt_per_1k;
    const completionCost = (usage.completion_tokens / 1000) * pricing.completion_per_1k;
    
    return promptCost + completionCost;
  }

  /**
   * Add pricing data for a custom model
   */
  static addPricing(model: string, pricing: ModelPricing): void {
    PRICING_DATA[model] = pricing;
  }

  /**
   * Get pricing for a model
   */
  static getPricing(model: string): ModelPricing | undefined {
    return PRICING_DATA[model];
  }

  /**
   * Estimate cost from text length (rough approximation)
   * Assumes ~4 chars per token for English text
   */
  static estimateCostFromText(model: string, promptText: string, completionText: string): number {
    const promptTokens = Math.ceil(promptText.length / 4);
    const completionTokens = Math.ceil(completionText.length / 4);
    
    return this.calculateCost(model, {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    });
  }

  /**
   * Calculate total cost across multiple operations
   */
  static calculateTotalCost(operations: Array<{ model: string; usage: TokenUsage }>): number {
    let total = 0;
    for (const op of operations) {
      total += this.calculateCost(op.model, op.usage);
    }
    return total;
  }
}
