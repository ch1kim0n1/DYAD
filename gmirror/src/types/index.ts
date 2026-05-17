import { z } from 'zod';
import { WilsonCI } from '@gstack/shared/core';

const WilsonCISchema = z.object({
  point: z.number().min(0).max(1),
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
});

// ============================================================================
// Core Type Schemas with Zod Validation
// ============================================================================

export const BigFiveSchema = z.object({
  openness: z.number().min(0).max(1),
  conscientiousness: z.number().min(0).max(1),
  extraversion: z.number().min(0).max(1),
  agreeableness: z.number().min(0).max(1),
  neuroticism: z.number().min(0).max(1),
});

export type BigFive = z.infer<typeof BigFiveSchema>;

export const ExpertiseVectorSchema = z.record(z.string(), z.number().min(0).max(1));

export type ExpertiseVector = z.infer<typeof ExpertiseVectorSchema>;

export const GoalSchema = z.object({
  goal_id: z.string(),
  description: z.string(),
  priority: z.number().min(0).max(1),
  success_criteria: z.array(z.string()),
});

export type Goal = z.infer<typeof GoalSchema>;

export const ConstraintSchema = z.object({
  constraint_id: z.string(),
  type: z.enum(['device', 'accessibility', 'time', 'bandwidth', 'language']),
  value: z.string(),
  impact: z.enum(['blocking', 'degrading', 'minor']),
});

export type Constraint = z.infer<typeof ConstraintSchema>;

export const SyntheticUserSchema = z.object({
  user_id: z.string().uuid(),
  persona_label: z.string(),
  big_five: BigFiveSchema,
  cognitive_load_baseline: z.number().min(0).max(1),
  dual_process_bias: z.number().min(-1).max(1),
  trust_baseline: z.number().min(0).max(1),
  frustration_threshold: z.number().min(0).max(1),
  expertise: ExpertiseVectorSchema,
  goals: z.array(GoalSchema),
  constraints: z.array(ConstraintSchema),
  history_seed: z.string(),
  derivation: z.enum(['sampled', 'real_user_anonymized', 'synthetic']),
  source_evidence: z.array(z.string()),
  created_at: z.string().datetime(),
  version: z.number().int().positive().default(1),
});

export type SyntheticUser = z.infer<typeof SyntheticUserSchema>;

