import { describe, it, expect } from 'bun:test';
import {
  NormalizedMessageSchema,
  FeatureVectorSchema,
  PartnerModelSchema,
  OrchestratorResultSchema,
} from '../src/schemas.js';

describe('issue #2/#3: shared types & zod schemas', () => {
  it('parses a valid NormalizedMessage', () => {
    const ok = NormalizedMessageSchema.safeParse({
      message_id: 'a'.repeat(32),
      participant_id: 'b'.repeat(16),
      is_from_me: true,
      text: 'hi',
      timestamp: new Date().toISOString(),
      chat_id: 'c'.repeat(16),
    });
    expect(ok.success).toBe(true);
  });

  it('rejects FeatureVector with afinn out of range', () => {
    const bad = FeatureVectorSchema.safeParse({
      message_id: 'm', fw_i: 0, fw_we: 0, fw_you: 0, fw_abs: 0, fw_tent: 0, fw_cog: 0,
      nrc_joy: 0, nrc_trust: 0, nrc_fear: 0, nrc_surprise: 0, nrc_sadness: 0,
      nrc_disgust: 0, nrc_anger: 0, nrc_anticipation: 0, nrc_positive: 0, nrc_negative: 0,
      afinn_valence: 99, intensifier_rate: 0,
      bid_classification: { is_bid: false, bid_type: null, confidence: 0 },
      response_classification: { is_response_to_bid: false, quality: null, confidence: 0 },
      horseman_markers: { criticism: false, contempt: false, defensiveness: false, stonewalling: false },
      validation_markers: { acknowledges: false, paraphrases: false, asks_to_understand: false },
      primary_emotion: { label: 'joy', intensity: 'low', confidence: 0 },
      secondary_emotion_inference: null,
      action_id_level: 'low',
      higgins_family: null,
      topic_tags: [],
      latency_z_score: 0,
      clinical_flag: null,
    });
    expect(bad.success).toBe(false);
  });

  it('exposes OrchestratorResult schema', () => {
    const ok = OrchestratorResultSchema.safeParse({
      result_id: 'r1',
      dyad_id: 'd1',
      generated_at: new Date().toISOString(),
      detectors: {},
      summary: 'ok',
      recommended_actions: [],
      citations: [],
      confidence: 0.5,
    });
    expect(ok.success).toBe(true);
  });

  it('PartnerModelSchema accepts an initialised model', () => {
    const ok = PartnerModelSchema.safeParse({
      dyad_id: 'd1', partner_id: 'p1',
      communication_fingerprint: {
        avg_response_time_ms: 0, message_length_mean: 0,
        emoji_usage_rate: 0, question_frequency: 0,
      },
      attachment_inference: { secure: 0, anxious: 0, avoidant: 0, disorganized: 0, confidence: 0 },
      external_context_bundle: [],
      trigger_profile: [],
      bid_signature: { bid_types: {}, response_quality_distribution: {} },
      updated_at: new Date().toISOString(),
    });
    expect(ok.success).toBe(true);
  });
});
