import { describe, it, expect, mock } from 'bun:test';
import {
  storeDetectorResult,
  getDetectorHistory,
  storeModelSnapshot,
  getLatestSnapshot,
  type ModelSnapshot,
} from '../src/lib/gbrain-helpers.js';
import type { OrchestratorResult, SelfModel, PartnerModel, RelationshipModel } from '@dyad/shared';
import { GBrainClient } from '@dyad/engine';

function fakeClient(opts: {
  pages?: unknown[];
  upsert?: (page: unknown) => Promise<unknown>;
}): GBrainClient {
  return {
    upsertPage: opts.upsert ?? mock(async (page: unknown) => page),
    getPage: mock(async () => null),
    searchPages: mock(async () => opts.pages ?? []),
    deletePage: mock(async () => {}),
  } as unknown as GBrainClient;
}

function makeResult(analyzedAt: number): OrchestratorResult {
  return {
    result_id: 'r',
    dyad_id: 'd',
    generated_at: new Date(analyzedAt).toISOString(),
    analyzed_at: analyzedAt,
    ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] },
    detectors: { ethical_refusal: { safe: true, should_refuse: false, triggers: [], category: null, confidence: 0, referral_resources: [], crisis_resources: [] } },
    summary: '', recommended_actions: [], citations: [], confidence: 0,
  };
}

function makeSnapshot(at: number): ModelSnapshot {
  const self: SelfModel = {
    user_id: 'u', attachment_indicators: { secure: 0.25, anxious: 0.25, avoidant: 0.25, disorganized: 0.25, confidence: 0 },
    horseman_profile: { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
    bid_responsiveness_baseline: 0.5, action_id_asymmetry: 0.5, recurring_templates: [],
    updated_at: new Date(at).toISOString(),
  };
  const partner: PartnerModel = {
    dyad_id: 'd', partner_id: 'p',
    communication_fingerprint: { avg_response_time_ms: 0, message_length_mean: 0, emoji_usage_rate: 0, question_frequency: 0 },
    attachment_inference: { secure: 0.25, anxious: 0.25, avoidant: 0.25, disorganized: 0.25, confidence: 0 },
    external_context_bundle: [], trigger_profile: [], bid_signature: { bid_types: {}, response_quality_distribution: {} },
    updated_at: new Date(at).toISOString(),
  };
  const relationship: RelationshipModel = {
    dyad_id: 'd', ppr_bidirectional: { user_to_partner: 0.5, partner_to_user: 0.5 },
    five_to_one_ratio: 5, bid_response_rate: { user_response_rate: 0.5, partner_response_rate: 0.5 },
    repair_labor_index: 0, mirroring_index: 0, gottman_status: 'warning', open_loops: [], rupture_repair_ledger: [],
    updated_at: new Date(at).toISOString(),
  };
  return { self, partner, relationship };
}

describe('issue #44: GBrain helpers', () => {
  it('storeDetectorResult calls upsertPage with namespaced id', async () => {
    const upsert = mock(async (p: unknown) => p);
    const client = fakeClient({ upsert });
    const r = makeResult(123);
    await storeDetectorResult('sess', r, client);
    expect(upsert).toHaveBeenCalled();
    const [arg] = upsert.mock.calls[0] as [{ id: string; kind: string }];
    expect(arg.id).toBe('sess::detector::123');
    expect(arg.kind).toBe('dyad_detector_result');
  });

  it('getDetectorHistory returns results in reverse chronological order', async () => {
    const pages = [
      { id: 'a', kind: 'dyad_detector_result', title: '', content: { session_id: 's', result: makeResult(100) }, created_at: '', updated_at: '' },
      { id: 'b', kind: 'dyad_detector_result', title: '', content: { session_id: 's', result: makeResult(300) }, created_at: '', updated_at: '' },
      { id: 'c', kind: 'dyad_detector_result', title: '', content: { session_id: 's', result: makeResult(200) }, created_at: '', updated_at: '' },
    ];
    const out = await getDetectorHistory('s', 10, fakeClient({ pages }));
    expect(out.map(r => r.analyzed_at)).toEqual([300, 200, 100]);
  });

  it('getDetectorHistory returns [] on empty / error', async () => {
    expect(await getDetectorHistory('s', 10, fakeClient({ pages: [] }))).toEqual([]);
  });

  it('storeModelSnapshot wraps payload with kind dyad_model_snapshot', async () => {
    const upsert = mock(async (p: unknown) => p);
    await storeModelSnapshot('s', makeSnapshot(42), fakeClient({ upsert }));
    expect(upsert).toHaveBeenCalled();
    const [arg] = upsert.mock.calls[0] as [{ kind: string }];
    expect(arg.kind).toBe('dyad_model_snapshot');
  });

  it('getLatestSnapshot returns most-recent and unwraps it', async () => {
    const snap = makeSnapshot(500);
    const pages = [
      { id: 'a', kind: 'dyad_model_snapshot', title: '', content: { session_id: 's', captured_at: 200, ...makeSnapshot(200) }, created_at: '', updated_at: '' },
      { id: 'b', kind: 'dyad_model_snapshot', title: '', content: { session_id: 's', captured_at: 500, ...snap }, created_at: '', updated_at: '' },
    ];
    const out = await getLatestSnapshot('s', fakeClient({ pages }));
    expect(out?.self.user_id).toBe('u');
    expect(out?.relationship.gottman_status).toBe('warning');
  });

  it('getLatestSnapshot returns null on empty', async () => {
    expect(await getLatestSnapshot('s', fakeClient({ pages: [] }))).toBeNull();
  });
});
