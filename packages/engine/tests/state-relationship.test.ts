import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RelationshipModelUpdater } from '../src/state/relationship-model-updater.js';
import { computeRepairLaborIndex } from '../src/state/repair-labor.js';
import { computeMirroringIndex } from '../src/state/mirroring-index.js';
import type { FeatureVector, NormalizedMessage } from '@dyad/shared';

const tmp = path.join(os.tmpdir(), 'dyad-rel-' + Math.random().toString(36).slice(2));

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

function msg(id: string, isFromMe: boolean, ts: number = Date.now()): NormalizedMessage {
  return { message_id: id, participant_id: isFromMe ? 'me' : 'p', is_from_me: isFromMe, text: '', timestamp: new Date(ts).toISOString(), chat_id: 'c' };
}

beforeEach(() => { fs.mkdirSync(tmp, { recursive: true }); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

describe('issue #22: RelationshipModelUpdater', () => {
  it('starts with warning status, persists, and reloads', () => {
    const u = new RelationshipModelUpdater('d1', tmp);
    expect(u.getModel().gottman_status).toBe('warning');
    u.save();
    const u2 = new RelationshipModelUpdater('d1', tmp);
    expect(u2.getModel().dyad_id).toBe('d1');
  });

  it('computes stable gottman_status when bid response and ratio are high', () => {
    const u = new RelationshipModelUpdater('d1', tmp);
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    // 10 partner bids, all answered "engaged" by self
    let t = Date.now();
    for (let i = 0; i < 10; i++) {
      features.push(fv(`p${i}`, { afinn_valence: 3, bid_classification: { is_bid: true, bid_type: 'question', confidence: 0.9 } }));
      messages.push(msg(`p${i}`, false, t));
      t += 1000;
      features.push(fv(`s${i}`, { afinn_valence: 3, response_classification: { is_response_to_bid: true, quality: 'engaged', confidence: 0.9 } }));
      messages.push(msg(`s${i}`, true, t));
      t += 1000;
    }
    // 10 self bids, all answered engaged by partner
    for (let i = 0; i < 10; i++) {
      features.push(fv(`ss${i}`, { afinn_valence: 3, bid_classification: { is_bid: true, bid_type: 'question', confidence: 0.9 } }));
      messages.push(msg(`ss${i}`, true, t));
      t += 1000;
      features.push(fv(`pp${i}`, { afinn_valence: 3, response_classification: { is_response_to_bid: true, quality: 'engaged', confidence: 0.9 } }));
      messages.push(msg(`pp${i}`, false, t));
      t += 1000;
    }
    const updated = u.update(features, messages);
    expect(updated.bid_response_rate.partner_response_rate).toBeGreaterThan(0.85);
    expect(updated.gottman_status).toBe('stable');
  });

  it('computes failing gottman_status when partner response rate is very low', () => {
    const u = new RelationshipModelUpdater('d1', tmp);
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    for (let i = 0; i < 20; i++) {
      features.push(fv(`ss${i}`, { afinn_valence: -2, bid_classification: { is_bid: true, bid_type: 'question', confidence: 0.9 } }));
      messages.push(msg(`ss${i}`, true, t));
      t += 1000;
      features.push(fv(`pp${i}`, { afinn_valence: -2, response_classification: { is_response_to_bid: true, quality: 'missed', confidence: 0.9 } }));
      messages.push(msg(`pp${i}`, false, t));
      t += 1000;
    }
    const updated = u.update(features, messages);
    expect(updated.bid_response_rate.partner_response_rate).toBeLessThan(0.33);
    expect(updated.gottman_status).toBe('failing');
  });
});

describe('issue #23: repair labor index', () => {
  it('returns 0 when no repair attempts present', () => {
    expect(computeRepairLaborIndex([fv('a')], [msg('a', true)])).toBe(0);
  });

  it('returns +1 when self does every repair', () => {
    const features = [
      fv('p1', { horseman_markers: { criticism: true, contempt: false, defensiveness: false, stonewalling: false } }),
      fv('s1', { validation_markers: { acknowledges: true, paraphrases: false, asks_to_understand: false } }),
    ];
    const messages = [msg('p1', false), msg('s1', true)];
    expect(computeRepairLaborIndex(features, messages)).toBe(1);
  });

  it('returns -1 when partner does every repair', () => {
    const features = [
      fv('s1', { horseman_markers: { criticism: true, contempt: false, defensiveness: false, stonewalling: false } }),
      fv('p1', { validation_markers: { acknowledges: true, paraphrases: false, asks_to_understand: false } }),
    ];
    const messages = [msg('s1', true), msg('p1', false)];
    expect(computeRepairLaborIndex(features, messages)).toBe(-1);
  });
});

describe('issue #24: mirroring index', () => {
  it('returns 0 with fewer than 5 paired observations', () => {
    expect(computeMirroringIndex([], [])).toBe(0);
  });

  it('returns a value near +1 for perfectly correlated affect', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    for (let i = 0; i < 10; i++) {
      features.push(fv(`s${i}`, { afinn_valence: i / 10 }));
      messages.push(msg(`s${i}`, true, t)); t += 1000;
      features.push(fv(`p${i}`, { afinn_valence: i / 10 }));
      messages.push(msg(`p${i}`, false, t)); t += 1000;
    }
    expect(computeMirroringIndex(features, messages)).toBeGreaterThan(0.9);
  });

  it('returns a value near -1 for perfectly anti-correlated affect', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    for (let i = 0; i < 10; i++) {
      features.push(fv(`s${i}`, { afinn_valence: i / 10 }));
      messages.push(msg(`s${i}`, true, t)); t += 1000;
      features.push(fv(`p${i}`, { afinn_valence: -i / 10 }));
      messages.push(msg(`p${i}`, false, t)); t += 1000;
    }
    expect(computeMirroringIndex(features, messages)).toBeLessThan(-0.9);
  });

  it('is bounded to [-1, 1]', () => {
    const features: FeatureVector[] = [];
    const messages: NormalizedMessage[] = [];
    let t = Date.now();
    for (let i = 0; i < 30; i++) {
      const v = Math.random() * 10 - 5;
      features.push(fv(`s${i}`, { afinn_valence: v }));
      messages.push(msg(`s${i}`, true, t)); t += 1000;
      features.push(fv(`p${i}`, { afinn_valence: Math.random() * 10 - 5 }));
      messages.push(msg(`p${i}`, false, t)); t += 1000;
    }
    const r = computeMirroringIndex(features, messages);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});
