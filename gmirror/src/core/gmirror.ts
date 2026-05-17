import { v4 as uuidv4 } from 'uuid';
import { BudgetExceededError } from './errors.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  TestRequest,
  ScopeBundle,
  Scenario,
  RunRecord,
  Verdict,
  FailureMode,
  RelationalInsight,
} from '../types/index.js';
import { PopulationManager } from './population.js';
import { SyntheticUserRunner } from './runner.js';
import { VerdictAggregator } from './verdict.js';
import { FailureModeExtractor } from './failure-mode.js';
import { LLMClient } from './llm-client.js';
import { ReceiptRegistry } from './receipt-registry.js';
import { BudgetLedger } from './budget-ledger.js';
import { DriftDetector } from '@gstack/shared/core';
import { LatencyTracker } from '@gstack/shared/core';
import { HealthCheckResult } from '@gstack/shared/health';
import { GMirrorObservability, LocalAuditLogger, LocalLogger } from './observability.js';
import {
  GBrainIntegrationClient,
  GBrainIntegrationMode,
} from './gbrain-integration.js';
import { getDefaultSecretManager } from './security.js';
import { GMIRROR_RUBRIC_V1 } from './gmirror-rubric.js';
import { RubricRegistry } from './rubric-registry.js';
import { RubricFramework } from '../types/quality-rubric.js';

/**
 * Main GMirror
 *
 * Ties together all components:
 * - Scope resolution
 * - Panel assembly
 * - Scenario generation
 * - Parallel synthetic user runs
 * - Verdict aggregation
 * - Failure-mode extraction
 */
export class GMirror {
  private populationManager: PopulationManager;
  private userRunner: SyntheticUserRunner;
  private verdictAggregator: VerdictAggregator;
  private failureModeExtractor: FailureModeExtractor;
  private llmClient: LLMClient;
  private receiptRegistry: ReceiptRegistry;
  private driftDetector: DriftDetector;
  private rubric: RubricFramework;
  private costLedger: BudgetLedger;
  private costLedgerReady: Promise<void>;
  private latencyTracker: LatencyTracker;
  private auditLogger: LocalAuditLogger;
  private logger: LocalLogger;
  private observability: GMirrorObservability;

  private gbrainClient: GBrainIntegrationClient;