export const ScenarioSchema = z.object({
  scenario_id: z.string().uuid(),
  goal: GoalSchema,
  starting_state: z.record(z.any()),
  success_criterion: z.string(),
  failure_criteria: z.array(z.string()),
  tags: z.array(z.string()),
  version: z.number().int().positive(),
  derivation: z.enum(['baseline', 'analytics', 'failure_mode', 'adversarial']),
  created_at: z.string().datetime(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export const FailureModeSchema = z.object({
  failure_mode_id: z.string().uuid(),
  description: z.string(),
  trigger_pattern: z.string(),
  affected_personas: z.array(z.string()),
  affected_scenarios: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  first_observed: z.string().datetime(),
  observation_count: z.number().int().positive(),
  scenarios_that_catch_it: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});

export type FailureMode = z.infer<typeof FailureModeSchema>;

export const ManipulationPatternSchema = z.object({
  pattern_id: z.string(),
  category: z.enum([
    'persuasion_principle',
    'behavioral_economics',
    'dark_pattern',
    'attention_economy',
    'misinformation',
  ]),
  targets: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
});

export type ManipulationPattern = z.infer<typeof ManipulationPatternSchema>;

export const RedTeamProbeSchema = z.object({
  probe_id: z.string().uuid(),
  probe_type: z.enum([
    'prompt_injection',
    'security',
    'abuse',
    'social_engineering',
    'data_exfiltration',
  ]),
  payload: z.string(),
  expected_denial: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

export type RedTeamProbe = z.infer<typeof RedTeamProbeSchema>;

export const ScoreBundleSchema = z.object({
  score: WilsonCISchema,
  confidence: z.number().min(0).max(1),
  by_persona: z.record(z.string(), WilsonCISchema),
  by_scenario: z.record(z.string(), WilsonCISchema),
  evidence: z.array(z.string()),
});

export type ScoreBundle = z.infer<typeof ScoreBundleSchema>;

export const HardGateResultSchema = z.object({
  gate_id: z.string(),
  gate_name: z.string(),
  passed: z.boolean(),
  reason: z.string(),
  severity: z.enum(['blocking', 'warning', 'info']),
});

export type HardGateResult = z.infer<typeof HardGateResultSchema>;

export const VerdictSchema = z.object({
  verdict_id: z.string().uuid(),
  request_id: z.string().uuid(),
  overall: z.enum(['pass', 'pass_with_warnings', 'risky', 'fail']),
  scores: z.object({
    correctness: ScoreBundleSchema,
    user_outcome: ScoreBundleSchema,
    robustness: ScoreBundleSchema,
    cost: ScoreBundleSchema,
    risk: ScoreBundleSchema,
    confidence: ScoreBundleSchema,
  }),
  hard_gate_results: z.array(HardGateResultSchema),
  failure_modes_detected: z.array(FailureModeSchema),
  evidence: z.array(z.string()),
  population_coverage: z.number().min(0).max(1),
  scenario_coverage: z.number().min(0).max(1),
  latency_ms: z.number(),
  cost_breakdown: z.object({
    model_cost_usd: z.number(),
    compute_cost_usd: z.number(),
    total_cost_usd: z.number(),
  }),
  created_at: z.string().datetime(),
  execution_receipt: z.any().optional(), // ExecutionReceipt from quality-rubric
});

export type Verdict = z.infer<typeof VerdictSchema>;

export const ScoreRequestSchema = z.object({
  request_id: z.string().uuid(),
  insight_type: z.enum(['emotion_label', 'bid_classification', 'repair_suggestion', 'labor_asymmetry', 'phantom_third_party', 'predictive_divergence']),
  dyad_id: z.string().optional(),
  scoring_mode: z.enum(['default', 'dyad_insight']).optional(),
  payload: z.any(),
  context: z.record(z.any()).optional(),
  budget: z.object({
    max_cost_usd: z.number().positive(),
    max_latency_ms: z.number().int().positive(),
  }).optional(),
  caller: z.object({
    source: z.string(),
    ref: z.string(),
  }),
  created_at: z.string().datetime(),
});

export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export const TestRequestSchema = z.object({
  request_id: z.string().uuid(),
  mode: z.enum(['change', 'pre_build', 'shadow']),
  payload: z.any(),
  context: z.record(z.any()),
  scoring_mode: z.enum(['default', 'dyad_insight']).optional(),
  ethical_refusal_triggered: z.boolean().optional(),
  budget: z.object({
    max_cost_usd: z.number().positive(),
    max_latency_ms: z.number().int().positive(),
    max_panel_size: z.number().int().positive(),
  }),
  caller: z.object({
    source: z.string(),
    ref: z.string(),
  }),
  created_at: z.string().datetime(),
});

export type TestRequest = z.infer<typeof TestRequestSchema>;

export const RelationalInsightSchema = z.object({
  insight_id: z.string().optional(),
  dyad_id: z.string().optional(),
  insight_type: z.enum(['emotion_label', 'bid_classification', 'repair_suggestion', 'labor_asymmetry']),
  insight_text: z.string(),
  confidence: z.number().min(0).max(1),
  supporting_evidence: z.array(z.string()).optional(),
  ethical_refusal_triggered: z.boolean().optional(),
});

export type RelationalInsight = z.infer<typeof RelationalInsightSchema>;

export const ScopeBundleSchema = z.object({
  request_id: z.string().uuid(),
  population_filter: z.object({
    persona_labels: z.array(z.string()),
    expertise_domains: z.array(z.string()),
    trust_range: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  }),
  scenario_set: z.array(z.string()),
  red_team_set: z.array(z.string()),
  scoring_profile: z.string(),
  panel_size: z.number().int().positive(),
});

export type ScopeBundle = z.infer<typeof ScopeBundleSchema>;

export const RunRecordSchema = z.object({
  run_id: z.string().uuid(),
  request_id: z.string().uuid(),
  synthetic_user_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  outcome: z.enum(['succeeded', 'abandoned', 'errored', 'harmful']),
  behavior_trace: z.array(z.object({
    timestamp: z.string().datetime(),
    action: z.string(),
    state: z.record(z.any()),
    trust: z.number().min(0).max(1),
    frustration: z.number().min(0).max(1),
  })),
  subjective_trace: z.object({
    cognitive_load: z.array(z.number()),
    trust: z.array(z.number()),
    frustration: z.array(z.number()),
  }),
  duration_ms: z.number(),
  cost: z.object({
    model_cost_usd: z.number(),
    compute_cost_usd: z.number(),
    total_cost_usd: z.number(),
    tokens_used: z.number().optional(),
    llm_calls: z.number().optional(),
  }),
  created_at: z.string().datetime(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

// ============================================================================
// Population Management Types
// ============================================================================

export const PopulationSchema = z.object({
  population_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  personas: z.array(SyntheticUserSchema),
  version: z.number().int().positive(),
  calibration_data: z.object({
    real_user_distribution: z.record(z.string(), z.number()),
    last_calibration: z.string().datetime(),
    calibration_score: z.number().min(0).max(1),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Population = z.infer<typeof PopulationSchema>;

export const PersonaClusterSchema = z.object({
  cluster_id: z.string().uuid(),
  label: z.string(),
  center: BigFiveSchema,
  members: z.array(z.string()),
  representative_user: SyntheticUserSchema,
});

export type PersonaCluster = z.infer<typeof PersonaClusterSchema>;

// ============================================================================
// Integration Types
// ============================================================================

export const GBrainAnalyticsRequestSchema = z.object({
  time_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  metrics: z.array(z.enum(['user_distribution', 'behavior_patterns', 'success_rates'])),
});

export type GBrainAnalyticsRequest = z.infer<typeof GBrainAnalyticsRequestSchema>;

export const GToMIntentRequestSchema = z.object({
  persona_filter: z.record(z.string(), z.any()),
  surface: z.string(),
});

export type GToMIntentRequest = z.infer<typeof GToMIntentRequestSchema>;

export const GToMIntentResponseSchema = z.object({
  intents: z.array(z.object({
    intent: z.string(),
    frequency: z.number(),
    evidence_count: z.number().int().positive(),
  })),
});

export type GToMIntentResponse = z.infer<typeof GToMIntentResponseSchema>;

// ============================================================================
// Multi-Model Consensus Types
// ============================================================================

export const MultiModelConfigSchema = z.object({
  default_tier: z.enum(['tier1', 'tier2', 'tier3']),
  escalation_enabled: z.boolean(),
  escalation_triggers: z.object({
    min_confidence: z.number().min(0).max(1),
    min_quality_score: z.number().min(0).max(1),
    max_ambiguity: z.number().min(0).max(1),
  }),
  consensus_threshold: z.number().min(0).max(1),
  cost_budget_usd_per_hour: z.number().positive(),
  allow_tier3: z.boolean(),
});

export type MultiModelConfig = z.infer<typeof MultiModelConfigSchema>;

export const ModelTierSchema = z.enum(['tier1', 'tier2', 'tier3']);

export type ModelTier = z.infer<typeof ModelTierSchema>;

export const TierConfigSchema = z.object({
  name: z.string(),
  model_id: z.string(),
  cost_per_1k_tokens_usd: z.number(),
  avg_latency_ms: z.number(),
  use_case: z.string(),
});

export type TierConfig = z.infer<typeof TierConfigSchema>;

export const EscalationMetricsSchema = z.object({
  total_tasks: z.number().int(),
  escalated_tasks: z.number().int(),
  tier1_success_rate: z.number().min(0).max(1),
  tier2_success_rate: z.number().min(0).max(1),
  tier3_success_rate: z.number().min(0).max(1),
  tier1_count: z.number().int(),
  tier2_count: z.number().int(),
  tier3_count: z.number().int(),
  avg_cost_per_task_usd: z.number(),
  avg_latency_ms: z.number(),
  tier1_avg_latency_ms: z.number(),
  tier2_avg_latency_ms: z.number(),
  tier3_avg_latency_ms: z.number(),
  consensus_agreement_rate: z.number().min(0).max(1),
  budget_remaining_usd: z.number(),
});

export type EscalationMetrics = z.infer<typeof EscalationMetricsSchema>;

// ============================================================================
// Shared Quality Rubric Types (for regression gating and receipts)
// ============================================================================
export * from './quality-rubric.js';
