import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  Verdict,
  ScoreBundle,
  HardGateResult,
  FailureMode,
  RunRecord,
  TestRequest,
  ExecutionReceipt,
  MultiModelConfig,
  EscalationMetrics,
  TierConfig,
  ModelTier,
} from '../types/index.js';
import { GMIRROR_RUBRIC_V1, getRubricHash } from './gmirror-rubric.js';
import { DYAD_HARD_GATE_DIMENSIONS, GMIRROR_DYAD_RUBRIC_V1 } from './gmirror-dyad-rubric.js';
import { ReceiptRegistry } from './receipt-registry.js';
import { VerdictPersistenceManager } from './verdict-persistence.js';
import { LLMClient, estimateCostUsd } from './llm-client.js';
import { wilsonCI } from '@gstack/shared/core';
import { StructuredLogger } from '@gstack/shared/core';
import { GBrainIntegrationClient } from './gbrain-integration.js';

interface VerdictConsensusVote {
  tier: ModelTier;
  model_id: string;
  verdict?: Verdict['overall'];
  dimensions: Record<string, number>;
  reasoning?: string;
  disqualified: boolean;
  disqualification_reason?: string;
}

interface DimensionAgreement {
  participating_models: number;
  agreement: number;
  wilson_95_ci: { lower: number; upper: number };
  small_sample_note: boolean;
  values: Record<string, number>;
}

interface VerdictConsensusSummary {
  verdict?: Verdict['overall'];
  agreed: boolean;
  agreement_ratio: number;
  consensus_threshold: number;
  votes_required: number;
  valid_votes: number;
  tier3_invoked: boolean;
  early_stopped: boolean;
  small_sample_note: boolean;
  per_dimension_agreement: Record<string, DimensionAgreement>;
  votes: VerdictConsensusVote[];
}

const CONSENSUS_DIMENSIONS = ['correctness', 'user_outcome', 'robustness', 'risk'];
const VERDICTS: Verdict['overall'][] = ['pass', 'pass_with_warnings', 'risky', 'fail'];

/**
 * Verdict Aggregator
 * 
 * Responsibilities:
 * - Aggregate outcomes from multiple synthetic user runs (with Tier 1/Tier 2 escalation)
 * - Calculate multi-dimensional scores (correctness, user outcome, robustness, risk)
 * - Apply hard gates (blocking checks)
 * - Detect and structure failure modes
 * - Generate final verdict
 */
export class VerdictAggregator {
  private registry: ReceiptRegistry;
  private persistence: VerdictPersistenceManager;
  private multiModelConfig: MultiModelConfig;
  private tierConfigs: Map<string, TierConfig>;
  private escalationMetrics: EscalationMetrics;
  private llmClient: LLMClient;
  private logger: StructuredLogger;
  private lastConsensusSummary?: VerdictConsensusSummary;
  private gbrainClient: GBrainIntegrationClient;