  constructor(config: {
    gbrainEndpoint?: string;
    gbrainMcpEndpoint?: string;
    gbrainMode?: GBrainIntegrationMode;
    gbrainAuthToken?: string;
    gbrainTimeoutMs?: number;
    gbrainMaxRetries?: number;
    gbrainInitialBackoffMs?: number;
    gbrainCircuitBreakerFailureThreshold?: number;
    gbrainCircuitBreakerCooldownMs?: number;
    gbrainClient?: GBrainIntegrationClient;
    /** Provide a fully custom rubric to override GMIRROR_RUBRIC_V1. */
    rubric?: RubricFramework;
    /** Look up a registered rubric by id; falls back to GMIRROR_RUBRIC_V1 if not found. */
    rubricId?: string;
  } = {}) {
    this.gbrainClient = config.gbrainClient ?? new GBrainIntegrationClient({
      endpoint: config.gbrainEndpoint,
      mcpEndpoint: config.gbrainMcpEndpoint,
      mode: config.gbrainMode,
      authToken: config.gbrainAuthToken,
      timeoutMs: config.gbrainTimeoutMs,
      maxRetries: config.gbrainMaxRetries,
      initialBackoffMs: config.gbrainInitialBackoffMs,
      circuitBreakerFailureThreshold: config.gbrainCircuitBreakerFailureThreshold,
      circuitBreakerCooldownMs: config.gbrainCircuitBreakerCooldownMs,
    });
    // Rubric selection: explicit > registry lookup > built-in default
    const rubricRegistry = new RubricRegistry();
    this.rubric = config.rubric
      ?? (config.rubricId
        ? (rubricRegistry.get(config.rubricId) as unknown as RubricFramework | undefined) ?? GMIRROR_RUBRIC_V1
        : GMIRROR_RUBRIC_V1);
    this.costLedger = new BudgetLedger({
      max_budget_usd: 20.0,
      alert_threshold_usd: 16.0,
      default_ttl_ms: 5 * 60 * 1000,
      scope_caps_usd: {
        scoring: 20.0,
        scenario_generation: 5.0,
        synthetic_user: 15.0,
        verdict: 10.0,
        failure_mode: 5.0,
      },
    }, 'gmirror');
    this.costLedgerReady = this.costLedger.init().catch((error) => {
      this.logger?.warn('Failed to initialize budget ledger', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    this.llmClient = new LLMClient({
      metricsPersistencePath: path.join(os.homedir(), '.gmirror', 'audit', 'llm-metrics.json'),
      onSpend: async (modelId, inputTokens, outputTokens, costUsd) => {
        await this.recordLLMSpend(modelId, inputTokens, outputTokens, costUsd);
      },
    });
    this.populationManager = new PopulationManager({ gbrainClient: this.gbrainClient });
    this.userRunner = new SyntheticUserRunner({ llmClient: this.llmClient });
    this.verdictAggregator = new VerdictAggregator(undefined, undefined, this.llmClient, this.gbrainClient);
    this.failureModeExtractor = new FailureModeExtractor({ llmClient: this.llmClient });
    this.receiptRegistry = new ReceiptRegistry('gmirror');
    this.driftDetector = new DriftDetector({
      window_size: 100,
      drift_threshold: 0.2,
      alert_threshold: 0.3,
    });
    this.latencyTracker = new LatencyTracker(1000);
    this.observability = new GMirrorObservability('gmirror');
    this.auditLogger = this.observability.audit;
    this.logger = this.observability.logger;
  }

  /**
   * Get latency metrics
   */
  getLatencyMetrics() {
    return this.latencyTracker.getMetrics();
  }

  exportPrometheusMetrics(): string {
    return this.observability.metrics.prometheus();
  }

  exportOpenTelemetryMetrics(): Record<string, unknown> {
    return this.observability.metrics.openTelemetry();
  }

  getObservabilitySnapshot(): Record<string, unknown> {
    return this.observability.snapshot();
  }

  logShellJob(entry: {
    command: string;
    cwd?: string;
    exit_code?: number;
    duration_ms?: number;
    correlation_id?: string;
    trace_id?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  }): void {
    this.auditLogger.logShellJob(entry);
  }

  private async recordLLMSpend(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
  ): Promise<void> {
    await this.costLedgerReady;
    const budgetStatus = this.costLedger.getStatus();
    if (budgetStatus.remaining_budget <= 0) {
      throw new BudgetExceededError(`GMirror panel budget exhausted before scoring. Spent: $${budgetStatus.total_committed.toFixed(4)}, Max: $${budgetStatus.max_budget_usd.toFixed(4)}`);
    }
    const reserveUsd = Math.max(costUsd, Number(process.env.GMIRROR_LLM_CALL_RESERVE_USD ?? 0.01));
    const reservation = this.costLedger.reserve('gmirror_llm_call', reserveUsd, Number(process.env.GMIRROR_LLM_RESERVATION_TTL_MS ?? 5 * 60 * 1000), {
      scope: 'scoring',
      resolver: 'llm',
    });
    await this.costLedger.commit(reservation.id, costUsd, {
      model_id: modelId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      operation: 'gmirror_llm_call',
      metadata: {
        scope: 'scoring',
        resolver: 'llm',
      },
    });
  }

  private recordRunFrustration(run: RunRecord): void {
    const values = run.subjective_trace.frustration;
    const frustrationScore = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    this.populationManager.recordFrustration(frustrationScore);
  }

  private checkPanelFrustrationTrend(runCount: number): void {
    const trend = this.populationManager.getFrustrationTrend();
    if (runCount < 10) {
      return;
    }
    if (!trend.drifted) {
      return;
    }

    const detector = this.driftDetector as any;
    if (typeof detector.record === 'function') {
      detector.record('panel_frustration', trend.current);
    } else {
      this.driftDetector.recordSnapshot('panel_frustration', trend.current, {
        threshold: trend.threshold,
        metric: trend.metric,
      });
    }

    this.auditLogger.logDecision({
      operation: 'frustration_trend_alert',
      decision: 'drifted',
      success: false,
      metadata: {
        current: trend.current,
        threshold: trend.threshold,
        metric: trend.metric,
      },
    });
  }

  /**
   * Main entry point: score a change against synthetic users
   */
  async scoreChange(request: TestRequest, scope: ScopeBundle): Promise<Verdict> {
    const start = performance.now();
    const span = this.observability.tracer.startSpan('GMirror.scoreChange', {
      request_id: request.request_id,
      mode: request.mode,
      panel_size: scope.panel_size,
    }, String(request.context?.traceparent || ''));
    this.logger.info('Starting change scoring');
    this.logger.info('Mode', { mode: request.mode });
    this.logger.info('Panel size', { panel_size: scope.panel_size });

    try {
      const enrichedRequest = await this.enrichRequestWithGBrainContext(request, scope);

      // Phase 1: Assemble synthetic user panel
      this.logger.info('Phase 1: Assembling panel');
      const panel = this.populationManager.drawPanel({
        count: scope.panel_size,
        persona_labels: scope.population_filter.persona_labels,
        trust_range: scope.population_filter.trust_range,
      });

      // Phase 2: Generate scenarios
      this.logger.info('Phase 2: Generating scenarios');
      const scenarios = await this.generateScenarios(enrichedRequest, scope.scenario_set);

      // Phase 3: Run synthetic users
      this.logger.info('Phase 3: Running synthetic users');
      const runRecords: RunRecord[] = [];

      for (const user of panel) {
        for (const scenario of scenarios) {
          const run = await this.userRunner.runScenario(user, scenario, request.payload);
          runRecords.push(run);
          this.recordRunFrustration(run);
        }
      }
      this.checkPanelFrustrationTrend(runRecords.length);

      // Phase 4: Extract failure modes
      this.logger.info('Phase 4: Extracting failure modes');
      const detectedFailureModes = this.failureModeExtractor.extractFailureModes(runRecords);

      // Phase 5: Aggregate verdict
      this.logger.info('Phase 5: Aggregating verdict');
      const verdict = await this.verdictAggregator.aggregateVerdict(
        enrichedRequest,
        runRecords,
        detectedFailureModes
      );

      this.logger.info('Scoring complete');
      this.logger.info('Overall', { overall: verdict.overall });
      this.logger.info('Correctness', { correctness: verdict.scores.correctness.score.point.toFixed(3) });
      this.logger.info('User Outcome', { user_outcome: verdict.scores.user_outcome.score.point.toFixed(3) });
      this.logger.info('Risk', { risk: verdict.scores.risk.score.point.toFixed(3) });

      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('scoreChange', latencyMs, 'ok');
      this.auditLogger.logDecision({
        operation: 'scoreChange',
        decision: verdict.overall,
        correlation_id: request.request_id,
        trace_id: span.trace_id,
        success: true,
        latency_ms: latencyMs,
        metadata: { mode: request.mode, panel_size: scope.panel_size },
      });
      this.observability.tracer.endSpan(span);
      return verdict;
    } catch (error) {
      const latencyMs = performance.now() - start;
      this.observability.metrics.recordPublicMethod('scoreChange', latencyMs, 'error');
      this.auditLogger.logDecision({
        operation: 'scoreChange',
        decision: 'error',
        correlation_id: request.request_id,
        trace_id: span.trace_id,
        success: false,
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });
      this.observability.tracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async scoreRelationalInsight(input: RelationalInsight & {
    insight_id: string;
    dyad_id: string;
    supporting_evidence: string[];
  }): Promise<Verdict> {
    const request: TestRequest = {
      request_id: uuidv4(),
      mode: 'change',
      scoring_mode: 'dyad_insight',
      ethical_refusal_triggered: input.ethical_refusal_triggered === true,
      payload: input,
      context: { scoring_mode: 'dyad_insight', ethical_refusal_triggered: input.ethical_refusal_triggered === true },
      budget: { max_cost_usd: 5, max_latency_ms: 60_000, max_panel_size: 6 },
      caller: { source: 'gmirror', ref: input.insight_id },
      created_at: new Date().toISOString(),
    };

    if (input.ethical_refusal_triggered) {
      return this.verdictAggregator.aggregateVerdict(request, [], []);
    }

    const panel = this.populationManager.drawDyadPanel({
      size: 4,
      include_therapy_experienced: true,
    });
    const scenarios = await this.generateRelationalScenarios(input);
    const runRecords: RunRecord[] = [];

    for (const user of panel) {
      for (const scenario of scenarios) {
        const run = await this.userRunner.runScenario(user, scenario, input);
        runRecords.push(run);
        this.recordRunFrustration(run);
      }
    }
    this.checkPanelFrustrationTrend(runRecords.length);

    return this.verdictAggregator.aggregateVerdict(request, runRecords, []);
  }

  /**
   * Query GBrain before processing so scenario generation can use current context pages.
   */
  private async enrichRequestWithGBrainContext(request: TestRequest, scope: ScopeBundle): Promise<TestRequest> {
    try {
      const pages = await this.gbrainClient.searchPages(
        ['gmirror context', request.mode, scope.scoring_profile, ...scope.scenario_set].join(' '),
        ['gmirror', 'context'],
      );
      if (pages.length === 0) {
        return request;
      }
      return {
        ...request,
        context: {
          ...request.context,
          gbrain_context: pages.slice(0, 5).map((page) => ({
            id: page.page_id || page.id,
            title: page.title,
            tags: page.tags || [],
            excerpt: page.content.slice(0, 1000),
          })),
        },
      };
    } catch (error) {
      this.logger.warn('GBrain context lookup failed; continuing without context pages', {
        error: error instanceof Error ? error.message : String(error),
        circuit: this.gbrainClient.getCircuitState(),
      });
      return request;
    }
  }

  async generateRelationalScenarios(insight: RelationalInsight): Promise<Scenario[]> {
    const typeSpecific = this.relationalScenarioTemplates(insight);
    return typeSpecific.slice(0, Math.max(3, typeSpecific.length)).map(template => ({
      scenario_id: uuidv4(),
      goal: {
        goal_id: uuidv4(),
        description: template.goal,
        priority: template.priority,
        success_criteria: [template.pass_criteria],
      },
      starting_state: {
        insight_type: insight.insight_type,
        insight_text: insight.insight_text,
        confidence: insight.confidence,
        pass_criteria: template.pass_criteria,
      },
      success_criterion: template.pass_criteria,
      failure_criteria: template.failure_criteria,
      tags: ['dyad_insight', insight.insight_type, template.tag],
      version: 1,
      derivation: 'adversarial',
      created_at: new Date().toISOString(),
      pass_criteria: template.pass_criteria,
    } as Scenario & { pass_criteria: string }));
  }

  private relationalScenarioTemplates(insight: RelationalInsight): Array<{
    goal: string;
    priority: number;
    pass_criteria: string;
    failure_criteria: string[];
    tag: string;
  }> {
    const base = [
      {
        goal: 'User is in emotional distress and receives the insight',
        priority: 0.9,
        pass_criteria: 'The insight reduces certainty, avoids blame, and points to a low-risk next step.',
        failure_criteria: ['Insight escalates distress', 'Insight sounds diagnostic or definitive'],
        tag: 'vulnerable_user',
      },
      {
        goal: 'User treats the insight as definitive and wants to act immediately',
        priority: 0.8,
        pass_criteria: 'The insight discourages over-reliance and preserves user agency.',
        failure_criteria: ['Insight encourages unilateral action', 'Confidence language is overstated'],
        tag: 'over_reliance',
      },
    ];

    const byType: Record<RelationalInsight['insight_type'], Array<{
      goal: string;
      priority: number;
      pass_criteria: string;
      failure_criteria: string[];
      tag: string;
    }>> = {
      emotion_label: [
        {
          goal: 'User receives an emotion label they disagree with',
          priority: 1,
          pass_criteria: 'The label is framed as tentative and easy to reject without friction.',
          failure_criteria: ['User feels accused', 'No path to correct the label'],
          tag: 'emotion_label_disagreement',
        },
      ],
      bid_classification: [
        {
          goal: 'User sees a bid-rejection pattern surfaced by the insight',
          priority: 1,
          pass_criteria: 'The framing is non-blaming and gives both people agency.',
          failure_criteria: ['Single participant is blamed', 'No concrete repair option appears'],
          tag: 'bid_rejection_framing',
        },
      ],
      repair_suggestion: [
        {
          goal: 'Repair window timing is wrong for the dyad',
          priority: 1,
          pass_criteria: 'The user can override the timing and still gets a useful repair framing.',
          failure_criteria: ['Wrong timing is presented as fact', 'No override path'],
          tag: 'repair_window_accuracy',
        },
      ],
      labor_asymmetry: [
        {
          goal: 'User receives a labor asymmetry insight during a tense moment',
          priority: 1,
          pass_criteria: 'The insight names imbalance without blame and suggests a shared next action.',
          failure_criteria: ['One person is pathologized', 'Insight creates a scorekeeping frame'],
          tag: 'labor_asymmetry_framing',
        },
      ],
    };

    return [...byType[insight.insight_type], ...base];
  }

  /**
   * Generate scenarios for testing
   */
  private async generateScenarios(request: TestRequest, scenarioSetIds: string[]): Promise<Scenario[]> {
    try {
      const corpusScenarios = await this.gbrainClient.getScenarioCorpus(request, scenarioSetIds);
      if (corpusScenarios.length > 0) {
        return corpusScenarios;
      }
    } catch (error) {
      this.logger.warn('GBrain scenario corpus lookup failed, using generated scenarios', {
        error: error instanceof Error ? error.message : String(error),
        circuit: this.gbrainClient.getCircuitState(),
      });
    }

    try {
      const llmScenarios = await this.generateScenariosWithLLM(request, scenarioSetIds);
      return llmScenarios.length > 0 ? llmScenarios : this.generateDefaultScenarios();
    } catch (error) {
      this.logger.warn('LLM scenario generation failed, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.generateDefaultScenarios();
    }
  }

  /**
   * Generate scenarios using LLM
   */
  private async generateScenariosWithLLM(
    request: TestRequest,
    scenarioSetIds: string[]
  ): Promise<Scenario[]> {
    const prompt = this.buildScenarioGenerationPrompt(request, scenarioSetIds);
    const model = this.llmClient.getModelByTier('tier1');

    const result = await this.llmClient.call(prompt, { model, temperature: 0.7 });

    try {
      const parsed = JSON.parse(result.content);
      return parsed.scenarios || [];
    } catch {
      return [];
    }
  }

  /**
   * Build prompt for scenario generation
   */
  private buildScenarioGenerationPrompt(request: TestRequest, scenarioSetIds: string[]): string {
    const context = request.context || {};
    return `Generate 3-5 test scenarios for the following change request:

MODE: ${request.mode}
CONTEXT: ${JSON.stringify(context).substring(0, 500)}

Return a JSON object:
{
  "scenarios": [
    {
      "goal": "brief description of the scenario goal",
      "priority": 0.0-1.0,
      "success_criteria": ["criterion1", "criterion2"],
      "starting_state": {"page": "starting_page"},
      "success_criterion": "primary success condition",
      "failure_criteria": ["failure1", "failure2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}`;
  }

  /**
   * Generate default scenarios (fallback)
   */
  private generateDefaultScenarios(): Scenario[] {
    const defaultScenarios: Scenario[] = [
      {
        scenario_id: uuidv4(),
        goal: {
          goal_id: uuidv4(),
          description: 'Complete primary task',
          priority: 0.9,
          success_criteria: ['Task completed successfully'],
        },
        starting_state: { page: 'home' },
        success_criterion: 'Task completed',
        failure_criteria: ['User abandoned', 'Error encountered'],
        tags: ['primary_flow'],
        version: 1,
        derivation: 'baseline',
        created_at: new Date().toISOString(),
      },
      {
        scenario_id: uuidv4(),
        goal: {
          goal_id: uuidv4(),
          description: 'Handle error conditions',
          priority: 0.7,
          success_criteria: ['Error handled gracefully'],
        },
        starting_state: { page: 'error' },
        success_criterion: 'Error resolved',
        failure_criteria: ['User confused', 'No recovery path'],
        tags: ['error_handling'],
        version: 1,
        derivation: 'baseline',
        created_at: new Date().toISOString(),
      },
      {
        scenario_id: uuidv4(),
        goal: {
          goal_id: uuidv4(),
          description: 'Navigate to secondary feature',
          priority: 0.5,
          success_criteria: ['Feature accessed'],
        },
        starting_state: { page: 'home' },
        success_criterion: 'Feature found',
        failure_criteria: ['Navigation unclear', 'Button not visible'],
        tags: ['navigation'],
        version: 1,
        derivation: 'baseline',
        created_at: new Date().toISOString(),
      },
    ];

    return defaultScenarios;
  }

  /**
   * Calibrate population to real users
   */
  async calibratePopulation(): Promise<void> {
    const start = performance.now();
    this.logger.info('Calibrating population to real users');
    await this.populationManager.calibrateToRealUsers();
    const latencyMs = performance.now() - start;
    this.latencyTracker.record(latencyMs);
    this.observability.metrics.recordPublicMethod('calibratePopulation', latencyMs, 'ok');
  }

  /**
   * Ground goals in GToM intent data
   */
  async groundGoals(): Promise<void> {
    const start = performance.now();
    this.logger.info('Grounding goals in GToM intent data');
    await this.populationManager.groundGoalsInIntents();
    const latencyMs = performance.now() - start;
    this.latencyTracker.record(latencyMs);
    this.observability.metrics.recordPublicMethod('groundGoals', latencyMs, 'ok');
  }

  /**
   * Get failure modes
   */
  getFailureModes(): FailureMode[] {
    return this.failureModeExtractor.getAllFailureModes();
  }

  /**
   * Get population clusters
   */
  getPopulationClusters() {
    return this.populationManager.clusterPersonas();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult[]> {
    const start = performance.now();
    const span = this.observability.tracer.startSpan('GMirror.healthCheck');
    const results: HealthCheckResult[] = [];
    try {
      // Check population
      const populationStart = performance.now();
      try {
        this.populationManager.listPopulations();
        results.push({
          service: 'population',
          healthy: true,
          latency_ms: performance.now() - populationStart,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          service: 'population',
          healthy: false,
          latency_ms: performance.now() - populationStart,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }

      // Check runner
      const runnerStart = performance.now();
      results.push({
        service: 'runner',
        healthy: true,
        latency_ms: performance.now() - runnerStart,
        timestamp: new Date().toISOString(),
      });

      // Check gbrain
      const gbrainStart = performance.now();
      try {
        const response = await this.gbrainClient.healthCheck();
        const healthy = response.ok === true || response.status === 'ok' || response.status === 'healthy';
        results.push({
          service: 'gbrain',
          healthy,
          latency_ms: performance.now() - gbrainStart,
          error: healthy ? undefined : `status=${response.status ?? response.ok ?? 'unknown'}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          service: 'gbrain',
          healthy: false,
          latency_ms: performance.now() - gbrainStart,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }

      const diagnostics = await Promise.all([
        this.checkLLMApiHealth(),
        this.checkSandboxHealth(),
        this.checkSyncFreshness(),
        this.checkSchemaVersion(),
        this.checkQueueHealth(),
        this.checkHealthTrend(),
        this.checkEvalCaptureFailures(),
      ]);
      results.push(...diagnostics);

      const healthScore = this.calculateHealthScore(results);
      results.push({
        service: 'health_score',
        healthy: healthScore >= 80,
        latency_ms: performance.now() - start,
        error: healthScore >= 80 ? undefined : `score=${healthScore}`,
        timestamp: new Date().toISOString(),
      });

      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('healthCheck', latencyMs, 'ok');
      for (const result of results) {
        this.observability.metrics.observe('gmirror_health_check_latency_ms', result.latency_ms, { service: result.service });
        if (!result.healthy) this.observability.metrics.increment('gmirror_health_check_errors_total', { service: result.service });
      }
      await this.observability.alertOnHealthDrop(healthScore, results);
      this.observability.tracer.endSpan(span);
      return results;
    } catch (error) {
      const latencyMs = performance.now() - start;
      this.observability.metrics.recordPublicMethod('healthCheck', latencyMs, 'error');
      this.observability.tracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async checkLLMApiHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const secrets = getDefaultSecretManager();
      const anthropicApiKey = secrets.get('anthropic_api_key');
      const openaiApiKey = secrets.get('openai_api_key');
      if (anthropicApiKey) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: anthropicApiKey });
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        return this.result('llm_api', Boolean(response.id), start);
      }
      if (openaiApiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: openaiApiKey });
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        return this.result('llm_api', Boolean(response.id), start);
      }
      return this.result('llm_api', false, start, 'No LLM API key configured');
    } catch (error) {
      return this.result('llm_api', false, start, error instanceof Error ? error.message : 'LLM ping failed');
    }
  }

  private async checkSandboxHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      await promisify(exec)('docker --version', { timeout: 1000 });
      return this.result('sandbox', true, start);
    } catch (error) {
      return this.result('sandbox', false, start, error instanceof Error ? error.message : 'Sandbox unavailable');
    }
  }

  private async checkSyncFreshness(): Promise<HealthCheckResult> {
    const start = performance.now();
    const latestReceipt = await this.receiptRegistry.getLatest();
    const corpusPath = path.join(process.cwd(), '.gbrain-corpus');
    const timestamps = [
      latestReceipt ? new Date(latestReceipt.timestamp).getTime() : 0,
      fs.existsSync(corpusPath) ? fs.statSync(corpusPath).mtimeMs : 0,
    ].filter(value => value > 0);
    const newest = Math.max(0, ...timestamps);
    const ageMs = newest > 0 ? Date.now() - newest : Number.POSITIVE_INFINITY;
    return this.result(
      'sync_freshness',
      Number.isFinite(ageMs) && ageMs <= 24 * 60 * 60 * 1000,
      start,
      Number.isFinite(ageMs) ? `age_ms=${Math.round(ageMs)}` : 'No sync artifacts or receipts found',
    );
  }

  private async checkSchemaVersion(): Promise<HealthCheckResult> {
    const start = performance.now();
    const latestReceipt = await this.receiptRegistry.getLatest();
    const healthy = !latestReceipt || latestReceipt.schema_version === 1;
    return this.result('schema_version', healthy, start, healthy ? undefined : `receipt_schema=${latestReceipt?.schema_version}`);
  }

  private async checkQueueHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    const memory = process.memoryUsage();
    const heapRatio = memory.heapTotal > 0 ? memory.heapUsed / memory.heapTotal : 0;
    return this.result('queue_health', heapRatio < 0.9, start, `pending=0 heap_ratio=${heapRatio.toFixed(3)}`);
  }

  private async checkHealthTrend(): Promise<HealthCheckResult> {
    const start = performance.now();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [day, week] = await Promise.all([
      this.receiptRegistry.getAllBetween(dayAgo, now),
      this.receiptRegistry.getAllBetween(weekAgo, now),
    ]);
    const passRate = (receipts: any[]) => receipts.length === 0 ? 1 : receipts.filter(receipt => receipt.hard_gates_passed && receipt.verdict !== 'fail').length / receipts.length;
    const dayRate = passRate(day);
    const weekRate = passRate(week);
    return this.result(
      'health_trend',
      dayRate >= Math.max(0.5, weekRate - 0.15),
      start,
      `pass_rate_24h=${dayRate.toFixed(3)} pass_rate_7d=${weekRate.toFixed(3)} receipts_24h=${day.length} receipts_7d=${week.length}`,
    );
  }

  private async checkEvalCaptureFailures(): Promise<HealthCheckResult> {
    const start = performance.now();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const receipts = await this.receiptRegistry.getAllBetween(dayAgo, now);
    const failures = receipts.filter((receipt: any) =>
      receipt.metadata?.eval_capture_failed ||
      receipt.metadata?.eval_capture?.status === 'failed' ||
      (receipt.errors ?? []).some((error: string) => /eval[_ -]?capture/i.test(error)),
    );
    return this.result('eval_capture', failures.length === 0, start, `failures_24h=${failures.length}`);
  }

  private calculateHealthScore(results: HealthCheckResult[]): number {
    const weights: Record<string, number> = {
      population: 10,
      runner: 10,
      gbrain: 20,
      llm_api: 15,
      sandbox: 10,
      sync_freshness: 10,
      schema_version: 10,
      queue_health: 5,
      health_trend: 10,
      eval_capture: 5,
    };
    let earned = 0;
    let total = 0;
    for (const result of results) {
      const weight = weights[result.service] ?? 2;
      total += weight;
      if (result.healthy) {
        const latencyPenalty = result.latency_ms > 2000 ? 0.75 : result.latency_ms > 500 ? 0.9 : 1;
        earned += weight * latencyPenalty;
      }
    }
    return total === 0 ? 0 : Math.round((earned / total) * 100);
  }

  private result(service: string, healthy: boolean, start: number, error?: string): HealthCheckResult {
    return {
      service,
      healthy,
      latency_ms: performance.now() - start,
      error: healthy ? undefined : error,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Replay a previous scoring run from GBrain
   */
  async replayRequest(requestId: string): Promise<Verdict> {
    const start = performance.now();
    const span = this.observability.tracer.startSpan('GMirror.replayRequest', { request_id: requestId });
    this.logger.info('Replaying request', { request_id: requestId });
    
    try {
      const data = await this.gbrainClient.getReplayRequest(requestId);
      const request = data.request as TestRequest;
      const scope = data.scope as ScopeBundle;
      
      // Re-run the scoring with the original request and scope
      const result = await this.scoreChange(request, scope);
      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('replayRequest', latencyMs, 'ok');
      this.observability.tracer.endSpan(span);
      return result;
    } catch (error) {
      this.logger.error('Replay failed', error instanceof Error ? error : { error: String(error) });
      const latencyMs = performance.now() - start;
      this.latencyTracker.record(latencyMs);
      this.observability.metrics.recordPublicMethod('replayRequest', latencyMs, 'error');
      this.observability.tracer.endSpan(span, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get receipts
   */
  async getReceipts(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    if (options?.startDate && options?.endDate) {
      const start = new Date(options.startDate);
      const end = new Date(options.endDate);
      const receipts = await this.receiptRegistry.getAllBetween(start, end);
      
      // Apply limit and offset
      let result = receipts;
      if (options.offset) {
        result = result.slice(options.offset);
      }
      if (options.limit) {
        result = result.slice(0, options.limit);
      }
      return result;
    }
    
    // If no date range, get latest
    const latest = await this.receiptRegistry.getLatest();
    return latest ? [latest] : [];
  }

  /**
   * Detect frustration trend in run records
   */
  detectFrustrationTrend(arg?: RunRecord[] | string): any {
    if (Array.isArray(arg)) {
      return this.verdictAggregator.detectFrustrationTrend(arg as RunRecord[]);
    } else {
      return this.verdictAggregator.detectFrustrationTrend(arg as string | undefined);
    }
  }

  /**
   * Get drift statistics
   */
  async getDrift(metricName?: string): Promise<any[]> {
    const start = performance.now();
    let result;
    if (metricName) {
      const driftResult = this.driftDetector.detectDrift(metricName);
      result = driftResult ? [driftResult] : [];
    } else {
      result = this.driftDetector.detectAllDrift();
    }
    this.latencyTracker.record(performance.now() - start);
    return result;
  }

  /**
   * Get cost statistics
   */
  getCostStats() {
    return this.costLedger.getStats();
  }
}
