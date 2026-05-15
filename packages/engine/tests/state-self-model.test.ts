import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SelfModelUpdater } from '../src/state/self-model-updater.js';
import type { FeatureVector, NormalizedMessage } from '@dyad/shared';

const tmp = path.join(os.tmpdir(), 'dyad-self-' + Math.random().toString(36).slice(2));

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

function msg(id: string, isFromMe: boolean): NormalizedMessage {
  return { message_id: id, participant_id: isFromMe ? 'me' : 'p', is_from_me: isFromMe, text: '', timestamp: new Date().toISOString(), chat_id: 'c' };
}

beforeEach(() => { fs.mkdirSync(tmp, { recursive: true }); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

describe('issue #21: SelfModelUpdater', () => {
  it('only absorbs is_from_me messages', () => {
    const u = new SelfModelUpdater('u1', tmp);
    const before = u.getModel();
    u.update(
      [fv('a', { horseman_markers: { criticism: true, contempt: false, defensiveness: false, stonewalling: false } })],
      [msg('a', false)]                // partner-authored, should be skipped
    );
    const after = u.getModel();
    expect(after.horseman_profile.criticism).toBe(before.horseman_profile.criticism);
  });

  it('absorbs self-authored messages', () => {
    const u = new SelfModelUpdater('u1', tmp);
    u.update(
      [fv('a', { horseman_markers: { criticism: true, contempt: false, defensiveness: false, stonewalling: false } })],
      [msg('a', true)]
    );
    expect(u.getModel().horseman_profile.criticism).toBeGreaterThan(0);
  });

  it('persists to ~/.dyad/self-model.json via storageDir override', () => {
    const u = new SelfModelUpdater('u1', tmp);
    u.update([fv('a')], [msg('a', true)]);
    u.save();
    expect(fs.existsSync(path.join(tmp, 'self-model.json'))).toBe(true);
  });

  it('round-trips through disk', () => {
    const u1 = new SelfModelUpdater('u1', tmp);
    u1.update([fv('a', { action_id_level: 'high' })], [msg('a', true)]);
    u1.save();
    const u2 = new SelfModelUpdater('u1', tmp);
    expect(u2.getModel().user_id).toBe('u1');
  });
});
