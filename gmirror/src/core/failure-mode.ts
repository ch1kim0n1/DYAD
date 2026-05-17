import { v4 as uuidv4 } from 'uuid';
import {
  FailureMode,
  RunRecord,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';
import { logger } from './logger.js';

/**
 * Failure-Mode Extractor
 *
 * Responsibilities:
 * - Detect and structure new failure modes from runs
 * - Identify novel failure patterns
 * - Propose new scenarios to catch failure modes
 * - Maintain failure-mode library
 */
export class FailureModeExtractor {
  private failureModeLibrary: Map<string, FailureMode>;
  private llmClient: LLMClient;

  constructor(config: { llmClient?: LLMClient } = {}) {
    this.failureModeLibrary = new Map();
    this.llmClient = config.llmClient ?? new LLMClient();
    this.initializeDefaultFailureModes();
  }

  /**
   * Initialize with common failure modes
   */
  private initializeDefaultFailureModes(): void {
    const defaultModes: FailureMode[] = [
      {
        failure_mode_id: uuidv4(),
        description: 'User abandons due to unexpected modal',
        trigger_pattern: 'unexpected_modal',
        affected_personas: ['novice_mobile_user_low_trust', 'frustrated_power_user'],
        affected_scenarios: [],
        severity: 'medium',
        first_observed: new Date().toISOString(),
        observation_count: 1,
        scenarios_that_catch_it: ['modal_test'],
      },
      {
        failure_mode_id: uuidv4(),
        description: 'User cannot find primary action button',
        trigger_pattern: 'button_not_found',
        affected_personas: ['novice_mobile_user_low_trust', 'casual_explorer'],
        affected_scenarios: [],
        severity: 'high',
        first_observed: new Date().toISOString(),
        observation_count: 1,
        scenarios_that_catch_it: ['navigation_test'],
      },
      {
        failure_mode_id: uuidv4(),
        description: 'Form validation error causes abandonment',
        trigger_pattern: 'validation_error',
        affected_personas: ['time_pressed_executive', 'frustrated_power_user'],
        affected_scenarios: [],
        severity: 'medium',
        first_observed: new Date().toISOString(),
        observation_count: 1,
        scenarios_that_catch_it: ['form_test'],
      },
      {
        failure_mode_id: uuidv4(),
        description: 'User confused by ambiguous terminology',
        trigger_pattern: 'ambiguous_terminology',
        affected_personas: ['novice_mobile_user_low_trust', 'casual_explorer'],
        affected_scenarios: [],
        severity: 'low',
        first_observed: new Date().toISOString(),
        observation_count: 1,
        scenarios_that_catch_it: ['comprehension_test'],
      },
    ];

    for (const mode of defaultModes) {
      this.failureModeLibrary.set(mode.failure_mode_id, mode);
    }
  }

  /**
   * Extract failure modes from run records
   */
  extractFailureModes(runRecords: RunRecord[]): FailureMode[] {
    const detected: FailureMode[] = [];

    for (const record of runRecords) {
      if (record.outcome === 'succeeded') {
        continue;
      }

      // Analyze behavior trace for patterns
      const patterns = this.analyzeBehaviorTrace(record);
      
      for (const pattern of patterns) {
        const existingMode = this.findMatchingFailureMode(pattern);
        
        if (existingMode) {
          // Update existing failure mode
          existingMode.observation_count += 1;
          this.failureModeLibrary.set(existingMode.failure_mode_id, existingMode);
        } else {
          // Create new failure mode
          const newMode = this.createFailureMode(pattern, record);
          this.failureModeLibrary.set(newMode.failure_mode_id, newMode);
          detected.push(newMode);
        }
      }
    }

    return detected;
  }

  /**
   * Analyze behavior trace for failure patterns
   */
  private analyzeBehaviorTrace(record: RunRecord): string[] {
    const patterns: string[] = [];

    // Check for abandonment patterns
    if (record.outcome === 'abandoned') {
      const lastActions = record.behavior_trace.slice(-5);
      
      if (lastActions.some(a => a.action === 'back')) {
        patterns.push('navigation_loop');
      }
      
      if (lastActions.some(a => a.action === 'wait')) {
        patterns.push('slow_response');
      }
      
      const highFrustration = record.subjective_trace.frustration.some(f => f > 0.7);
      if (highFrustration) {
        patterns.push('high_frustration_abandonment');
      }
    }

    // Check for error patterns
    if (record.outcome === 'errored') {
      patterns.push('execution_error');
    }

    // Check for harmful patterns
    if (record.outcome === 'harmful') {
      patterns.push('harmful_outcome');
    }

    return patterns;
  }

  /**
   * Find matching failure mode in library
   */
  private findMatchingFailureMode(pattern: string): FailureMode | undefined {
    for (const mode of this.failureModeLibrary.values()) {
      if (mode.trigger_pattern === pattern || mode.description.toLowerCase().includes(pattern.toLowerCase())) {
        return mode;
      }
    }
    return undefined;
  }

  /**
   * Create a new failure mode
   */
  private createFailureMode(pattern: string, record: RunRecord): FailureMode {
    return {
      failure_mode_id: uuidv4(),
      description: `Failure pattern: ${pattern}`,
      trigger_pattern: pattern,
      affected_personas: [], // Would be inferred from user
      affected_scenarios: [record.scenario_id],
      severity: this.inferSeverity(pattern),
      first_observed: new Date().toISOString(),
      observation_count: 1,
      scenarios_that_catch_it: [],
    };
  }

  /**
   * Infer severity from pattern
   */
  private inferSeverity(pattern: string): FailureMode['severity'] {
    if (pattern.includes('harmful') || pattern.includes('critical') || pattern.includes('security')) {
      return 'critical';
    }
    if (pattern.includes('abandonment') || pattern.includes('error')) {
      return 'high';
    }
    if (pattern.includes('confusion') || pattern.includes('ambiguous')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Propose new scenarios to catch failure modes
   */
  proposeScenarios(failureMode: FailureMode): string[] {
    const scenarios: string[] = [];

    switch (failureMode.trigger_pattern) {
      case 'unexpected_modal':
        scenarios.push('Test with modal appearing at various points in flow');
        scenarios.push('Test modal dismissibility and clarity');
        break;
      case 'button_not_found':
        scenarios.push('Test button visibility and contrast');
        scenarios.push('Test button placement conventions');
        break;
      case 'validation_error':
        scenarios.push('Test form with various invalid inputs');
        scenarios.push('Test error message clarity and helpfulness');
        break;
      case 'ambiguous_terminology':
        scenarios.push('Test with users of varying expertise levels');
        scenarios.push('Test terminology comprehension');
        break;
      default:
        scenarios.push(`Test scenario targeting ${failureMode.trigger_pattern}`);
    }

    return scenarios;
  }

  /**
   * Get all failure modes
   */
  getAllFailureModes(): FailureMode[] {
    return Array.from(this.failureModeLibrary.values());
  }

  /**
   * Alias for getAllFailureModes
   */
  getLibrary(): FailureMode[] {
    return this.getAllFailureModes();
  }

  /**
   * Extract failure modes from runs using an LLM to identify and classify
   * patterns across failed traces. Falls back to deterministic grouping when
   * an LLM client is unavailable.
   */
  async extractFromRuns(runs: RunRecord[]): Promise<FailureMode[]> {
    const failedRuns = runs.filter(r => r.outcome !== 'succeeded');
    if (failedRuns.length === 0) return [];

    try {
      const modes = await this.extractWithLLM(failedRuns);
      if (modes.length > 0) return modes;
    } catch (error) {
      logger.warn('LLM extraction failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.extractWithMechanicalFallback(failedRuns);
  }

  private async extractWithLLM(failedRuns: RunRecord[]): Promise<FailureMode[]> {
    const prompt = this.buildFailureExtractionPrompt(failedRuns);
    const model = this.llmClient.getModelByTier('tier1');
    const result = await this.llmClient.call(prompt, { model, temperature: 0.2 });
    const parsed = JSON.parse(result.content);
    const rawModes = Array.isArray(parsed) ? parsed : parsed.failure_modes;
    if (!Array.isArray(rawModes)) return [];

    const allPersonas = [...new Set(failedRuns.map(r => r.synthetic_user_id))];
    const allScenarios = [...new Set(failedRuns.map(r => r.scenario_id))];
    const firstObserved = failedRuns
      .map(r => r.created_at)
      .sort()[0] || new Date().toISOString();

    return rawModes.map((mode: Record<string, unknown>) => {
      const observationCount = typeof mode.observation_count === 'number'
        ? Math.max(1, Math.floor(mode.observation_count))
        : failedRuns.length;
      const affectedPersonas = this.toStringArray(mode.affected_personas, allPersonas);
      const affectedScenarios = this.toStringArray(mode.affected_scenarios, allScenarios);

      return {
        failure_mode_id: uuidv4(),
        description: String(mode.description || 'LLM-identified failure mode'),
        trigger_pattern: String(mode.trigger_pattern || 'llm_identified_failure'),
        affected_personas: affectedPersonas,
        affected_scenarios: affectedScenarios,
        severity: this.normalizeSeverity(mode.severity),
        first_observed: firstObserved,
        observation_count: observationCount,
        scenarios_that_catch_it: this.toStringArray(mode.scenarios_that_catch_it, affectedScenarios),
      };
    });
  }

  private buildFailureExtractionPrompt(failedRuns: RunRecord[]): string {
    const summaries = failedRuns.map((run, index) => ({
      run_id: run.run_id,
      index,
      synthetic_user_id: run.synthetic_user_id,
      scenario_id: run.scenario_id,
      outcome: run.outcome,
      actions: run.behavior_trace.map(step => step.action),
      final_trust: run.subjective_trace.trust.at(-1) ?? 0,
      final_frustration: run.subjective_trace.frustration.at(-1) ?? 0,
      final_cognitive_load: run.subjective_trace.cognitive_load.at(-1) ?? 0,
    }));

    return `Identify recurring GMirror UX failure modes from these failed synthetic-user runs.

${JSON.stringify(summaries, null, 2)}

Group semantically similar failures even when action sequences differ. Return strict JSON:
{
  "failure_modes": [
    {
      "description": "brief human-readable failure",
      "trigger_pattern": "short_snake_case_pattern",
      "severity": "low" | "medium" | "high" | "critical",
      "observation_count": 1,
      "affected_personas": ["synthetic_user_id"],
      "affected_scenarios": ["scenario_id"],
      "scenarios_that_catch_it": ["scenario_id"]
    }
  ]
}`;
  }

  private toStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    const strings = value.filter((item): item is string => typeof item === 'string');
    return strings.length > 0 ? strings : fallback;
  }

  private normalizeSeverity(value: unknown): FailureMode['severity'] {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
      ? value
      : 'medium';
  }

  private extractWithMechanicalFallback(failedRuns: RunRecord[]): FailureMode[] {
    const clusters = new Map<string, RunRecord[]>();
    for (const run of failedRuns) {
      if (run.behavior_trace.length === 0) continue;
      const lastActions = run.behavior_trace.slice(-3).map(t => t.action);
      const key = lastActions.join('→');
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(run);
    }

    const modes: FailureMode[] = [];
    for (const [pattern, clusterRuns] of clusters) {
      if (clusterRuns.length < 2) continue;
      const count = clusterRuns.length;

      const severity: FailureMode['severity'] =
        count >= 10 ? 'critical' : count >= 5 ? 'high' : count >= 3 ? 'medium' : 'low';

      modes.push({
        failure_mode_id: uuidv4(),
        description: `Repeated failure pattern: ${pattern}`,
        trigger_pattern: pattern,
        affected_personas: [...new Set(clusterRuns.map(r => r.synthetic_user_id))],
        affected_scenarios: [...new Set(clusterRuns.map(r => r.scenario_id))],
        severity,
        first_observed: clusterRuns[0].created_at,
        observation_count: count,
        scenarios_that_catch_it: [...new Set(clusterRuns.map(r => r.scenario_id))],
      });
    }

    return modes;
  }

  /**
   * Get failure mode by ID
   */
  getFailureMode(failureModeId: string): FailureMode | undefined {
    return this.failureModeLibrary.get(failureModeId);
  }

  /**
   * Classify failure using LLM
   */
  private async classifyFailureWithLLM(
    pattern: string,
    clusterRuns: RunRecord[]
  ): Promise<{ description: string; severity: FailureMode['severity'] }> {
    const prompt = this.buildFailureClassificationPrompt(pattern, clusterRuns);
    const model = this.llmClient.getModelByTier('tier1');

    const result = await this.llmClient.call(prompt, { model, temperature: 0.3 });

    const parsed = JSON.parse(result.content);
    return {
      description: parsed.description || `Failure pattern: ${pattern}`,
      severity: parsed.severity || 'medium',
    };
  }

  /**
   * Build prompt for failure classification
   */
  private buildFailureClassificationPrompt(
    pattern: string,
    clusterRuns: RunRecord[]
  ): string {
    const affectedPersonas = [...new Set(clusterRuns.map(r => r.synthetic_user_id))].join(', ');
    const affectedScenarios = [...new Set(clusterRuns.map(r => r.scenario_id))].join(', ');
    const count = clusterRuns.length;

    return `Analyze the following failure pattern and classify it:

PATTERN: ${pattern}
OCCURRENCES: ${count}
AFFECTED PERSONAS: ${affectedPersonas}
AFFECTED SCENARIOS: ${affectedScenarios}

Return a JSON object:
{
  "description": "<brief description of what this failure represents>",
  "severity": "low" | "medium" | "high" | "critical"
}`;
  }

  /**
   * Consolidate redundant failure modes
   */
  consolidateFailureModes(): void {
    const modes = Array.from(this.failureModeLibrary.values());
    const toRemove: string[] = [];

    for (let i = 0; i < modes.length; i++) {
      for (let j = i + 1; j < modes.length; j++) {
        if (this.areSimilar(modes[i], modes[j])) {
          // Merge j into i
          modes[i].observation_count += modes[j].observation_count;
          modes[i].affected_personas = [...new Set([...modes[i].affected_personas, ...modes[j].affected_personas])];
          modes[i].affected_scenarios = [...new Set([...modes[i].affected_scenarios, ...modes[j].affected_scenarios])];
          toRemove.push(modes[j].failure_mode_id);
        }
      }
    }

    for (const id of toRemove) {
      this.failureModeLibrary.delete(id);
    }
  }

  /**
   * Check if two failure modes are similar
   */
  private areSimilar(a: FailureMode, b: FailureMode): boolean {
    const patternMatch = a.trigger_pattern === b.trigger_pattern;
    const descriptionSimilarity = this.stringSimilarity(a.description, b.description) > 0.8;
    
    return patternMatch || descriptionSimilarity;
  }

  /**
   * Calculate string similarity
   */
  private stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get failure modes by severity
   */
  getFailureModesBySeverity(severity: FailureMode['severity']): FailureMode[] {
    return Array.from(this.failureModeLibrary.values()).filter(m => m.severity === severity);
  }

  /**
   * Get failure modes by persona
   */
  getFailureModesByPersona(personaLabel: string): FailureMode[] {
    return Array.from(this.failureModeLibrary.values()).filter(
      m => m.affected_personas.includes(personaLabel)
    );
  }
}
