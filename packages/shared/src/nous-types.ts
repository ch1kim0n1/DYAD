/**
 * NOUS — Networked Outcome-Aware Mentalization Substrate.
 *
 * Type contracts for the cognitive twin layer that sits on top of the existing
 * DYAD engine. These types are intentionally additive and isolated from
 * `types.ts` so the legacy contracts stay frozen.
 */
import type { EthicalRefusalResult } from './types';

// ════════════════════════════════════════════════════════════════════════════
// Pre-existing shim — `GmailSyncState` is referenced by
// `packages/engine/src/gbrain/care-helpers.ts` (introduced by PR #111) but
// was never defined. Declared here so the engine typechecks.
// ════════════════════════════════════════════════════════════════════════════

export interface GmailSyncState {
  last_history_id?: string;
  last_synced_at?: string;
  message_count?: number;
  status?: 'idle' | 'syncing' | 'error';
  error?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Hog adapter
// ════════════════════════════════════════════════════════════════════════════

export type HogCapability =
  | 'deep_research'
  | 'people_research'
  | 'people_enrich'
  | 'companies_search'
  | 'monitor_create'
  | 'operation_get';

export interface HogOperationHandle {
  operation_id: string;
  capability: HogCapability;
  submitted_at: number;
  est_cost_credits: number;
  idempotency_key: string;
}

export interface HogOperationResult<T = unknown> {
  operation_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: T;
  credits_spent: number;
  error?: { code: string; message: string };
}

export interface DeepResearchInput {
  prompt: string;
  schema: object;
  urls?: string[];
}

export interface DeepResearchFact {
  source: string;
  text: string;
  url?: string;
  confidence: number;
}

export interface DeepResearchResult {
  headline: string;
  facts: DeepResearchFact[];
}

export interface PeopleResearchInput {
  identities: { platform: 'linkedin' | 'x' | 'github' | 'reddit'; username: string }[];
}

export interface PeopleResearchResult {
  full_name?: string;
  title?: string;
  company_name?: string;
  location?: string;
  recent_signals: { source: string; text: string; observed_at: string }[];
}

// ════════════════════════════════════════════════════════════════════════════
// MVI planner
// ════════════════════════════════════════════════════════════════════════════

export interface MviCandidate {
  /** Semantic idempotency key (§10.3 of the plan). */
  id: string;
  capability: HogCapability;
  payload: unknown;
  cost_credits: number;
  /** Expected information gain in bits over targeted beliefs. */
  expected_information_gain: number;
  target_belief_ids: string[];
  rationale: string;
}

export interface MviPlan {
  selected: MviCandidate[];
  rejected: MviCandidate[];
  total_cost: number;
  total_information_gain: number;
  budget: number;
  algorithm: 'knapsack_dp' | 'greedy_fallback';
}

// ════════════════════════════════════════════════════════════════════════════
// Mentalization Graph (Bayesian belief substrate)
// ════════════════════════════════════════════════════════════════════════════

export type BeliefDimension =
  | 'attachment'
  | 'values'
  | 'current_state'
  | 'external_context'
  | 'communication_style'
  | 'history';

export interface EvidenceRef {
  kind: 'message' | 'hog_operation' | 'detector' | 'user_correction';
  ref_id: string;
  observed_at: string;
  polarity: 'confirms' | 'disconfirms';
  /** [0,1] strength of this evidence's contribution. */
  strength: number;
}

export interface BeliefNode {
  id: string;
  dimension: BeliefDimension;
  claim: string;
  /** Beta posterior — confirming pseudo-counts. Starts at 1 (Laplace prior). */
  alpha: number;
  /** Beta posterior — disconfirming pseudo-counts. Starts at 1. */
  beta: number;
  /** 64-dim hashed bag-of-words; optional; L2-normalised when present. */
  embedding?: number[];
  evidence_refs: EvidenceRef[];
  last_updated: string;
  schema_version: 1;
}

export interface BeliefEdge {
  from: string;
  to: string;
  relation: 'supports' | 'contradicts' | 'refines' | 'derives_from';
  /** [0,1] belief flow weight. */
  weight: number;
}

export interface MentalizationGraph {
  dyad_id: string;
  nodes: Record<string, BeliefNode>;
  edges: BeliefEdge[];
  schema_version: 1;
  updated_at: string;
}

export interface BeliefUpdate {
  node_id: string;
  evidence: EvidenceRef;
  alpha_delta: number;
  beta_delta: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Adversarial protocol
// ════════════════════════════════════════════════════════════════════════════

export interface MentalizationProposal {
  id: string;
  target_node_id: string;
  claim: string;
  evidence: EvidenceRef[];
  proposed_alpha_delta: number;
  proposed_beta_delta: number;
  rationale: string;
  /** [0,1] proposer's own confidence in the claim. */
  confidence: number;
}

export interface AdversarialAlternative {
  id: string;
  alternative_claim: string;
  competing_evidence: EvidenceRef[];
  proposed_alpha_delta: number;
  proposed_beta_delta: number;
  rationale: string;
  /** [0,1] adversary's confidence in the alternative. */
  confidence: number;
}

export interface ArbiterDecision {
  proposal_id: string;
  committed: boolean;
  committed_update: BeliefUpdate | null;
  reasoning: string;
  posterior_before: { alpha: number; beta: number };
  posterior_after: { alpha: number; beta: number };
  alternatives_considered: number;
  /** KL(posterior_after || prior) in bits — for UI: "how much did evidence move us". */
  kl_divergence: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Cognitive Twin cycle
// ════════════════════════════════════════════════════════════════════════════

export interface CognitiveTwinCycleOutput {
  graph_snapshot_id: string;
  mvi_plan: MviPlan;
  hog_results: HogOperationResult[];
  decisions: ArbiterDecision[];
  enriched_summary: string;
  ethics_verdict: EthicsVerdict;
  user_facing_claims?: string[];
  /** Hawkes-poller telemetry per operation, for UI sparkline. */
  hawkes_traces?: HawkesPollTrace[];
  /** Hypothesis fork shown to the user — prior vs posterior over 3 named classes. */
  hypothesis_fork?: HypothesisFork;
}

export interface HawkesPollTrace {
  operation_id: string;
  ticks: { idx: number; t_ms: number; delay_ms: number; lambda: number }[];
}

export interface HypothesisClass {
  id: 'benign_misread' | 'partner_stressor' | 'relational_drift';
  label: string;
  prior: number;
  posterior: number;
  rationale: string;
}

export interface HypothesisFork {
  classes: HypothesisClass[];
  /** Aggregate KL between prior and posterior over the fork. */
  kl_divergence: number;
  chosen_id: HypothesisClass['id'];
}

// ════════════════════════════════════════════════════════════════════════════
// Temporal replay
// ════════════════════════════════════════════════════════════════════════════

export interface GraphSnapshot {
  snapshot_id: string;
  dyad_id: string;
  taken_at: string;
  graph: MentalizationGraph;
  triggering_event: { kind: string; ref_id: string };
}

export interface CyclicalPatternMatch {
  current_snapshot_id: string;
  matched_snapshot_id: string;
  similarity: number;
  shared_belief_ids: string[];
  cycle_estimate_days: number | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Ethics gate
// ════════════════════════════════════════════════════════════════════════════

export interface OutboundClaim {
  text: string;
  source: 'arbiter' | 'mentalizer' | 'enrichment' | 'replay';
  confidence: number;
  citations: string[];
}

export interface EthicsVerdict {
  allowed: boolean;
  filtered_claims: OutboundClaim[];
  blocked_claims: { claim: OutboundClaim; reason: string }[];
  triggered_refusal: EthicalRefusalResult | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Self-improvement (schema only — no runtime in this iteration)
// ════════════════════════════════════════════════════════════════════════════

export interface OutcomeAttribution {
  attribution_id: string;
  dyad_id: string;
  causally_linked_decision_id: string;
  outcome_observed: 'predicted' | 'contradicted' | 'partial';
  observed_at: string;
  evidence_message_ids: string[];
}
