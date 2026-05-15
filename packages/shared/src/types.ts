// === Message schema ===
export interface RawMessage {
  rowid: number;
  text: string;
  handle_id: string;        // phone/email — hashed before leaving device
  date: number;             // Apple epoch (seconds since 2001-01-01)
  is_from_me: boolean;
  chat_id: string;
}

export interface NormalizedMessage {
  message_id: string;       // SHA-256(rowid + chat_id)
  participant_id: string;   // SHA-256(handle_id).slice(0, 16)
  is_from_me: boolean;
  text: string;             // PII-redacted
  timestamp: string;        // ISO 8601
  chat_id: string;
}

// === Feature vector (output of L2) ===
export interface FeatureVector {
  message_id: string;
  // Function-word layer (Pennebaker)
  fw_i: number;             // first-person singular rate
  fw_we: number;            // first-person plural rate
  fw_you: number;           // second-person rate
  fw_abs: number;           // absolutist language rate
  fw_tent: number;          // tentative language rate
  fw_cog: number;           // cognitive process word rate
  fw_third: number;         // third-person pronoun rate (he/she/they/...)
  // Affect layer (NRC + AFINN)
  nrc_joy: number;
  nrc_trust: number;
  nrc_fear: number;
  nrc_surprise: number;
  nrc_sadness: number;
  nrc_disgust: number;
  nrc_anger: number;
  nrc_anticipation: number;
  nrc_positive: number;
  nrc_negative: number;
  afinn_valence: number;    // continuous -5 to +5
  intensifier_rate: number;
  // LLM extraction layer
  bid_classification: BidClassification;
  response_classification: ResponseClassification;
  horseman_markers: HorsemanMarkers;
  validation_markers: ValidationMarkers;
  primary_emotion: EmotionLabel;
  secondary_emotion_inference: SecondaryEmotionInference | null;
  action_id_level: 'low' | 'high';
  higgins_family: 'dejection' | 'agitation' | 'neutral' | null;
  topic_tags: string[];
  latency_z_score: number;
  clinical_flag: ClinicalFlag | null;
}

export interface BidClassification {
  is_bid: boolean;
  bid_type: 'observation' | 'question' | 'share' | 'request' | null;
  confidence: number;
}

export interface ResponseClassification {
  is_response_to_bid: boolean;
  quality: 'engaged' | 'perfunctory' | 'missed' | 'hostile' | null;
  confidence: number;
}

export interface HorsemanMarkers {
  criticism: boolean;
  contempt: boolean;
  defensiveness: boolean;
  stonewalling: boolean;
}

export interface ValidationMarkers {
  acknowledges: boolean;
  paraphrases: boolean;
  asks_to_understand: boolean;
}

export interface EmotionLabel {
  label: 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';
  intensity: 'low' | 'med' | 'high';
  confidence: number;
}

export interface SecondaryEmotionInference {
  surface: string;
  underneath: 'hurt' | 'fear' | 'shame' | 'loneliness';
  confidence: number;
}

export interface ClinicalFlag {
  category: 'abuse' | 'suicidality' | 'severe_depression';
  confidence: number;
}

// === State objects (L3, persisted in GBrain) ===
export interface SelfModel {
  user_id: string;
  attachment_indicators: AttachmentIndicators;
  horseman_profile: Record<keyof HorsemanMarkers, number>;  // rolling rate
  bid_responsiveness_baseline: number;
  action_id_asymmetry: number;           // Vallacher-Wegner signature
  recurring_templates: RelationalTemplate[];
  /** Optional Jo-provided life-context summary used to contextualise patterns. */
  jo_context?: {
    recent_calendar_summary: string;
    mood_indicators: string[];
    contextualized_at: number;
  } | null;
  updated_at: string;
}

export interface PartnerModel {
  dyad_id: string;
  partner_id: string;
  communication_fingerprint: CommunicationFingerprint;
  attachment_inference: AttachmentIndicators;
  external_context_bundle: ExternalContext[];
  trigger_profile: TriggerProfile[];
  bid_signature: BidSignature;
  updated_at: string;
}

export interface RelationshipModel {
  dyad_id: string;
  ppr_bidirectional: { user_to_partner: number; partner_to_user: number };
  five_to_one_ratio: number;
  bid_response_rate: { user_response_rate: number; partner_response_rate: number };
  repair_labor_index: number;            // signed [-1, 1]; +1 = self carries all repair labor
  mirroring_index: number;               // Pearson r on affect over rolling window, [-1, 1]
  gottman_status: 'stable' | 'warning' | 'failing';
  open_loops: OpenLoop[];
  rupture_repair_ledger: RuptureRepairEvent[];
  updated_at: string;
}

export interface AttachmentIndicators {
  secure: number;
  anxious: number;
  avoidant: number;
  disorganized: number;
  confidence: number;
}