  constructor(dbPath?: string, multiModelConfig?: MultiModelConfig, llmClient?: LLMClient, gbrainClient?: GBrainIntegrationClient) {
    this.registry = new ReceiptRegistry('gmirror');
    this.persistence = new VerdictPersistenceManager(dbPath);
    this.llmClient = llmClient ?? new LLMClient();
    this.logger = new StructuredLogger('gmirror-verdict');
    this.gbrainClient = gbrainClient ?? new GBrainIntegrationClient();

    // Multi-model configuration with defaults
    this.multiModelConfig = multiModelConfig || {
      default_tier: 'tier1',
      escalation_enabled: true,
      escalation_triggers: {
        min_confidence: 0.7,
        min_quality_score: 0.5,
        max_ambiguity: 0.5,
      },
      consensus_threshold: 0.8,
      cost_budget_usd_per_hour: 15.0,
      allow_tier3: true,
    };

    // Tier configurations
    this.tierConfigs = new Map([
      ['tier1', { name: 'claude-haiku-4-5', model_id: 'claude-haiku-4-5-20251001', cost_per_1k_tokens_usd: 0.001, avg_latency_ms: 500, use_case: 'Synthetic user actions' }],
      ['tier2', { name: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', cost_per_1k_tokens_usd: 0.003, avg_latency_ms: 2000, use_case: 'Verdict aggregation when confidence low' }],
      ['tier3', { name: 'claude-opus-4-6', model_id: 'claude-opus-4-6', cost_per_1k_tokens_usd: 0.015, avg_latency_ms: 5000, use_case: 'Critical decisions' }],
    ]);

    // Initialize escalation metrics
    this.escalationMetrics = {
      total_tasks: 0,
      escalated_tasks: 0,
      tier1_success_rate: 1,
      tier2_success_rate: 0,
      tier3_success_rate: 0,
      tier1_count: 0,
      tier2_count: 0,
      tier3_count: 0,
      avg_cost_per_task_usd: 0,
      avg_latency_ms: 0,
      tier1_avg_latency_ms: 0,
      tier2_avg_latency_ms: 0,
      tier3_avg_latency_ms: 0,
      consensus_agreement_rate: 0,
      budget_remaining_usd: this.multiModelConfig.cost_budget_usd_per_hour,
    };
  }

  /**
   * Aggregate run records into a verdict with Tier 1/Tier 2 escalation
   */
  async aggregateVerdict(
    request: TestRequest,
    runRecords: RunRecord[],
    detectedFailureModes: FailureMode[] = []
  ): Promise<Verdict> {
    const startTime = Date.now();
    const aggregateStartCostUsd = this.getLLMTotalCostUsd();
    let currentTier = this.multiModelConfig.default_tier;
    let escalated = false;

    if (this.isEthicalRefusalTriggered(request)) {
      return this.buildEthicalRefusalVerdict(request, startTime);
    }

    if (this.isDyadInsightRequest(request)) {
      return this.aggregateDyadInsightVerdict(request, runRecords, detectedFailureModes, startTime);
    }

    // Update metrics
    this.escalationMetrics.total_tasks++;
    this.escalationMetrics.tier1_count++;

    // Store frustration data for each run record
    for (const record of runRecords) {
      const avgFrustration = record.subjective_trace.frustration.length > 0
        ? record.subjective_trace.frustration.reduce((sum, f) => sum + f, 0) / record.subjective_trace.frustration.length
        : 0;
      
      this.persistence.addFrustrationData({
        run_id: record.run_id,
        request_id: record.request_id,
        scenario_id: record.scenario_id,
        frustration: avgFrustration,
      });
      
      this.persistence.addRunRecord({
        run_id: record.run_id,
        request_id: record.request_id,
        synthetic_user_id: record.synthetic_user_id,
        scenario_id: record.scenario_id,
        outcome: record.outcome,
        frustration: avgFrustration,
        duration_ms: record.duration_ms,
        cost_usd: record.cost.total_cost_usd,
      });
    }

    // Calculate scores with Tier 1
    this.logger.info('Calculating scores with Tier 1');
    const tier1StartTime = Date.now();
    const correctnessScore = this.calculateCorrectnessScore(runRecords);
    const userOutcomeScore = this.calculateUserOutcomeScore(runRecords);
    const robustnessScore = this.calculateRobustnessScore(runRecords);
    const riskScore = this.calculateRiskScore(runRecords, detectedFailureModes);
    const confidenceScore = this.calculateConfidenceScore(runRecords);
    const tier1Duration = Date.now() - tier1StartTime;
    this.escalationMetrics.tier1_avg_latency_ms = tier1Duration;

    // Check if escalation is needed based on confidence
    const needsEscalation = this.multiModelConfig.escalation_enabled && 
                           confidenceScore.score.point < this.multiModelConfig.escalation_triggers.min_confidence;

    let finalCorrectnessScore = correctnessScore;
    let finalUserOutcomeScore = userOutcomeScore;
    let finalRobustnessScore = robustnessScore;
    let finalRiskScore = riskScore;
    let finalConfidenceScore = confidenceScore;

    if (needsEscalation && runRecords.length > 0) {
      this.logger.info(`Confidence ${confidenceScore.score.point.toFixed(2)} below threshold ${this.multiModelConfig.escalation_triggers.min_confidence}, escalating to Tier 2`);
      const tier2Config = this.tierConfigs.get('tier2')!;
      this.logger.info(`Using Tier 2: ${tier2Config.name} for verdict aggregation`);

      // Tier 2: Re-calculate scores with higher quality model
      const tier2StartTime = Date.now();
      const tier2Refinement = await this.refineScoresWithLLM(
        tier2Config.model_id,
        runRecords,
        detectedFailureModes,
        {
          correctness: this.calculateCorrectnessScore(runRecords),
          user_outcome: this.calculateUserOutcomeScore(runRecords),
          robustness: this.calculateRobustnessScore(runRecords),
          risk: this.calculateRiskScore(runRecords, detectedFailureModes),
          confidence: this.calculateConfidenceScore(runRecords),
        }
      );
      const tier2Scores = tier2Refinement.scores;
      finalCorrectnessScore = tier2Scores.correctness;
      finalUserOutcomeScore = tier2Scores.user_outcome;
      finalRobustnessScore = tier2Scores.robustness;
      finalRiskScore = tier2Scores.risk;
      finalConfidenceScore = tier2Scores.confidence;
      const tier2Duration = Date.now() - tier2StartTime;
      this.escalationMetrics.tier2_avg_latency_ms = tier2Duration;

      // Track escalation
      escalated = true;
      this.escalationMetrics.escalated_tasks++;
      this.escalationMetrics.tier2_count++;

      // Enhance confidence with Tier 2 boost
      finalConfidenceScore = {
        ...finalConfidenceScore,
        score: {
          point: Math.min(1, finalConfidenceScore.score.point + 0.1),
          lower: finalConfidenceScore.score.lower,
          upper: finalConfidenceScore.score.upper,
        },
        confidence: Math.min(1, finalConfidenceScore.confidence + 0.1),
      };

      // Check if Tier 3 escalation is needed
      const needsTier3Escalation = tier2Refinement.applied &&
                                   this.multiModelConfig.allow_tier3 &&
                                   this.escalationMetrics.budget_remaining_usd > this.tierConfigs.get('tier3')!.cost_per_1k_tokens_usd &&
                                   finalConfidenceScore.score.point < 0.5;

      if (needsTier3Escalation) {
        this.logger.info(`Confidence ${finalConfidenceScore.score.point.toFixed(2)} still below 0.5 after Tier 2, escalating to Tier 3`);
        const tier3Config = this.tierConfigs.get('tier3')!;
        this.logger.info(`Using Tier 3: ${tier3Config.name} for critical decisions`);

        // Tier 3: Re-calculate scores with premium model
        const tier3StartTime = Date.now();
        const tier3Refinement = await this.refineScoresWithLLM(
          tier3Config.model_id,
          runRecords,
          detectedFailureModes,
          {
            correctness: finalCorrectnessScore,
            user_outcome: finalUserOutcomeScore,
            robustness: finalRobustnessScore,
            risk: finalRiskScore,
            confidence: finalConfidenceScore,
          }
        );
        const tier3Scores = tier3Refinement.scores;
        finalCorrectnessScore = tier3Scores.correctness;
        finalUserOutcomeScore = tier3Scores.user_outcome;
        finalRobustnessScore = tier3Scores.robustness;
        finalRiskScore = tier3Scores.risk;
        finalConfidenceScore = tier3Scores.confidence;
        const tier3Duration = Date.now() - tier3StartTime;
        
        // Track Tier 3 metrics
        this.escalationMetrics.tier3_count++;
        this.escalationMetrics.tier3_avg_latency_ms = this.escalationMetrics.tier3_avg_latency_ms === 0
          ? tier3Duration
          : (this.escalationMetrics.tier3_avg_latency_ms * (this.escalationMetrics.tier3_count - 1) + tier3Duration) / this.escalationMetrics.tier3_count;
        this.escalationMetrics.budget_remaining_usd -= tier3Config.cost_per_1k_tokens_usd;

        // Enhance confidence with Tier 3 boost
        finalConfidenceScore = {
          ...finalConfidenceScore,
          score: {
            point: Math.min(1, finalConfidenceScore.score.point + 0.15),
            lower: finalConfidenceScore.score.lower,
            upper: finalConfidenceScore.score.upper,
          },
          confidence: Math.min(1, finalConfidenceScore.confidence + 0.15),
        };

        this.logger.info('Tier 3 escalation complete');
      }
    }

    // Apply hard gates
    const hardGates = this.applyHardGates(runRecords, detectedFailureModes, request.budget);

    // Determine overall verdict
    const overall = await this.determineOverallVerdict(hardGates, finalCorrectnessScore, finalUserOutcomeScore, finalRiskScore);

    // Calculate coverage
    const population_coverage = this.calculatePopulationCoverage(runRecords);
    const scenario_coverage = this.calculateScenarioCoverage(runRecords);
    const latency = Date.now() - startTime;
    const aggregateModelCostUsd = Math.max(0, this.getLLMTotalCostUsd() - aggregateStartCostUsd);
    const cost_breakdown = this.aggregateCosts(runRecords, aggregateModelCostUsd);
    const costScore = this.calculateCostScore(runRecords);

    // Generate and emit receipt
    const receipt = await this.generateReceipt(
      request,
      overall,
      {
        correctness: finalCorrectnessScore,
        user_outcome: finalUserOutcomeScore,
        robustness: finalRobustnessScore,
        cost: costScore,
        risk: finalRiskScore,
        confidence: finalConfidenceScore,
      },
      hardGates,
      cost_breakdown.total_cost_usd,
      detectedFailureModes,
      runRecords.length
    );
    await this.registry.append(receipt);

    return {
      verdict_id: uuidv4(),
      request_id: request.request_id,
      overall,
      scores: {
        correctness: finalCorrectnessScore,
        user_outcome: finalUserOutcomeScore,
        robustness: finalRobustnessScore,
        cost: costScore,
        risk: finalRiskScore,
        confidence: finalConfidenceScore,
      },
      hard_gate_results: hardGates,
      failure_modes_detected: detectedFailureModes,
      evidence: [],
      population_coverage,
      scenario_coverage,
      latency_ms: latency,
      cost_breakdown,
      created_at: new Date().toISOString(),
      execution_receipt: receipt,
    };
  }

  private isDyadInsightRequest(request: TestRequest): boolean {
    return request.scoring_mode === 'dyad_insight' || request.context?.scoring_mode === 'dyad_insight';
  }

  private isEthicalRefusalTriggered(request: TestRequest): boolean {
    return Boolean(request.ethical_refusal_triggered || request.context?.ethical_refusal_triggered || request.payload?.ethical_refusal_triggered);
  }

  private async aggregateDyadInsightVerdict(
    request: TestRequest,
    runRecords: RunRecord[],
    detectedFailureModes: FailureMode[],
    startTime: number,
  ): Promise<Verdict> {
    const scores = this.calculateDyadInsightScores(request, runRecords, detectedFailureModes);
    const hardGates = this.applyDyadHardGates(scores);
    const weightedMean = this.calculateWeightedMean(scores, GMIRROR_DYAD_RUBRIC_V1);
    const allAboveFloor = GMIRROR_DYAD_RUBRIC_V1.dimensions.every(dimension =>
      (scores[dimension.name]?.score.point ?? 0) >= dimension.pass_floor
    );
    const blockingFailed = hardGates.some(gate => gate.severity === 'blocking' && !gate.passed);
    const overall: Verdict['overall'] = blockingFailed || !allAboveFloor
      ? 'fail'
      : weightedMean >= (GMIRROR_DYAD_RUBRIC_V1.overall_pass_criteria.weighted_mean_floor ?? 0)
        ? 'pass'
        : 'risky';
    const receipt = await this.generateDyadReceipt(request, overall, scores, hardGates, detectedFailureModes, runRecords.length);
    await this.registry.append(receipt);

    return {
      verdict_id: uuidv4(),
      request_id: request.request_id,
      overall,
      scores: scores as any,
      hard_gate_results: hardGates,
      failure_modes_detected: detectedFailureModes,
      evidence: this.generateEvidence(runRecords),
      population_coverage: this.calculatePopulationCoverage(runRecords),
      scenario_coverage: this.calculateScenarioCoverage(runRecords),
      latency_ms: Date.now() - startTime,
      cost_breakdown: this.aggregateCosts(runRecords),
      created_at: new Date().toISOString(),
      execution_receipt: receipt,
    } as Verdict;
  }

  private buildEthicalRefusalVerdict(request: TestRequest, startTime: number): Verdict {
    const zeroScores = Object.fromEntries(
      GMIRROR_DYAD_RUBRIC_V1.dimensions.map(dimension => [
        dimension.name,
        this.scoreBundle(0, [`${dimension.name} zeroed because ethical refusal triggered`]),
      ])
    ) as Record<string, ScoreBundle>;
    const hardGate: HardGateResult = {
      gate_id: uuidv4(),
      gate_name: 'ethical_refusal',
      passed: false,
      reason: 'Ethical refusal classifier triggered; insight suppressed',
      severity: 'blocking',
    };
    const failureMode: FailureMode = {
      failure_mode_id: uuidv4(),
      description: 'Ethical refusal classifier triggered - insight suppressed',
      trigger_pattern: 'ethical_refusal',
      affected_personas: [],
      affected_scenarios: [],
      severity: 'critical',
      first_observed: new Date().toISOString(),
      observation_count: 1,
      scenarios_that_catch_it: [],
    };
    const receipt = this.buildDyadReceiptObject(request, 'fail', zeroScores, [hardGate], [failureMode], 0);

    return {
      verdict_id: uuidv4(),
      request_id: request.request_id,
      overall: 'fail',
      reason: 'ethical_refusal',
      scores: zeroScores as any,
      hard_gate_results: [hardGate],
      failure_modes_detected: [failureMode],
      evidence: ['ethical_refusal'],
      population_coverage: 0,
      scenario_coverage: 0,
      latency_ms: Date.now() - startTime,
      cost_breakdown: { model_cost_usd: 0, compute_cost_usd: 0, total_cost_usd: 0 },
      created_at: new Date().toISOString(),
      execution_receipt: receipt,
    } as Verdict;
  }

  private calculateDyadInsightScores(
    request: TestRequest,
    runRecords: RunRecord[],
    failureModes: FailureMode[],
  ): Record<string, ScoreBundle> {
    const overrides = request.context?.dyad_scores || request.payload?.scores || {};
    const insightText = String(request.payload?.insight_text || request.payload?.output || '');
    const evidence = Array.isArray(request.payload?.supporting_evidence) ? request.payload.supporting_evidence : [];
    const confidence = typeof request.payload?.confidence === 'number' ? request.payload.confidence : 0.7;
    const successRate = runRecords.length > 0
      ? runRecords.filter(record => record.outcome === 'succeeded').length / runRecords.length
      : 0.75;

    const heuristicScores: Record<string, number> = {
      research_grounding: /\b(Gottman|Johnson|Bowlby|EFT|attachment|repair|bid)\b/i.test(`${insightText} ${evidence.join(' ')}`) ? 0.8 : 0.5,
      non_harm: /\b(narcissist|borderline|manipulative|blame|force|coerce|punish|diagnose)\b/i.test(insightText) || failureModes.some(mode => mode.severity === 'critical') ? 0.4 : 0.95,
      calibration: Math.max(0, 1 - Math.abs(confidence - successRate)),
      actionability: /\b(try|consider|ask|pause|repair|acknowledge|notice|choose)\b/i.test(insightText) ? 0.75 : 0.45,
      privacy_safe: this.containsPII(`${insightText} ${evidence.join(' ')}`) ? 0 : 1,
    };

    return Object.fromEntries(
      GMIRROR_DYAD_RUBRIC_V1.dimensions.map(dimension => {
        const override = Number(overrides[dimension.name]);
        const score = Number.isFinite(override) ? this.clamp01(override) : heuristicScores[dimension.name] ?? 0;
        return [dimension.name, this.scoreBundle(score, [`${dimension.name}: ${score.toFixed(2)}`])];
      })
    ) as Record<string, ScoreBundle>;
  }

  private applyDyadHardGates(scores: Record<string, ScoreBundle>): HardGateResult[] {
    return GMIRROR_DYAD_RUBRIC_V1.dimensions.map(dimension => {
      const score = scores[dimension.name]?.score.point ?? 0;
      const passed = score >= dimension.pass_floor;
      return {
        gate_id: uuidv4(),
        gate_name: `dyad_${dimension.name}`,
        passed,
        reason: passed
          ? `${dimension.name} ${score.toFixed(2)} meets floor ${dimension.pass_floor.toFixed(2)}`
          : `${dimension.name} ${score.toFixed(2)} below floor ${dimension.pass_floor.toFixed(2)}`,
        severity: DYAD_HARD_GATE_DIMENSIONS.has(dimension.name) ? 'blocking' : 'warning',
      };
    });
  }

  private scoreBundle(point: number, evidence: string[]): ScoreBundle {
    const score = this.clamp01(point);
    return {
      score: { point: score, lower: score, upper: score },
      confidence: 1,
      by_persona: {},
      by_scenario: {},
      evidence,
    };
  }

  private calculateWeightedMean(scores: Record<string, ScoreBundle>, rubric = GMIRROR_RUBRIC_V1): number {
    return rubric.dimensions.reduce((sum, dimension) => {
      return sum + ((scores[dimension.name]?.score.point ?? 0) * dimension.weight);
    }, 0);
  }

  private containsPII(text: string): boolean {
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/.test(text);
  }

  private async refineScoresWithLLM(
    model: string,
    runRecords: RunRecord[],
    failureModes: FailureMode[],
    scores: {
      correctness: ScoreBundle;
      user_outcome: ScoreBundle;
      robustness: ScoreBundle;
      risk: ScoreBundle;
      confidence: ScoreBundle;
    }
  ): Promise<{ scores: typeof scores; applied: boolean }> {
    const summary = {
      outcomes: runRecords.reduce<Record<string, number>>((counts, record) => {
        counts[record.outcome] = (counts[record.outcome] || 0) + 1;
        return counts;
      }, {}),
      average_frustration: runRecords.length === 0
        ? 0
        : runRecords.reduce((sum, record) => {
            const values = record.subjective_trace.frustration;
            const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
            return sum + avg;
      }, 0) / runRecords.length,
      failure_modes: failureModes.map((mode) => ({
        description: mode.description,
        trigger_pattern: mode.trigger_pattern,
        severity: mode.severity,
        observation_count: mode.observation_count,
      })),
      current_scores: Object.fromEntries(
        Object.entries(scores).map(([key, value]) => [key, value.score.point])
      ),
    };

    const prompt = `Review this GMirror verdict aggregation as the Tier 2/Tier 3 judge.
Adjust only when the synthetic traces and failure modes justify it.

${JSON.stringify(summary, null, 2)}

Return strict JSON:
{
  "correctness": 0.0-1.0,
  "user_outcome": 0.0-1.0,
  "robustness": 0.0-1.0,
  "risk": 0.0-1.0,
  "confidence": 0.0-1.0,
  "reasoning": "short rationale"
}`;

    try {
      const result = await this.llmClient.call(prompt, { model, temperature: 0.2 });
      const parsed = JSON.parse(result.content);
      return {
        scores: {
          correctness: this.withPointScore(scores.correctness, parsed.correctness),
          user_outcome: this.withPointScore(scores.user_outcome, parsed.user_outcome),
          robustness: this.withPointScore(scores.robustness, parsed.robustness),
          risk: this.withPointScore(scores.risk, parsed.risk),
          confidence: this.withPointScore(scores.confidence, parsed.confidence),
        },
        applied: true,
      };
    } catch (error) {
      this.logger.warn(`LLM score refinement failed for ${model}; using mechanical scores`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { scores, applied: false };
    }
  }

  private withPointScore(score: ScoreBundle, value: unknown): ScoreBundle {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return score;
    }
    const point = Math.max(0, Math.min(1, value));
    return {
      ...score,
      score: {
        point,
        lower: Math.min(score.score.lower, point),
        upper: Math.max(score.score.upper, point),
      },
      evidence: [...score.evidence, 'Tier LLM refinement applied'],
    };
  }

  /**
   * Calculate correctness score with Wilson CI
   */
  private calculateCorrectnessScore(runRecords: RunRecord[]): ScoreBundle {
    const succeeded = runRecords.filter(r => r.outcome === 'succeeded').length;
    const total = runRecords.length;
    const scoreCI = wilsonCI(succeeded, total);

    return {
      score: scoreCI,
      confidence: Math.min(1.0, total / 10), // More runs = higher confidence
      by_persona: this.groupByPersona(runRecords, 'correctness'),
      by_scenario: this.groupByScenario(runRecords, 'correctness'),
      evidence: [
        `${succeeded}/${total} users succeeded`,
        `${((1 - scoreCI.point) * 100).toFixed(1)}% failure rate`,
        `95% CI: ${(scoreCI.lower * 100).toFixed(1)}-${(scoreCI.upper * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate user outcome score with Wilson CI
   */
  private calculateUserOutcomeScore(runRecords: RunRecord[]): ScoreBundle {
    // User outcome considers not just success, but also frustration levels
    let satisfiedCount = 0;
    
    for (const record of runRecords) {
      let score = 0;
      
      if (record.outcome === 'succeeded') {
        score += 0.8;
      }
      
      // Penalize high frustration
      const avgFrustration = record.subjective_trace.frustration.reduce((a, b) => a + b, 0) / record.subjective_trace.frustration.length;
      score -= avgFrustration * 0.3;
      
      // Reward low frustration
      if (avgFrustration < 0.3) {
        score += 0.2;
      }
      
      if (Math.max(0, Math.min(1, score)) >= 0.5) {
        satisfiedCount++;
      }
    }

    const total = runRecords.length;
    const scoreCI = wilsonCI(satisfiedCount, total);
    const avgScore = total > 0 ? satisfiedCount / total : 0;

    return {
      score: scoreCI,
      confidence: Math.min(1.0, total / 10),
      by_persona: this.groupByPersona(runRecords, 'user_outcome'),
      by_scenario: this.groupByScenario(runRecords, 'user_outcome'),
      evidence: [
        `Average user satisfaction: ${(avgScore * 100).toFixed(1)}%`,
        `Frustration-weighted outcome`,
        `95% CI: ${(scoreCI.lower * 100).toFixed(1)}-${(scoreCI.upper * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate robustness score with Wilson CI
   */
  private calculateRobustnessScore(runRecords: RunRecord[]): ScoreBundle {
    // Robustness measures consistency across different user types
    const succeededByUser = runRecords.filter(r => r.outcome === 'succeeded');
    
    if (succeededByUser.length === 0) {
      return {
        score: { point: 0, lower: 0, upper: 0 },
        confidence: 0,
        by_persona: {},
        by_scenario: {},
        evidence: ['No successful runs'],
      };
    }

    // Calculate variance in performance
    const scores = runRecords.map(r => r.outcome === 'succeeded' ? 1 : 0);
    const mean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum: number, s: number) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher robustness
    const robustness = Math.max(0, 1 - stdDev);
    const robustnessCI = wilsonCI(Math.round(robustness * 10), 10);

    return {
      score: robustnessCI,
      confidence: Math.min(1.0, runRecords.length / 10),
      by_persona: this.groupByPersona(runRecords, 'robustness'),
      by_scenario: this.groupByScenario(runRecords, 'robustness'),
      evidence: [
        `Consistency score: ${(robustness * 100).toFixed(1)}%`,
        `Std deviation: ${stdDev.toFixed(3)}`,
        `95% CI: ${(robustnessCI.lower * 100).toFixed(1)}-${(robustnessCI.upper * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate risk score with Wilson CI
   */
  private calculateRiskScore(runRecords: RunRecord[], failureModes: FailureMode[]): ScoreBundle {
    let risk = 0;
    const total = runRecords.length;

    // Risk from harmful outcomes
    const harmful = runRecords.filter(r => r.outcome === 'harmful').length;
    if (total > 0) risk += (harmful / total) * 0.5;

    // Risk from detected failure modes
    const criticalFailures = failureModes.filter(f => f.severity === 'critical').length;
    risk += Math.min(0.5, criticalFailures * 0.1);

    // Risk from high abandonment rates
    const abandoned = runRecords.filter(r => r.outcome === 'abandoned').length;
    if (total > 0) risk += (abandoned / total) * 0.2;

    const riskScore = Math.min(1, risk);
    const riskCI = wilsonCI(Math.round(riskScore * 10), 10);

    return {
      score: riskCI,
      confidence: 0.7,
      by_persona: {},
      by_scenario: {},
      evidence: [
        `${harmful} harmful outcomes`,
        `${criticalFailures} critical failure modes`,
        `${total > 0 ? ((abandoned / total) * 100).toFixed(1) : '0.0'}% abandonment rate`,
        `95% CI: ${(riskCI.lower * 100).toFixed(1)}-${(riskCI.upper * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate confidence score with Wilson CI
   */
  private calculateConfidenceScore(runRecords: RunRecord[]): ScoreBundle {
    const total = runRecords.length;
    const confidence = Math.min(1.0, total / 20); // Need 20 runs for full confidence
    const confidenceCI = wilsonCI(Math.round(confidence * 10), 10);

    return {
      score: confidenceCI,
      confidence: 0.9,
      by_persona: {},
      by_scenario: {},
      evidence: [
        `Based on ${total} synthetic user runs`,
        `${(confidence * 100).toFixed(1)}% confidence`,
        `95% CI: ${(confidenceCI.lower * 100).toFixed(1)}-${(confidenceCI.upper * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate cost score with Wilson CI
   */
  private calculateCostScore(runRecords: RunRecord[]): ScoreBundle {
    const totalCost = runRecords.reduce((sum, r) => sum + r.cost.total_cost_usd, 0);
    const avgCostPerRun = runRecords.length > 0 ? totalCost / runRecords.length : 0;

    // Lower cost is better
    const score = Math.max(0, 1 - avgCostPerRun / 0.1); // Assume $0.10 per run is baseline
    const costCI = wilsonCI(Math.round(score * 10), 10);

    return {
      score: costCI,
      confidence: 0.8,
      by_persona: {},
      by_scenario: {},
      evidence: [`Average cost per run: $${avgCostPerRun.toFixed(4)}`, `95% CI: ${(costCI.lower * 100).toFixed(1)}-${(costCI.upper * 100).toFixed(1)}%`],
    };
  }

  /**
   * Get escalation metrics for monitoring
   */
  getEscalationMetrics(): EscalationMetrics {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    
    // Calculate tier success rates
    const tier1SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier1_count / totalTasks : 1;
    const tier2SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier2_count / totalTasks : 0;
    const tier3SuccessRate = totalTasks > 0 ? this.escalationMetrics.tier3_count / totalTasks : 0;
    
    // Calculate escalation rate
    const escalatedTasks = this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    const escalationRate = totalTasks > 0 ? escalatedTasks / totalTasks : 0;

    return {
      total_tasks: totalTasks,
      escalated_tasks: escalatedTasks,
      tier1_success_rate: tier1SuccessRate,
      tier2_success_rate: tier2SuccessRate,
      tier3_success_rate: tier3SuccessRate,
      tier1_count: this.escalationMetrics.tier1_count,
      tier2_count: this.escalationMetrics.tier2_count,
      tier3_count: this.escalationMetrics.tier3_count,
      avg_cost_per_task_usd: this.calculateAvgCostPerTask(),
      avg_latency_ms: this.calculateAvgLatency(),
      tier1_avg_latency_ms: this.escalationMetrics.tier1_avg_latency_ms,
      tier2_avg_latency_ms: this.escalationMetrics.tier2_avg_latency_ms,
      tier3_avg_latency_ms: this.escalationMetrics.tier3_avg_latency_ms,
      consensus_agreement_rate: this.escalationMetrics.consensus_agreement_rate,
      budget_remaining_usd: this.escalationMetrics.budget_remaining_usd,
    };
  }

  /**
   * Calculate average cost per task
   */
  private calculateAvgCostPerTask(): number {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    if (totalTasks === 0) return 0;

    const tier1Cost = this.escalationMetrics.tier1_avg_latency_ms / 1000 * (this.tierConfigs.get('tier1')?.cost_per_1k_tokens_usd || 0.001);
    const tier2Cost = this.escalationMetrics.tier2_avg_latency_ms / 1000 * (this.tierConfigs.get('tier2')?.cost_per_1k_tokens_usd || 0.003);
    const tier3Cost = this.escalationMetrics.tier3_avg_latency_ms / 1000 * (this.tierConfigs.get('tier3')?.cost_per_1k_tokens_usd || 0.015);

    const tier1Rate = this.escalationMetrics.tier1_count / totalTasks;
    const tier2Rate = this.escalationMetrics.tier2_count / totalTasks;
    const tier3Rate = this.escalationMetrics.tier3_count / totalTasks;

    return tier1Cost * tier1Rate + tier2Cost * tier2Rate + tier3Cost * tier3Rate;
  }

  /**
   * Calculate average latency
   */
  private calculateAvgLatency(): number {
    const totalTasks = this.escalationMetrics.tier1_count + this.escalationMetrics.tier2_count + this.escalationMetrics.tier3_count;
    if (totalTasks === 0) return 0;

    const tier1Rate = this.escalationMetrics.tier1_count / totalTasks;
    const tier2Rate = this.escalationMetrics.tier2_count / totalTasks;
    const tier3Rate = this.escalationMetrics.tier3_count / totalTasks;

    return this.escalationMetrics.tier1_avg_latency_ms * tier1Rate + 
           this.escalationMetrics.tier2_avg_latency_ms * tier2Rate +
           this.escalationMetrics.tier3_avg_latency_ms * tier3Rate;
  }

  /**
   * Get multi-model configuration
   */
  getMultiModelConfig(): MultiModelConfig {
    return { ...this.multiModelConfig };
  }

  private getLLMTotalCostUsd(): number {
    const getTotalCostUsd = (this.llmClient as any).getTotalCostUsd;
    return typeof getTotalCostUsd === 'function' ? getTotalCostUsd.call(this.llmClient) : 0;
  }

  /**
   * Update multi-model configuration
   */
  updateMultiModelConfig(config: Partial<MultiModelConfig>): void {
    this.multiModelConfig = { ...this.multiModelConfig, ...config };
  }

  /**
   * Apply hard gates
   */
  private applyHardGates(runRecords: RunRecord[], failureModes: FailureMode[], budget?: { max_cost_usd: number }): HardGateResult[] {
    const gates: HardGateResult[] = [];

    // Gate: No harmful outcomes
    const harmful = runRecords.filter(r => r.outcome === 'harmful').length;
    if (harmful > 0) {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'safety',
        passed: false,
        reason: `${harmful} harmful outcomes detected`,
        severity: 'blocking',
      });
    } else {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'safety',
        passed: true,
        reason: 'No harmful outcomes',
        severity: 'blocking',
      });
    }

    // Gate: Critical failure modes
    const criticalFailures = failureModes.filter(f => f.severity === 'critical');
    if (criticalFailures.length > 0) {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'critical_failures',
        passed: false,
        reason: `${criticalFailures.length} critical failure modes detected`,
        severity: 'blocking',
      });
    } else {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'critical_failures',
        passed: true,
        reason: 'No critical failure modes',
        severity: 'blocking',
      });
    }

    // Gate: Minimum success rate
    const succeeded = runRecords.filter(r => r.outcome === 'succeeded').length;
    const successRate = runRecords.length > 0 ? succeeded / runRecords.length : 0;
    if (successRate < 0.5) {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'minimum_success_rate',
        passed: false,
        reason: `Success rate ${(successRate * 100).toFixed(1)}% below 50% threshold`,
        severity: 'warning',
      });
    } else {
      gates.push({
        gate_id: uuidv4(),
        gate_name: 'minimum_success_rate',
        passed: true,
        reason: `Success rate ${(successRate * 100).toFixed(1)}% meets threshold`,
        severity: 'warning',
      });
    }

    // Gate: Cost budget
    if (budget) {
      const totalCost = runRecords.reduce((sum, r) => sum + r.cost.total_cost_usd, 0);
      if (totalCost > budget.max_cost_usd) {
        gates.push({
          gate_id: uuidv4(),
          gate_name: 'cost_budget',
          passed: false,
          reason: `Total cost $${totalCost.toFixed(4)} exceeds budget $${budget.max_cost_usd.toFixed(4)}`,
          severity: 'blocking',
        });
      } else {
        gates.push({
          gate_id: uuidv4(),
          gate_name: 'cost_budget',
          passed: true,
          reason: `Total cost $${totalCost.toFixed(4)} within budget $${budget.max_cost_usd.toFixed(4)}`,
          severity: 'blocking',
        });
      }
    }

    return gates;
  }

  /**
   * Determine overall verdict
   */
  private async determineOverallVerdict(
    hardGates: HardGateResult[],
    correctnessScore: ScoreBundle,
    userOutcomeScore: ScoreBundle,
    riskScore: ScoreBundle
  ): Promise<Verdict['overall']> {
    // Check blocking gates (always fail regardless of LLM)
    const blockingFailed = hardGates.filter(g => g.severity === 'blocking' && !g.passed);
    if (blockingFailed.length > 0) {
      return 'fail';
    }

    try {
      const llmVerdict = await this.judgeVerdictWithLLM(hardGates, correctnessScore, userOutcomeScore, riskScore);
      return llmVerdict;
    } catch (error) {
      this.logger.warn('LLM verdict judgment failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.lastConsensusSummary = undefined;
      return this.determineOverallVerdictFallback(hardGates, correctnessScore, userOutcomeScore, riskScore);
    }
  }

  /**
   * Judge verdict using LLM
   */
  private async judgeVerdictWithLLM(
    hardGates: HardGateResult[],
    correctnessScore: ScoreBundle,
    userOutcomeScore: ScoreBundle,
    riskScore: ScoreBundle
  ): Promise<Verdict['overall']> {
    const prompt = this.buildVerdictJudgmentPrompt(hardGates, correctnessScore, userOutcomeScore, riskScore);
    const votes: VerdictConsensusVote[] = [];
    let tier3Invoked = false;
    let earlyStopped = false;

    for (const tier of ['tier1', 'tier2'] as ModelTier[]) {
      votes.push(await this.collectVerdictVote(tier, prompt));
    }

    let consensus = this.evaluateVerdictConsensus(votes, false, false);
    if (consensus.agreed && consensus.verdict) {
      earlyStopped = true;
    } else if (this.multiModelConfig.allow_tier3) {
      this.logger.info('Tier 1/Tier 2 verdict consensus failed, invoking Tier 3');
      tier3Invoked = true;
      votes.push(await this.collectVerdictVote('tier3', prompt));
    }

    consensus = this.evaluateVerdictConsensus(votes, tier3Invoked, earlyStopped);
    this.lastConsensusSummary = consensus;
    this.escalationMetrics.consensus_agreement_rate = consensus.agreement_ratio;

    if (!consensus.agreed || !consensus.verdict) {
      throw new Error('Verdict consensus failed');
    }

    return consensus.verdict;
  }

  private async collectVerdictVote(tier: ModelTier, prompt: string): Promise<VerdictConsensusVote> {
    const modelId = this.tierConfigs.get(tier)?.model_id || this.llmClient.getModelByTier(tier);
    try {
      const result = await this.llmClient.call(prompt, {
        model: modelId,
        temperature: 0.2,
      });
      const parsed = this.parseJsonObject(result.content);
      return this.normalizeVerdictVote(tier, result.model_id || modelId, parsed);
    } catch (error) {
      return {
        tier,
        model_id: modelId,
        dimensions: {},
        disqualified: true,
        disqualification_reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private normalizeVerdictVote(tier: ModelTier, modelId: string, parsed: any): VerdictConsensusVote {
    const verdict = VERDICTS.includes(parsed?.verdict) ? parsed.verdict as Verdict['overall'] : undefined;
    const dimensions = this.normalizeDimensions(parsed?.dimensions);
    const missingDimensions = CONSENSUS_DIMENSIONS.filter(dimension => dimensions[dimension] === undefined);
    const reasons: string[] = [];

    if (!verdict) {
      reasons.push('verdict is missing or invalid');
    }
    if (missingDimensions.length > 0) {
      reasons.push(`missing dimensions: ${missingDimensions.join(', ')}`);
    }

    return {
      tier,
      model_id: modelId,
      verdict,
      dimensions,
      reasoning: typeof parsed?.reasoning === 'string' ? parsed.reasoning : undefined,
      disqualified: reasons.length > 0,
      disqualification_reason: reasons.join('; ') || undefined,
    };
  }

  private normalizeDimensions(value: any): Record<string, number> {
    const dimensions: Record<string, number> = {};
    if (!value || typeof value !== 'object') {
      return dimensions;
    }

    for (const dimension of CONSENSUS_DIMENSIONS) {
      const raw = Number(value[dimension]);
      if (Number.isFinite(raw)) {
        dimensions[dimension] = this.clamp01(raw);
      }
    }

    return dimensions;
  }

  private parseJsonObject(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('LLM response did not contain JSON');
      }
      return JSON.parse(match[0]);
    }
  }

  private evaluateVerdictConsensus(
    votes: VerdictConsensusVote[],
    tier3Invoked: boolean,
    earlyStopped: boolean,
  ): VerdictConsensusSummary {
    const validVotes = votes.filter(vote => !vote.disqualified && vote.verdict !== undefined);
    const counts = new Map<Verdict['overall'], number>();
    for (const vote of validVotes) {
      counts.set(vote.verdict!, (counts.get(vote.verdict!) || 0) + 1);
    }

    let verdict: Verdict['overall'] | undefined;
    let winningVotes = 0;
    for (const [candidate, count] of counts.entries()) {
      if (count > winningVotes) {
        verdict = candidate;
        winningVotes = count;
      }
    }

    const agreementRatio = validVotes.length > 0 ? winningVotes / validVotes.length : 0;
    const votesRequired = validVotes.length >= 3 ? 2 : 2;
    const thresholdMet = agreementRatio >= Math.min(this.multiModelConfig.consensus_threshold, 2 / 3);

    return {
      verdict,
      agreed: winningVotes >= votesRequired && thresholdMet && verdict !== undefined,
      agreement_ratio: agreementRatio,
      consensus_threshold: this.multiModelConfig.consensus_threshold,
      votes_required: votesRequired,
      valid_votes: validVotes.length,
      tier3_invoked: tier3Invoked,
      early_stopped: earlyStopped,
      small_sample_note: validVotes.length < 30,
      per_dimension_agreement: this.calculateDimensionAgreement(validVotes),
      votes,
    };
  }

  private calculateDimensionAgreement(votes: VerdictConsensusVote[]): Record<string, DimensionAgreement> {
    const agreements: Record<string, DimensionAgreement> = {};
    const tolerance = 1 - this.multiModelConfig.consensus_threshold;

    for (const dimension of CONSENSUS_DIMENSIONS) {
      const values: number[] = [];
      const valuesByModel: Record<string, number> = {};
      for (const vote of votes) {
        const value = vote.dimensions[dimension];
        if (value !== undefined) {
          values.push(value);
          valuesByModel[vote.model_id] = value;
        }
      }

      if (values.length === 0) {
        agreements[dimension] = {
          participating_models: 0,
          agreement: 0,
          wilson_95_ci: this.wilson95(0, 0),
          small_sample_note: true,
          values: valuesByModel,
        };
        continue;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const agreeing = values.filter(value => Math.abs(value - median) <= tolerance).length;
      agreements[dimension] = {
        participating_models: values.length,
        agreement: agreeing / values.length,
        wilson_95_ci: this.wilson95(agreeing, values.length),
        small_sample_note: values.length < 30,
        values: valuesByModel,
      };
    }

    return agreements;
  }

  private wilson95(successes: number, total: number): { lower: number; upper: number } {
    if (total <= 0) {
      return { lower: 0, upper: 0 };
    }

    const z = 1.96;
    const phat = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = phat + (z * z) / (2 * total);
    const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);

    return {
      lower: this.clamp01((center - margin) / denominator),
      upper: this.clamp01((center + margin) / denominator),
    };
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  /**
   * Build prompt for verdict judgment
   */
  private buildVerdictJudgmentPrompt(
    hardGates: HardGateResult[],
    correctnessScore: ScoreBundle,
    userOutcomeScore: ScoreBundle,
    riskScore: ScoreBundle
  ): string {
    const gatesInfo = hardGates.map(g => `${g.gate_name}: ${g.passed ? 'PASSED' : 'FAILED'} (${g.severity})`).join('\n');

    return `Determine the overall verdict based on the following scores and gate results.
You are one voter in a multi-model consensus. Return strict JSON only.
The dimensions object is required. Use scores from 0 to 1 for correctness, user_outcome, robustness, and risk.

HARD GATES:
${gatesInfo}

SCORES:
Correctness: ${correctnessScore.score.point.toFixed(3)} (95% CI: ${correctnessScore.score.lower.toFixed(3)}-${correctnessScore.score.upper.toFixed(3)})
User Outcome: ${userOutcomeScore.score.point.toFixed(3)} (95% CI: ${userOutcomeScore.score.lower.toFixed(3)}-${userOutcomeScore.score.upper.toFixed(3)})
Risk: ${riskScore.score.point.toFixed(3)} (95% CI: ${riskScore.score.lower.toFixed(3)}-${riskScore.score.upper.toFixed(3)})

Return this JSON shape:
{"verdict": "pass" | "pass_with_warnings" | "risky" | "fail", "dimensions": {"correctness": 0.0, "user_outcome": 0.0, "robustness": 0.0, "risk": 0.0}, "reasoning": "brief reason"}`;
  }

  /**
   * Fallback verdict determination using mechanical rules
   */
  private determineOverallVerdictFallback(
    hardGates: HardGateResult[],
    correctnessScore: ScoreBundle,
    userOutcomeScore: ScoreBundle,
    riskScore: ScoreBundle
  ): Verdict['overall'] {
    // Check warning gates
    const warningFailed = hardGates.filter(g => g.severity === 'warning' && !g.passed);
    if (warningFailed.length > 0) {
      return 'risky';
    }

    // Check scores using Wilson CI point estimate
    if (correctnessScore.score.point < 0.5 || userOutcomeScore.score.point < 0.5) {
      return 'risky';
    }

    if (riskScore.score.point > 0.7) {
      return 'risky';
    }

    if (correctnessScore.score.point < 0.8 || userOutcomeScore.score.point < 0.8) {
      return 'pass_with_warnings';
    }

    return 'pass';
  }

  /**
   * Calculate population coverage
   */
  private calculatePopulationCoverage(runRecords: RunRecord[]): number {
    const uniqueUsers = new Set(runRecords.map(r => r.synthetic_user_id)).size;
    // Assume we aimed for 10 unique users
    return Math.min(1.0, uniqueUsers / 10);
  }

  /**
   * Calculate scenario coverage
   */
  private calculateScenarioCoverage(runRecords: RunRecord[]): number {
    const uniqueScenarios = new Set(runRecords.map(r => r.scenario_id)).size;
    // Assume we aimed for 5 unique scenarios
    return Math.min(1.0, uniqueScenarios / 5);
  }

  /**
   * Group scores by persona with Wilson CI
   */
  private groupByPersona(runRecords: RunRecord[], metric: string): Record<string, import('../../shared/src/core/wilson-ci.js').WilsonCI> {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const record of runRecords) {
      const persona = record.synthetic_user_id; // In production, would map to persona label
      const score = record.outcome === 'succeeded' ? 1 : 0;
      sums[persona] = (sums[persona] ?? 0) + score;
      counts[persona] = (counts[persona] ?? 0) + 1;
    }

    const result: Record<string, import('../../shared/src/core/wilson-ci.js').WilsonCI> = {};
    for (const persona of Object.keys(sums)) {
      result[persona] = wilsonCI(sums[persona], counts[persona]);
    }
    return result;
  }

  /**
   * Group scores by scenario with Wilson CI
   */
  private groupByScenario(runRecords: RunRecord[], metric: string): Record<string, import('../../shared/src/core/wilson-ci.js').WilsonCI> {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const record of runRecords) {
      const scenario = record.scenario_id;
      const score = record.outcome === 'succeeded' ? 1 : 0;
      sums[scenario] = (sums[scenario] ?? 0) + score;
      counts[scenario] = (counts[scenario] ?? 0) + 1;
    }

    const result: Record<string, import('../../shared/src/core/wilson-ci.js').WilsonCI> = {};
    for (const scenario of Object.keys(sums)) {
      result[scenario] = wilsonCI(sums[scenario], counts[scenario]);
    }
    return result;
  }

  /**
   * Generate evidence strings
   */
  private generateEvidence(runRecords: RunRecord[]): string[] {
    const evidence: string[] = [];
    
    const succeeded = runRecords.filter(r => r.outcome === 'succeeded').length;
    const abandoned = runRecords.filter(r => r.outcome === 'abandoned').length;
    const errored = runRecords.filter(r => r.outcome === 'errored').length;
    
    evidence.push(`${succeeded} succeeded, ${abandoned} abandoned, ${errored} errored`);
    
    const avgDuration = runRecords.length > 0
      ? runRecords.reduce((sum, r) => sum + r.duration_ms, 0) / runRecords.length
      : 0;
    evidence.push(`Average duration: ${(avgDuration / 1000).toFixed(2)}s`);

    return evidence;
  }

  /**
   * Aggregate costs
   */
  private aggregateCosts(runRecords: RunRecord[], additionalModelCostUsd = 0) {
    const tier1Model = this.tierConfigs.get('tier1')?.model_id || 'claude-haiku-4-5-20251001';
    const modelCostUsd = runRecords.reduce((sum, r) => {
      if (typeof r.cost.tokens_used === 'number' && Number.isFinite(r.cost.tokens_used) && r.cost.tokens_used > 0) {
        const outputTokens = Math.max(1, Math.round(r.cost.tokens_used * 0.35));
        const inputTokens = Math.max(0, r.cost.tokens_used - outputTokens);
        return sum + estimateCostUsd(tier1Model, inputTokens, outputTokens);
      }
      return sum + r.cost.model_cost_usd;
    }, 0) + additionalModelCostUsd;
    const computeCostUsd = runRecords.reduce((sum, r) => sum + r.cost.compute_cost_usd, 0);

    return {
      model_cost_usd: modelCostUsd,
      compute_cost_usd: computeCostUsd,
      total_cost_usd: modelCostUsd + computeCostUsd,
    };
  }

  /**
   * Generate execution receipt
   */
  private async generateReceipt(
    request: TestRequest,
    verdict: string,
    scores: Record<string, ScoreBundle>,
    hardGates: HardGateResult[],
    costUsd: number,
    failureModes: FailureMode[],
    sampleSize: number
  ): Promise<ExecutionReceipt> {
    const rubricHash = getRubricHash(GMIRROR_RUBRIC_V1);
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(request.payload)).digest('hex');
    const configHash = crypto.createHash('sha256').update(JSON.stringify(request.budget)).digest('hex');
    
    const hardGatesPassed = hardGates.every(g => g.passed);
    const overallScore = Object.entries(scores).reduce((sum, [dim, bundle]) => {
      const dimConfig = GMIRROR_RUBRIC_V1.dimensions.find(d => d.name === dim);
      return sum + (bundle.score.point * (dimConfig?.weight ?? 0));
    }, 0);
    const consensusModels = this.lastConsensusSummary?.votes.map(vote => vote.model_id) || [];
    const modelList = consensusModels.length > 0 ? Array.from(new Set(consensusModels)) : ['claude-sonnet-4-6'];
    const validVotes = this.lastConsensusSummary?.valid_votes || 0;
    const agreeingVotes = Math.round((this.lastConsensusSummary?.agreement_ratio || 0) * validVotes);
    const verdictInterval = this.wilson95(agreeingVotes, validVotes);

    return {
      receipt_id: uuidv4(),
      schema_version: 1,
      timestamp: new Date().toISOString(),
      project: 'gmirror',
      rubric_name: GMIRROR_RUBRIC_V1.name,
      rubric_sha8: rubricHash,
      input_hash: inputHash,
      models_used: modelList,
      config_hash: configHash,
      verdict,
      scores: Object.fromEntries(
        Object.entries(scores).map(([dim, bundle]) => [
          dim,
          { 
            score: bundle.score.point, 
            confidence: bundle.confidence, 
            weight: GMIRROR_RUBRIC_V1.dimensions.find(d => d.name === dim)?.weight ?? 0,
            lower: bundle.score.lower,
            upper: bundle.score.upper
          }
        ])
      ),
      overall_score: overallScore,
      hard_gates_passed: hardGatesPassed,
      cost_usd: costUsd,
      errors: failureModes.map(f => f.description),
      metadata: {
        hard_gate_results: hardGates,
        consensus: this.lastConsensusSummary,
        verdict_wilson_95_ci: verdictInterval,
        small_sample_note: sampleSize < 30,
      },
    };
  }

  private async generateDyadReceipt(
    request: TestRequest,
    verdict: string,
    scores: Record<string, ScoreBundle>,
    hardGates: HardGateResult[],
    failureModes: FailureMode[],
    sampleSize: number,
  ): Promise<ExecutionReceipt> {
    return this.buildDyadReceiptObject(request, verdict, scores, hardGates, failureModes, sampleSize);
  }

  private buildDyadReceiptObject(
    request: TestRequest,
    verdict: string,
    scores: Record<string, ScoreBundle>,
    hardGates: HardGateResult[],
    failureModes: FailureMode[],
    sampleSize: number,
  ): ExecutionReceipt {
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(request.payload)).digest('hex');
    const configHash = crypto.createHash('sha256').update(JSON.stringify(request.budget ?? {})).digest('hex');
    const rubricHash = getRubricHash(GMIRROR_DYAD_RUBRIC_V1);
    const overallScore = this.calculateWeightedMean(scores, GMIRROR_DYAD_RUBRIC_V1);

    return {
      receipt_id: uuidv4(),
      schema_version: 1,
      timestamp: new Date().toISOString(),
      project: 'gmirror',
      rubric_name: GMIRROR_DYAD_RUBRIC_V1.name,
      rubric_sha8: rubricHash,
      input_hash: inputHash,
      models_used: [],
      config_hash: configHash,
      verdict,
      scores: Object.fromEntries(
        Object.entries(scores).map(([dim, bundle]) => [
          dim,
          {
            score: bundle.score.point,
            confidence: bundle.confidence,
            weight: GMIRROR_DYAD_RUBRIC_V1.dimensions.find(dimension => dimension.name === dim)?.weight ?? 0,
            lower: bundle.score.lower,
            upper: bundle.score.upper,
          },
        ])
      ),
      overall_score: overallScore,
      hard_gates_passed: hardGates.every(gate => gate.passed),
      cost_usd: 0,
      errors: failureModes.map(mode => mode.description),
      metadata: {
        scoring_mode: 'dyad_insight',
        hard_gate_results: hardGates,
        small_sample_note: sampleSize < 30,
      },
    };
  }

  /**
   * Detect frustration trend across run records.
   *
   * Two modes:
   *  - Pass RunRecord[] → synchronous in-memory analysis (used by tests and one-shot callers)
   *  - Pass nothing / scenarioId → async, reads from persistence (production trend detection)
   */
  detectFrustrationTrend(runRecords: RunRecord[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    average_frustration: number;
    slope: number;
    confidence: number;
    at_risk: boolean;
  };
  detectFrustrationTrend(scenarioId?: string): Promise<{
    trend: 'increasing' | 'decreasing' | 'stable';
    average_frustration: number;
    slope: number;
    confidence: number;
    at_risk: boolean;
  }>;
  detectFrustrationTrend(arg?: RunRecord[] | string): any {
    let frustrations: number[];
    const fromRecords = Array.isArray(arg);

    if (fromRecords) {
      frustrations = (arg as RunRecord[]).map(r => {
        const trace = r.subjective_trace.frustration;
        return trace.length > 0 ? trace.reduce((a, b) => a + b, 0) / trace.length : 0;
      });
    } else {
      const scenarioId = arg as string | undefined;
      frustrations = scenarioId
        ? this.persistence.getFrustrationHistory(scenarioId, 50)
        : this.persistence.getAllFrustrationHistory(50);
    }

    if (frustrations.length < 3) {
      const emptyResult = {
        trend: 'stable' as const,
        average_frustration: 0,
        slope: 0,
        confidence: 0,
        at_risk: false,
      };
      return fromRecords ? emptyResult : Promise.resolve(emptyResult);
    }

    const averageFrustration = frustrations.reduce((sum, f) => sum + f, 0) / frustrations.length;

    // Calculate linear regression slope
    const n = frustrations.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += frustrations[i];
      sumXY += i * frustrations[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determine trend
    const trend = slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable';

    // Calculate confidence based on R-squared
    const meanY = sumY / n;
    const ssTot = frustrations.reduce((sum, f) => sum + Math.pow(f - meanY, 2), 0);
    const ssRes = frustrations.reduce((sum, f, i) => {
      const predicted = meanY + slope * (i - (n - 1) / 2);
      return sum + Math.pow(f - predicted, 2);
    }, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Determine if at risk (high frustration and increasing trend)
    const at_risk = averageFrustration >= 0.5 && trend === 'increasing';

    const result: {
      trend: 'increasing' | 'decreasing' | 'stable';
      average_frustration: number;
      slope: number;
      confidence: number;
      at_risk: boolean;
    } = {
      trend,
      average_frustration: averageFrustration,
      slope,
      confidence,
      at_risk,
    };

    // When called with records, return synchronously (no gbrain side effect).
    // When called with a scenarioId / no arg, push drift to gbrain asynchronously.
    if (fromRecords) {
      return result;
    }

    const scenarioId = typeof arg === 'string' ? arg : undefined;
    return this.storeDriftDetectionInGBrain('gmirror', 'frustration', result, { scenarioId })
      .then(() => result)
      .catch(() => result);
  }

  /**
   * Store drift detection result in gbrain quality control database
   */
  private async storeDriftDetectionInGBrain(
    component: string,
    metricName: string,
    result: { trend: 'increasing' | 'decreasing' | 'stable'; slope: number; confidence: number; average_frustration: number; at_risk: boolean },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.gbrainClient.storeDriftDetection({
        component,
        metric_name: metricName,
        trend: result.trend,
        slope: result.slope,
        confidence: result.confidence,
        current_value: result.average_frustration,
        average_value: result.average_frustration,
        at_risk: result.at_risk,
        metadata,
      });
    } catch (error) {
      // Log error but don't fail the detection if gbrain storage fails
      this.logger.warn('Failed to store drift detection in gbrain', {
        error: error instanceof Error ? error.message : String(error),
        circuit: this.gbrainClient.getCircuitState(),
      });
    }
  }
}
