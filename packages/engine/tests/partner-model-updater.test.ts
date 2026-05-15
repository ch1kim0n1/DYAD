import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PartnerModelUpdater } from '../src/state/partner-model-updater.js';
import type { FeatureVector, NormalizedMessage } from '@dyad/shared';

const tmpDir = path.join(os.tmpdir(), 'dyad-pm-' + Math.random().toString(36).slice(2));

function fv(id: string, overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    message_id: id,
    fw_i: 0, fw_we: 0, fw_you: 0, fw_abs: 0, fw_tent: 0, fw_cog: 0, fw_third: 0,
    nrc_joy: 0, nrc_trust: 0, nrc_fear: 0, nrc_surprise: 0,
    nrc_sadness: 0, nrc_disgust: 0, nrc_anger: 0, nrc_anticipation: 0,
    nrc_positive: 0, nrc_negative: 0,
    afinn_valence: 0, intensifier_rate: 0,
    bid_classification: { is_bid: false, bid_type: null, confidence: 0 },
    response_classification: { is_response_to_bid: false, quality: null, confidence: 0 },
    horseman_markers: { criticism: false, contempt: false, defensiveness: false, stonewalling: false },
    validation_markers: { acknowledges: false, paraphrases: false, asks_to_understand: false },
    primary_emotion: { label: 'trust', intensity: 'low', confidence: 0 },
    secondary_emotion_inference: null,
    action_id_level: 'low',
    higgins_family: null,
    topic_tags: [], latency_z_score: 0, clinical_flag: null,
    ...overrides,
  };
}

function msg(id: string, isFromMe: boolean): NormalizedMessage {
  return { message_id: id, participant_id: isFromMe ? 'me' : 'p', is_from_me: isFromMe, text: '', timestamp: new Date().toISOString(), chat_id: 'c' };
}

beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
afterEach(() => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

describe('issue #20/consolidated: PartnerModelUpdater', () => {
  it('only absorbs partner messages (is_from_me === false)', () => {
    const u = new PartnerModelUpdater('d1', 'p1', tmpDir);
    u.update(
      [fv('a', { bid_classification: { is_bid: true, bid_type: 'question', confidence: 1 } })],
      [msg('a', true)] // authored by self, should be skipped
    );
    expect(u.getModel().bid_signature.bid_types.question).toBeUndefined();
  });

  it('absorbs partner-authored messages', () => {
    const u = new PartnerModelUpdater('d1', 'p1', tmpDir);
    u.update(
      [
        fv('a', { bid_classification: { is_bid: true, bid_type: 'question', confidence: 1 } }),
        fv('b', { bid_classification: { is_bid: true, bid_type: 'share', confidence: 1 } }),
      ],
      [msg('a', false), msg('b', false)]
    );
    const m = u.getModel();
    expect(m.bid_signature.bid_types.question).toBe(1);
    expect(m.bid_signature.bid_types.share).toBe(1);
  });

  it('writes partner-model-<dyadId>.json on save() and reloads', () => {
    const u = new PartnerModelUpdater('dyZ', 'p', tmpDir);
    u.update([fv('a')], [msg('a', false)]);
    u.save();
    expect(fs.existsSync(path.join(tmpDir, 'partner-model-dyZ.json'))).toBe(true);
    const u2 = new PartnerModelUpdater('dyZ', 'p', tmpDir);
    expect(u2.getModel().dyad_id).toBe('dyZ');
  });
});
