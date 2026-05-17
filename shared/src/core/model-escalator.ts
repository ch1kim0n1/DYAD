/**
 * Multi-Tier Escalation System
 * 
 * Provides:
 * - Model tier selection based on task complexity
 * - Automatic escalation when quality thresholds not met
 * - Cost-aware model selection
 * - Performance tracking per tier
 */

export type ModelTier = 'fast' | 'balanced' | 'premium';

export interface ModelConfig {
  tier: ModelTier;
  name: string;
  provider: string;
  cost_per_1k_tokens: number;
  max_tokens: number;
  latency_ms_avg: number;
  quality_score: number; // 0-1
}

export interface EscalationPolicy {
  initial_tier: ModelTier;
  max_tier: ModelTier;
  quality_threshold: number; // minimum quality score
  cost_limit_usd: number;
  max_escalations: number;
}

export interface EscalationResult {
  selected_model: ModelConfig;
  tier: ModelTier;
  escalated: boolean;
  escalation_count: number;
  reason: string;
}

export class ModelEscalator {
  private models: Map<ModelTier, ModelConfig[]>;
  private policy: EscalationPolicy;
  private escalation_history: Map<string, number>;

  constructor(models: ModelConfig[], policy: EscalationPolicy) {
    this.models = new Map();
    this.policy = policy;
    this.escalation_history = new Map();

    // Group models by tier
    for (const model of models) {
      if (!this.models.has(model.tier)) {
        this.models.set(model.tier, []);
      }
      this.models.get(model.tier)!.push(model);
    }
  }

  /**
   * Select a model for a task based on escalation policy
   */
  async selectModel(task: {
    description: string;
    complexity?: 'low' | 'medium' | 'high';
    estimated_tokens?: number;
    previous_attempts?: Array<{ model: string; quality: number }>;
  }): Promise<EscalationResult> {
    const taskId = this.generateTaskId(task.description);
    const escalationCount = this.escalation_history.get(taskId) || 0;

    // Check if we've exceeded max escalations
    if (escalationCount >= this.policy.max_escalations) {
      const model = this.getBestModel(this.policy.initial_tier);
      return {
        selected_model: model,
        tier: this.policy.initial_tier,
        escalated: false,
        escalation_count: escalationCount,
        reason: 'Max escalations reached',
      };
    }

    // Check if we have previous attempts that failed quality threshold
    if (task.previous_attempts && task.previous_attempts.length > 0) {
      const lastAttempt = task.previous_attempts[task.previous_attempts.length - 1];
      if (lastAttempt.quality < this.policy.quality_threshold) {
        return this.escalate(taskId, escalationCount);
      }
    }

    // Select based on complexity if provided
    if (task.complexity) {
      const tier = this.complexityToTier(task.complexity);
      const model = this.getBestModel(tier);
      return {
        selected_model: model,
        tier,
        escalated: tier !== this.policy.initial_tier,
        escalation_count: escalationCount,
        reason: `Complexity-based selection: ${task.complexity}`,
      };
    }

    // Default to initial tier
    const model = this.getBestModel(this.policy.initial_tier);
    return {
      selected_model: model,
      tier: this.policy.initial_tier,
      escalated: false,
      escalation_count: escalationCount,
      reason: 'Default selection',
    };
  }

  /**
   * Escalate to a higher tier
   */
  private escalate(taskId: string, currentCount: number): EscalationResult {
    const tiers: ModelTier[] = ['fast', 'balanced', 'premium'];
    const currentIndex = tiers.indexOf(this.policy.initial_tier);
    const maxIndex = tiers.indexOf(this.policy.max_tier);
    
    // Determine next tier
    let nextIndex = Math.min(currentIndex + currentCount + 1, maxIndex);
    const nextTier = tiers[nextIndex];

    // Record escalation
    this.escalation_history.set(taskId, currentCount + 1);

    const model = this.getBestModel(nextTier);
    return {
      selected_model: model,
      tier: nextTier,
      escalated: true,
      escalation_count: currentCount + 1,
      reason: 'Quality threshold not met, escalating',
    };
  }

  /**
   * Get the best model for a tier (highest quality score)
   */
  private getBestModel(tier: ModelTier): ModelConfig {
    const models = this.models.get(tier);
    if (!models || models.length === 0) {
      throw new Error(`No models available for tier: ${tier}`);
    }

    // Sort by quality score (descending) and return the best
    return models.sort((a, b) => b.quality_score - a.quality_score)[0];
  }

  /**
   * Map complexity to model tier
   */
  private complexityToTier(complexity: 'low' | 'medium' | 'high'): ModelTier {
    switch (complexity) {
      case 'low':
        return 'fast';
      case 'medium':
        return 'balanced';
      case 'high':
        return 'premium';
    }
  }

  /**
   * Generate a task ID for tracking
   */
  private generateTaskId(description: string): string {
    // Simple hash for MVP
    let hash = 0;
    for (let i = 0; i < description.length; i++) {
      const char = description.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get escalation statistics
   */
  getStats(): {
    total_escalations: number;
    by_tier: Record<ModelTier, number>;
    avg_escalations_per_task: number;
  } {
    const total = Array.from(this.escalation_history.values()).reduce((sum, count) => sum + count, 0);
    const tasks = this.escalation_history.size;
    
    const by_tier: Record<ModelTier, number> = {
      fast: 0,
      balanced: 0,
      premium: 0,
    };

    // In a real implementation, track which tier was used for each escalation
    // For MVP, we'll use a simple approximation
    
    return {
      total_escalations: total,
      by_tier,
      avg_escalations_per_task: tasks > 0 ? total / tasks : 0,
    };
  }

  /**
   * Reset escalation history
   */
  reset(): void {
    this.escalation_history.clear();
  }
}

/**
 * Default model configurations
 */
export const DEFAULT_MODELS: ModelConfig[] = [
  {
    tier: 'fast',
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    cost_per_1k_tokens: 0.002,
    max_tokens: 4096,
    latency_ms_avg: 500,
    quality_score: 0.7,
  },
  {
    tier: 'balanced',
    name: 'gpt-4',
    provider: 'openai',
    cost_per_1k_tokens: 0.03,
    max_tokens: 8192,
    latency_ms_avg: 2000,
    quality_score: 0.85,
  },
  {
    tier: 'premium',
    name: 'gpt-4-turbo',
    provider: 'openai',
    cost_per_1k_tokens: 0.01,
    max_tokens: 128000,
    latency_ms_avg: 1500,
    quality_score: 0.95,
  },
];

/**
 * Default escalation policy
 */
export const DEFAULT_POLICY: EscalationPolicy = {
  initial_tier: 'fast',
  max_tier: 'premium',
  quality_threshold: 0.8,
  cost_limit_usd: 10.0,
  max_escalations: 2,
};

/**
 * Create a ModelEscalator instance
 */
export function createModelEscalator(
  models?: ModelConfig[],
  policy?: EscalationPolicy
): ModelEscalator {
  return new ModelEscalator(
    models || DEFAULT_MODELS,
    policy || DEFAULT_POLICY
  );
}
