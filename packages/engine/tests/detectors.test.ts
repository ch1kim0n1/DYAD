import { describe, it, expect } from 'bun:test';
import { BidAsymmetryDetector } from '../src/detectors/bid-asymmetry.js';
import { PredictiveDivergenceDetector } from '../src/detectors/predictive-divergence.js';
import { PhantomThirdPartyDetector } from '../src/detectors/phantom-third-party.js';
import { EthicalRefusalClassifier, CRISIS_RESOURCES } from '../src/detectors/ethical-refusal.js';
import { DetectorOrchestrator } from '../src/detectors/orchestrator.js';
import { buildSecondaryEmotionPrompt } from '../src/detectors/secondary-emotion-prompt.js';
import type { FeatureVector, NormalizedMessage } from '@dyad/shared';

function fv(id: string, overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    message_id: id,
    fw_i: 0, fw_we: 0, fw_you: 0, fw_abs: 0, fw_tent: 0, fw_cog: 0, fw_third: 0,
    nrc_joy: 0, nrc_trust: 0, nrc_fear: 0, nrc_surprise: 0, nrc_sadness: 0,
    nrc_disgust: 0, nrc_anger: 0, nrc_anticipation: 0, nrc_positive: 0, nrc_negative: 0,
    afinn_valence: 0, intensifier_rate: 0,
    bid_classification: { is_bid: false, bid_type: null, confidence: 0 },
    response_classification: { is_response_to_bid: false, quality: null, confidence: 0 },
    horseman_markers: { criticism: false, contempt: false, defensiveness: false, stonewalling: false },
    validation_markers: { acknowledges: false, paraphrases: false, asks_to_understand: false },
    primary_emotion: { label: 'trust', intensity: 'low', confidence: 0 },
    secondary_emotion_inference: null,
    action_id_level: 'low',
    higgins_family: null,
    topic_tags: [],
    latency_z_score: 0,
    clinical_flag: null,
    ...overrides,
  };
}

function msg(id: string, isFromMe: boolean, ts: number = 0): NormalizedMessage {
  return { message_id: id, participant_id: isFromMe ? 'me' : 'p', is_from_me: isFromMe, text: '', timestamp: new Date(ts || Date.now()).toISOString(), chat_id: 'c' };
}

describe('issue #25: BidAsymmetryDetector', () => {
  const det = new BidAsymmetryDetector();

  it('returns detected=false with fewer than 10 bids', () => {
    const r = det.detect([fv('a')], [msg('a', true)]);
    expect(r.detected).toBe(false);
    expect(r.bid_count).toBe(0);
  });

  it('detects severe asymmetry: self engaged, partner missed', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    for (let i = 0; i < 8; i++) {
      // partner bid, self engaged
      features.push(fv(`pb${i}`, { bid_classification: { is_bid: true, bid_type: 'question', confidence: 0.9 } }));
      messages.push(msg(`pb${i}`, false, t)); t += 1000;
      features.push(fv(`sr${i}`, { response_classification: { is_response_to_bid: true, quality: 'engaged', confidence: 0.9 } }));
      messages.push(msg(`sr${i}`, true, t)); t += 1000;
    }
    for (let i = 0; i < 8; i++) {
      // self bid, partner missed
      features.push(fv(`sb${i}`, { bid_classification: { is_bid: true, bid_type: 'question', confidence: 0.9 } }));
      messages.push(msg(`sb${i}`, true, t)); t += 1000;
      features.push(fv(`pr${i}`, { response_classification: { is_response_to_bid: true, quality: 'missed', confidence: 0.9 } }));
      messages.push(msg(`pr${i}`, false, t)); t += 1000;
    }
    const r = det.detect(features, messages);
    expect(r.bid_count).toBeGreaterThanOrEqual(10);
    expect(r.self_rate).toBeGreaterThan(0.7);
    expect(r.partner_rate).toBeLessThan(0.5);
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('high');
  });

  it('reports severity tiers correctly', () => {
    const m = det['severity' as keyof BidAsymmetryDetector] as unknown as (n: number) => 'low' | 'medium' | 'high';
    // re-test via detect with known synthetic rates
    const small = det.detectFromModel(
      { dyad_id: 'd', ppr_bidirectional: { user_to_partner: 0, partner_to_user: 0 }, five_to_one_ratio: 1, bid_response_rate: { user_response_rate: 0.6, partner_response_rate: 0.5 }, repair_labor_index: 0, mirroring_index: 0, gottman_status: 'warning', open_loops: [], rupture_repair_ledger: [], updated_at: new Date().toISOString() },
      20
    );
    expect(small.severity).toBe('low');
  });
});