export interface RuptureRepairEvent {
  event_id: string;
  type: 'rupture' | 'repair';
  timestamp: string;
  status: 'open' | 'closed' | 'window_expired';
  source_message_ids: string[];
  confidence: number;
}

export interface OpenLoop {
  loop_id: string;
  description: string;
  opened_at: string;
  source_message_ids: string[];
}

// === Detector outputs (L4) ===
export interface BidAsymmetryResult {
  detected: boolean;
  user_response_rate: number;
  partner_response_rate: number;
  self_rate: number;          // alias of user_response_rate, spec-friendly
  partner_rate: number;       // alias of partner_response_rate, spec-friendly
  gap: number;
  asymmetry_score: number;    // self_rate - partner_rate, in [-1, 1]
  bid_count: number;          // total bids analyzed across both participants
  severity: 'low' | 'medium' | 'high';
  gottman_threshold_stable: 0.86;
  gottman_threshold_failing: 0.33;
  sample_size: number;
  confidence: number;
}

export interface PrimarySecondaryResult {
  surface_emotion: string;
  underlying_emotion: 'hurt' | 'fear' | 'shame' | 'loneliness';
  source_message_ids: string[];
  reframe: string;
  citations: string[];
  confidence: number;
}

export interface PredictiveDivergenceResult {
  detected: boolean;
  self_trend: number;          // AFINN valence slope per message
  partner_trend: number;
  divergence_score: number;    // |self_trend - partner_trend|
  window_size: number;         // messages analyzed
  // Legacy LLM-based fields (optional, kept for compatibility)
  user_intent_summary?: string;
  partner_perception_summary?: string;
  cosine_distance?: number;
  divergent_phrases?: { user_phrase: string; partner_phrase: string }[];
}

export interface PhantomThirdPartyResult {
  detected: boolean;
  third_person_rate: number;
  first_second_person_rate: number;
  ratio: number;                  // third_person_rate / first_second_person_rate
  message_window: number;
  // Legacy fingerprint-matching fields (optional, kept for compatibility)
  current_reaction_fingerprint?: Record<string, number>;
  matched_historical_relationship?: string;
  matched_message_ids?: string[];
  confidence?: number;
  pattern_description?: string;
}

export interface CrisisResource {
  name: string;
  phone?: string;
  text?: string;
  url?: string;
  description: string;
}

export type EthicalTrigger = 'abuse' | 'suicidality' | 'severe_depression' | 'coercive_control';

export interface EthicalRefusalResult {
  safe: boolean;                        // false = block all analytical output
  should_refuse: boolean;               // !safe — kept for compatibility
  triggers: EthicalTrigger[];
  category: 'abuse' | 'suicidality' | 'severe_depression' | null;  // primary, for compat
  confidence: number;
  referral_resources: string[];         // simple string list, for compat
  crisis_resources: CrisisResource[];   // structured resources
}

// === GBrain page types ===
export type DyadPageKind = 'dyad_self_model' | 'dyad_partner_model' | 'dyad_relationship_model' | 'dyad_detector_result';

// === Additional supporting types ===
export interface RelationalTemplate {
  template_id: string;
  description: string;
  trigger_pattern: string;
  confidence: number;
}

export interface CommunicationFingerprint {
  avg_response_time_ms: number;
  message_length_mean: number;
  emoji_usage_rate: number;
  question_frequency: number;
}

export interface ExternalContext {
  source: string;
  content: string;
  timestamp: string;
  relevance_score: number;
}

export interface TriggerProfile {
  trigger_pattern: string;
  typical_response: string;
  frequency: number;
}

export interface BidSignature {
  bid_types: Record<string, number>;
  response_quality_distribution: Record<string, number>;
}

// === Orchestrator output (L5) ===
export interface OrchestratorResult {
  result_id: string;
  dyad_id: string;
  generated_at: string;
  analyzed_at: number;                  // unix ms timestamp
  ethical_refusal: EthicalRefusalResult;
  // Only populated when ethical_refusal.safe === true
  bid_asymmetry?: BidAsymmetryResult;
  primary_secondary?: PrimarySecondaryResult;
  predictive_divergence?: PredictiveDivergenceResult;
  phantom_third_party?: PhantomThirdPartyResult;
  relationship_model?: RelationshipModel;
  // Legacy nested detectors map (kept for compatibility)
  detectors: {
    bid_asymmetry?: BidAsymmetryResult;
    primary_secondary?: PrimarySecondaryResult;
    predictive_divergence?: PredictiveDivergenceResult;
    phantom_third_party?: PhantomThirdPartyResult;
    ethical_refusal?: EthicalRefusalResult;
  };
  summary: string;
  recommended_actions: string[];
  citations: string[];
  confidence: number;
}
