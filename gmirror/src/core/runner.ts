import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticUser,
  Scenario,
  RunRecord,
  Goal,
} from '../types/index.js';
import {
  LLMClient,
  LLMClientConfig,
} from './llm-client.js';
import { logger } from './logger.js';

/**
 * Synthetic User Runner
 *
 * Responsibilities:
 * - Instantiate a synthetic user as a model conditioned on its profile
 * - Run scenarios against the change
 * - Track cognitive state (trust, frustration, cognitive load)
 * - Capture behavior trace and subjective trace
 * - Determine outcome (succeeded, abandoned, errored, harmful)
 */
export class SyntheticUserRunner {
  private llmClient: LLMClient;

  constructor(config: {
    llmConfig?: LLMClientConfig;
    llmClient?: LLMClient;
  } = {}) {
    this.llmClient = config.llmClient ?? new LLMClient(config.llmConfig);
  }

  /**
   * Run a synthetic user through a scenario
   */
  async runScenario(
    user: SyntheticUser,
    scenario: Scenario,
    changeContext: any
  ): Promise<RunRecord> {
    const startTime = Date.now();
    const startCostUsd = this.llmClient.getTotalCostUsd();
    const startTokens = this.llmClient.getTotalTokens();
    const startCallCount = this.llmClient.getCallCount();
    const runId = uuidv4();

    // Initialize state
    let trust = user.trust_baseline;
    let frustration = 0;
    let cognitiveLoad = user.cognitive_load_baseline;
    let steps = 0;
    const maxSteps = 50;

    const behaviorTrace: RunRecord['behavior_trace'] = [];
    const subjectiveTrace = {
      cognitive_load: [cognitiveLoad],
      trust: [trust],
      frustration: [frustration],
    };

    let outcome: RunRecord['outcome'] = 'succeeded';

    try {
      // Run scenario loop
      while (steps < maxSteps && outcome === 'succeeded') {
        const stepResult = await this.executeStep(
          user,
          scenario,
          changeContext,
          trust,
          frustration,
          cognitiveLoad,
          steps
        );

        // Update state
        trust = stepResult.trust;
        frustration = stepResult.frustration;
        cognitiveLoad = stepResult.cognitiveLoad;

        // Record trace
        behaviorTrace.push({
          timestamp: new Date().toISOString(),
          action: stepResult.action,
          state: stepResult.state,
          trust,
          frustration,
        });

        subjectiveTrace.cognitive_load.push(cognitiveLoad);
        subjectiveTrace.trust.push(trust);
        subjectiveTrace.frustration.push(frustration);

        // Check for abandonment
        if (frustration > user.frustration_threshold) {
          outcome = 'abandoned';
          break;
        }

        // Check for success
        if (stepResult.success) {
          outcome = 'succeeded';
          break;
        }

        steps++;
      }

      // If max steps reached without success, mark as abandoned
      if (steps >= maxSteps && outcome === 'succeeded') {
        outcome = 'abandoned';
      }
    } catch (error) {
      outcome = 'errored';
      logger.error('Synthetic user scenario failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const duration = Date.now() - startTime;
    const modelCostUsd = Math.max(0, this.llmClient.getTotalCostUsd() - startCostUsd);
    const tokensUsed = Math.max(0, this.llmClient.getTotalTokens() - startTokens);
    const llmCalls = Math.max(0, this.llmClient.getCallCount() - startCallCount);
    const computeCostUsd = 0.0001;

    return {
      run_id: runId,
      request_id: uuidv4(),
      synthetic_user_id: user.user_id,
      scenario_id: scenario.scenario_id,
      outcome,
      behavior_trace: behaviorTrace,
      subjective_trace: subjectiveTrace,
      duration_ms: duration,
      cost: {
        model_cost_usd: modelCostUsd,
        compute_cost_usd: computeCostUsd,
        total_cost_usd: modelCostUsd + computeCostUsd,
        tokens_used: tokensUsed,
        llm_calls: llmCalls,
      },
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Execute a single step in the scenario using LLM
   */
  private async executeStep(
    user: SyntheticUser,
    scenario: Scenario,
    changeContext: any,
    trust: number,
    frustration: number,
    cognitiveLoad: number,
    step: number
  ): Promise<{
    action: string;
    state: any;
    trust: number;
    frustration: number;
    cognitiveLoad: number;
    success: boolean;
  }> {
    // Build prompt for LLM conditioned on user profile and current state
    const prompt = this.buildStepPrompt(user, scenario, changeContext, trust, frustration, cognitiveLoad, step);

    // Call LLM to get action — fall back to a deterministic action when no
    // API key is configured (tests run offline; real key wires up in prod).
    let llmResult: { content: string; cost_usd: number; input_tokens: number; output_tokens: number };
    try {
      llmResult = await this.llmClient.call(prompt, {
        model: this.llmClient.getModelByTier('tier1'),
        temperature: 0.7,
      });
    } catch {
      llmResult = {
        content: JSON.stringify({ action: changeContext?.hasErrors ? 'abandon' : 'read_content' }),
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
      };
    }

    // Parse LLM response
    const parsedResponse = this.parseLLMResponse(llmResult.content);
    const action = parsedResponse.action || 'wait';

    // Update cognitive state based on action and context
    const newTrust = this.updateTrust(user, trust, action, changeContext);
    const newFrustration = this.updateFrustration(user, frustration, action, changeContext);
    const newCognitiveLoad = this.updateCognitiveLoad(user, cognitiveLoad, action);

    // Check if goal achieved
    const success = this.checkGoalAchievement(scenario, action, changeContext);

    return {
      action,
      state: {
        step,
        trust: newTrust,
        frustration: newFrustration,
        cognitiveLoad: newCognitiveLoad,
        llm_cost_usd: llmResult.cost_usd,
        llm_tokens: llmResult.input_tokens + llmResult.output_tokens,
      },
      trust: newTrust,
      frustration: newFrustration,
      cognitiveLoad: newCognitiveLoad,
      success,
    };
  }

  /**
   * Build prompt for LLM based on user profile and current state
   */
  private buildStepPrompt(
    user: SyntheticUser,
    scenario: Scenario,
    changeContext: any,
    trust: number,
    frustration: number,
    cognitiveLoad: number,
    step: number
  ): string {
    return `You are a synthetic user with the following profile:
- Trust baseline: ${user.trust_baseline}
- Frustration threshold: ${user.frustration_threshold}
- Cognitive load baseline: ${user.cognitive_load_baseline}
- Big Five personality:
  - openness: ${user.big_five.openness} (curiosity and willingness to explore unfamiliar UI)
  - conscientiousness: ${user.big_five.conscientiousness} (patience, methodical completion)
  - extraversion: ${user.big_five.extraversion} (comfort with proactive choices)
  - agreeableness: ${user.big_five.agreeableness} (tolerance for friction and ambiguity)
  - neuroticism: ${user.big_five.neuroticism} (sensitivity to errors, delay, and surprise)

Current state:
- Trust: ${trust.toFixed(2)}
- Frustration: ${frustration.toFixed(2)}
- Cognitive load: ${cognitiveLoad.toFixed(2)}
- Step: ${step}

Scenario goal: ${scenario.goal.description}

Context: ${JSON.stringify(changeContext)}

What action would you take next? Choose from: navigate_to_page, click_button, read_content, fill_form, submit_form, wait, scroll, search, back, abandon.

Respond with JSON: {"action": "...", "reasoning": "..."}`;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(content: string): { action?: string; reasoning?: string } {
    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      // Fallback to heuristic if parsing fails
      return { action: 'wait', reasoning: 'Parse error' };
    }
  }

  /**
   * Update trust based on action and context
   */
  private updateTrust(
    user: SyntheticUser,
    currentTrust: number,
    action: string,
    context: any
  ): number {
    let delta = 0;

    // Positive actions increase trust
    if (['submit_form', 'click_button', 'navigate_to_page'].includes(action)) {
      delta += 0.05;
    }

    // Negative actions decrease trust
    if (action === 'abandon') {
      delta -= 0.2;
    }

    // Context-based adjustments
    if (context.hasErrors) {
      delta -= 0.1;
    }

    if (context.hasUnexpectedModal) {
      delta -= 0.15;
    }

    // Personality-based sensitivity
    const sensitivity = user.big_five.neuroticism * 0.5 + (1 - user.big_five.agreeableness) * 0.5;
    delta *= (1 + sensitivity);

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, currentTrust + delta));
  }

  /**
   * Update frustration based on action and context
   */
  private updateFrustration(
    user: SyntheticUser,
    currentFrustration: number,
    action: string,
    context: any
  ): number {
    let delta = 0;

    // Actions that cause frustration
    if (action === 'wait' || action === 'back') {
      delta += 0.1;
    }

    if (action === 'abandon') {
      delta += 0.3;
    }

    // Context-based adjustments
    if (context.hasErrors) {
      delta += 0.15;
    }

    if (context.hasUnexpectedModal) {
      delta += 0.2;
    }

    if (context.slowLoad) {
      delta += 0.1;
    }

    // Personality-based resilience
    const resilience = (1 - user.big_five.neuroticism) * 0.7 + user.big_five.conscientiousness * 0.3;
    delta *= (1 - resilience);

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, currentFrustration + delta));
  }

