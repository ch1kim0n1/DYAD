import { z } from 'zod';

// === Message schemas ===
export const RawMessageSchema = z.object({
  rowid: z.number(),
  text: z.string(),
  handle_id: z.string(),
  date: z.number(),
  is_from_me: z.boolean(),
  chat_id: z.string(),
});

export const NormalizedMessageSchema = z.object({
  message_id: z.string().length(32),
  participant_id: z.string().length(16),
  is_from_me: z.boolean(),
  text: z.string(),
  timestamp: z.string().datetime(),
  chat_id: z.string().length(16),
});

// === Feature vector schema ===
export const BidClassificationSchema = z.object({
  is_bid: z.boolean(),
  bid_type: z.enum(['observation', 'question', 'share', 'request']).nullable(),
  confidence: z.number().min(0).max(1),
});

export const ResponseClassificationSchema = z.object({
  is_response_to_bid: z.boolean(),
  quality: z.enum(['engaged', 'perfunctory', 'missed', 'hostile']).nullable(),
  confidence: z.number().min(0).max(1),
});

export const HorsemanMarkersSchema = z.object({
  criticism: z.boolean(),
  contempt: z.boolean(),
  defensiveness: z.boolean(),
  stonewalling: z.boolean(),
});

export const ValidationMarkersSchema = z.object({
  acknowledges: z.boolean(),
  paraphrases: z.boolean(),
  asks_to_understand: z.boolean(),
});

export const EmotionLabelSchema = z.object({
  label: z.enum(['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']),
  intensity: z.enum(['low', 'med', 'high']),
  confidence: z.number().min(0).max(1),
});

export const SecondaryEmotionInferenceSchema = z.object({
  surface: z.string(),
  underneath: z.enum(['hurt', 'fear', 'shame', 'loneliness']),
  confidence: z.number().min(0).max(1),
});

export const ClinicalFlagSchema = z.object({
  category: z.enum(['abuse', 'suicidality', 'severe_depression']),
  confidence: z.number().min(0).max(1),
});

export const FeatureVectorSchema = z.object({
  message_id: z.string(),
  // Function-word layer
  fw_i: z.number(),
  fw_we: z.number(),
  fw_you: z.number(),
  fw_abs: z.number(),
  fw_tent: z.number(),
  fw_cog: z.number(),
  fw_third: z.number(),
  // Affect layer
  nrc_joy: z.number(),
  nrc_trust: z.number(),
  nrc_fear: z.number(),
  nrc_surprise: z.number(),
  nrc_sadness: z.number(),
  nrc_disgust: z.number(),
  nrc_anger: z.number(),
  nrc_anticipation: z.number(),
  nrc_positive: z.number(),
  nrc_negative: z.number(),
  afinn_valence: z.number().min(-5).max(5),
  intensifier_rate: z.number(),
  // LLM extraction layer
  bid_classification: BidClassificationSchema,
  response_classification: ResponseClassificationSchema,
  horseman_markers: HorsemanMarkersSchema,
  validation_markers: ValidationMarkersSchema,
  primary_emotion: EmotionLabelSchema,
  secondary_emotion_inference: SecondaryEmotionInferenceSchema.nullable(),
  action_id_level: z.enum(['low', 'high']),
  higgins_family: z.enum(['dejection', 'agitation', 'neutral']).nullable(),
  topic_tags: z.array(z.string()),
  latency_z_score: z.number(),
  clinical_flag: ClinicalFlagSchema.nullable(),
});