describe('issue #28: PredictiveDivergenceDetector', () => {
  const det = new PredictiveDivergenceDetector();

  it('returns detected=false when too few messages per side', () => {
    const r = det.detect([fv('a')], [msg('a', true)]);
    expect(r.detected).toBe(false);
  });

  it('detects diverging trends', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    // Self trends positive (-2, -1, 0, 1, 2)
    [-2, -1, 0, 1, 2].forEach((v, i) => {
      features.push(fv(`s${i}`, { afinn_valence: v }));
      messages.push(msg(`s${i}`, true, t + i * 2000));
    });
    // Partner trends negative (2, 1, 0, -1, -2)
    [2, 1, 0, -1, -2].forEach((v, i) => {
      features.push(fv(`p${i}`, { afinn_valence: v }));
      messages.push(msg(`p${i}`, false, t + i * 2000 + 1000));
    });
    const r = det.detect(features, messages);
    expect(r.detected).toBe(true);
    expect(r.self_trend).toBeGreaterThan(0);
    expect(r.partner_trend).toBeLessThan(0);
    expect(r.divergence_score).toBeGreaterThan(0.3);
  });

  it('does not detect converging trends', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    [0, 1, 2, 3, 4].forEach((v, i) => {
      features.push(fv(`s${i}`, { afinn_valence: v }));
      messages.push(msg(`s${i}`, true, t + i * 2000));
      features.push(fv(`p${i}`, { afinn_valence: v }));
      messages.push(msg(`p${i}`, false, t + i * 2000 + 1000));
    });
    expect(det.detect(features, messages).detected).toBe(false);
  });
});

describe('issue #29: PhantomThirdPartyDetector', () => {
  const det = new PhantomThirdPartyDetector();

  it('returns detected=false with fewer than 10 messages', () => {
    expect(det.detect([fv('a')]).detected).toBe(false);
  });

  it('detects high third-person pronoun rate', () => {
    const features: FeatureVector[] = [];
    for (let i = 0; i < 10; i++) {
      features.push(fv(`m${i}`, { fw_third: 0.3, fw_i: 0.05, fw_we: 0, fw_you: 0.05 }));
    }
    const r = det.detect(features);
    expect(r.detected).toBe(true);
    expect(r.third_person_rate).toBeGreaterThan(r.first_second_person_rate * 0.5);
  });

  it('does not detect ordinary first/second-person conversations', () => {
    const features: FeatureVector[] = [];
    for (let i = 0; i < 10; i++) {
      features.push(fv(`m${i}`, { fw_third: 0.02, fw_i: 0.1, fw_we: 0.05, fw_you: 0.1 }));
    }
    expect(det.detect(features).detected).toBe(false);
  });
});

describe('issue #30: EthicalRefusalClassifier', () => {
  it('classifies safe when no clinical flags present', () => {
    const c = new EthicalRefusalClassifier({ bypass: true });
    const r = c.classifyFromFeatures([fv('a')]);
    expect(r.safe).toBe(true);
    expect(r.should_refuse).toBe(false);
    expect(r.triggers).toEqual([]);
    expect(r.crisis_resources).toEqual([]);
  });

  it('classifies unsafe when multiple high-confidence clinical flags present', () => {
    const c = new EthicalRefusalClassifier({ bypass: true });
    const features = [
      fv('a', { clinical_flag: { category: 'suicidality', confidence: 0.9 } }),
      fv('b', { clinical_flag: { category: 'suicidality', confidence: 0.85 } }),
    ];
    const r = c.classifyFromFeatures(features);
    expect(r.safe).toBe(false);
    expect(r.triggers).toContain('suicidality');
    expect(r.crisis_resources.length).toBeGreaterThan(0);
    expect(r.category).toBe('suicidality');
  });

  it('exposes structured crisis resources with the right shape', () => {
    expect(CRISIS_RESOURCES.length).toBeGreaterThanOrEqual(4);
    for (const r of CRISIS_RESOURCES) {
      expect(r.name).toBeTruthy();
      expect(r.description).toBeTruthy();
    }
  });
});

describe('issue #31: DetectorOrchestrator', () => {
  it('short-circuits with only ethical_refusal when unsafe', async () => {
    const ethical = new EthicalRefusalClassifier({ bypass: true });
    const orch = new DetectorOrchestrator({ ethical, dyadId: 'd1' });
    const features = [
      fv('a', { clinical_flag: { category: 'suicidality', confidence: 0.95 } }),
      fv('b', { clinical_flag: { category: 'suicidality', confidence: 0.9 } }),
    ];
    const r = await orch.run({ messages: [msg('a', true), msg('b', true)], features });
    expect(r.ethical_refusal.safe).toBe(false);
    expect(r.bid_asymmetry).toBeUndefined();
    expect(r.predictive_divergence).toBeUndefined();
    expect(r.phantom_third_party).toBeUndefined();
  });

  it('runs analytical detectors when safe', async () => {
    const ethical = new EthicalRefusalClassifier({ bypass: true });
    const orch = new DetectorOrchestrator({ ethical, dyadId: 'd1' });
    const features = [fv('a'), fv('b')];
    const r = await orch.run({ messages: [msg('a', true), msg('b', false)], features });
    expect(r.ethical_refusal.safe).toBe(true);
    expect(r.bid_asymmetry).toBeDefined();
    expect(r.predictive_divergence).toBeDefined();
    expect(r.phantom_third_party).toBeDefined();
  });
});

describe('issue #26: secondary-emotion prompt', () => {
  it('builds a self-contained prompt with three few-shots', () => {
    const target = msg('t', true);
    target.text = 'fine, whatever';
    const prompt = buildSecondaryEmotionPrompt([target], target);
    expect(prompt).toContain('Example 1 — anger → hurt');
    expect(prompt).toContain('Example 2 — dismissal → fear');
    expect(prompt).toContain('Example 3 — sarcasm → sadness');
    expect(prompt).toContain('primary_emotion');
    expect(prompt).toContain('has_layering');
  });
});