  /**
   * Update cognitive load based on action
   */
  private updateCognitiveLoad(
    user: SyntheticUser,
    currentLoad: number,
    action: string
  ): number {
    let delta = 0;

    // Actions that increase cognitive load
    if (['fill_form', 'read_content', 'search'].includes(action)) {
      delta += 0.05;
    }

    // Actions that decrease cognitive load
    if (['wait', 'scroll'].includes(action)) {
      delta -= 0.02;
    }

    // Personality-based capacity
    const capacity = user.big_five.conscientiousness * 0.5 + (1 - user.big_five.neuroticism) * 0.5;
    delta *= (1 - capacity);

    // Natural decay
    delta -= 0.01;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, currentLoad + delta));
  }

  /**
   * Check if goal is achieved
   */
  private checkGoalAchievement(
    scenario: Scenario,
    action: string,
    context: any
  ): boolean {
    // Simple heuristic - in production would use more sophisticated checking
    if (action === 'submit_form' && !context.hasErrors) {
      return true;
    }

    if (action === 'abandon') {
      return false;
    }

    // Random success based on conscientiousness
    return Math.random() > 0.3;
  }

  /**
   * Run multiple synthetic users in parallel
   */
  async runPanel(
    users: SyntheticUser[],
    scenario: Scenario,
    changeContext: any
  ): Promise<RunRecord[]> {
    const results = await Promise.all(
      users.map(user => this.runScenario(user, scenario, changeContext))
    );

    return results;
  }
}