// === State object schemas ===
export const AttachmentIndicatorsSchema = z.object({
  secure: z.number().min(0).max(1),
  anxious: z.number().min(0).max(1),
  avoidant: z.number().min(0).max(1),
  disorganized: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export const RelationalTemplateSchema = z.object({
  template_id: z.string(),
  description: z.string(),
  trigger_pattern: z.string(),
  confidence: z.number().min(0).max(1),
});

export const SelfModelSchema = z.object({
  user_id: z.string(),
  attachment_indicators: AttachmentIndicatorsSchema,
  horseman_profile: z.record(z.enum(['criticism', 'contempt', 'defensiveness', 'stonewalling']), z.number()),
  bid_responsiveness_baseline: z.number().min(0).max(1),
  action_id_asymmetry: z.number(),
  recurring_templates: z.array(RelationalTemplateSchema),
  updated_at: z.string().datetime(),
});

export const CommunicationFingerprintSchema = z.object({
  avg_response_time_ms: z.number(),
  message_length_mean: z.number(),
  emoji_usage_rate: z.number(),
  question_frequency: z.number(),
});

export const ExternalContextSchema = z.object({
  source: z.string(),
  content: z.string(),
  timestamp: z.string().datetime(),
  relevance_score: z.number().min(0).max(1),
});

export const TriggerProfileSchema = z.object({
  trigger_pattern: z.string(),
  typical_response: z.string(),
  frequency: z.number(),
});

export const BidSignatureSchema = z.object({
  bid_types: z.record(z.string(), z.number()),
  response_quality_distribution: z.record(z.string(), z.number()),
});

export const PartnerModelSchema = z.object({
  dyad_id: z.string(),
  partner_id: z.string(),
  communication_fingerprint: CommunicationFingerprintSchema,
  attachment_inference: AttachmentIndicatorsSchema,
  external_context_bundle: z.array(ExternalContextSchema),
  trigger_profile: z.array(TriggerProfileSchema),
  bid_signature: BidSignatureSchema,
  updated_at: z.string().datetime(),
});

export const RuptureRepairEventSchema = z.object({
  event_id: z.string(),
  type: z.enum(['rupture', 'repair']),
  timestamp: z.string().datetime(),
  status: z.enum(['open', 'closed', 'window_expired']),
  source_message_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const OpenLoopSchema = z.object({
  loop_id: z.string(),
  description: z.string(),
  opened_at: z.string().datetime(),
  source_message_ids: z.array(z.string()),
});

export const RelationshipModelSchema = z.object({
  dyad_id: z.string(),
  ppr_bidirectional: z.object({
    user_to_partner: z.number(),
    partner_to_user: z.number(),
  }),
  five_to_one_ratio: z.number(),
  bid_response_rate: z.object({
    user_response_rate: z.number(),
    partner_response_rate: z.number(),
  }),
  repair_labor_index: z.number().min(-1).max(1),
  mirroring_index: z.number().min(-1).max(1),
  gottman_status: z.enum(['stable', 'warning', 'failing']),
  open_loops: z.array(OpenLoopSchema),
  rupture_repair_ledger: z.array(RuptureRepairEventSchema),
  updated_at: z.string().datetime(),
});

// === Detector result schemas ===
export const BidAsymmetryResultSchema = z.object({
  detected: z.boolean(),
  user_response_rate: z.number().min(0).max(1),
  partner_response_rate: z.number().min(0).max(1),
  self_rate: z.number().min(0).max(1),
  partner_rate: z.number().min(0).max(1),
  gap: z.number(),
  asymmetry_score: z.number().min(-1).max(1),
  bid_count: z.number().int().min(0),
  severity: z.enum(['low', 'medium', 'high']),
  gottman_threshold_stable: z.literal(0.86),
  gottman_threshold_failing: z.literal(0.33),
  sample_size: z.number(),
  confidence: z.number().min(0).max(1),
});

export const PrimarySecondaryResultSchema = z.object({
  surface_emotion: z.string(),
  underlying_emotion: z.enum(['hurt', 'fear', 'shame', 'loneliness']),
  source_message_ids: z.array(z.string()),
  reframe: z.string(),
  citations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const PredictiveDivergenceResultSchema = z.object({
  detected: z.boolean(),
  self_trend: z.number(),
  partner_trend: z.number(),
  divergence_score: z.number().min(0),
  window_size: z.number().int().min(0),
  user_intent_summary: z.string().optional(),
  partner_perception_summary: z.string().optional(),
  cosine_distance: z.number().min(0).max(1).optional(),
  divergent_phrases: z.array(z.object({
    user_phrase: z.string(),
    partner_phrase: z.string(),
  })).optional(),
});

export const PhantomThirdPartyResultSchema = z.object({
  detected: z.boolean(),
  third_person_rate: z.number().min(0),
  first_second_person_rate: z.number().min(0),
  ratio: z.number().min(0),
  message_window: z.number().int().min(0),
  current_reaction_fingerprint: z.record(z.string(), z.number()).optional(),
  matched_historical_relationship: z.string().optional(),
  matched_message_ids: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  pattern_description: z.string().optional(),
});

export const CrisisResourceSchema = z.object({
  name: z.string(),
  phone: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  description: z.string(),
});

export const EthicalRefusalResultSchema = z.object({
  safe: z.boolean(),
  should_refuse: z.boolean(),
  triggers: z.array(z.enum(['abuse', 'suicidality', 'severe_depression', 'coercive_control'])),
  category: z.enum(['abuse', 'suicidality', 'severe_depression']).nullable(),
  referral_resources: z.array(z.string()),
  crisis_resources: z.array(CrisisResourceSchema),
  confidence: z.number().min(0).max(1),
});

// === GBrain page type ===
export const DyadPageKindSchema = z.enum([
  'dyad_self_model',
  'dyad_partner_model',
  'dyad_relationship_model',
  'dyad_detector_result',
]);

export const OrchestratorResultSchema = z.object({
  result_id: z.string(),
  dyad_id: z.string(),
  generated_at: z.string().datetime(),
  detectors: z.object({
    bid_asymmetry: BidAsymmetryResultSchema.optional(),
    primary_secondary: PrimarySecondaryResultSchema.optional(),
    predictive_divergence: PredictiveDivergenceResultSchema.optional(),
    phantom_third_party: PhantomThirdPartyResultSchema.optional(),
    ethical_refusal: EthicalRefusalResultSchema.optional(),
  }),
  summary: z.string(),
  recommended_actions: z.array(z.string()),
  citations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// Note: Type exports are in types.ts to avoid conflicts
