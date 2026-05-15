#!/usr/bin/env bun
/**
 * Engine sidecar — Tauri spawns this as a subprocess. Exposes the full
 * @dyad/engine + @dyad/ingestion + GStack/GBrain/Hog/Jo wiring over
 * `localhost:7432` so the React frontend can drive analysis end-to-end.
 *
 * Endpoints:
 *   GET  /status         → { ok, pipeline_ready, brief_ready, … }
 *   POST /load-messages  → { messages: NormalizedMessage[] } (reads chat.db)
 *   POST /analyze        → OrchestratorResult (persists to GBrain + GStack)
 *   POST /brief          → { brief }
 *   POST /reframe        → { reframe }
 *   POST /jo/refresh     → { jo_context | null }
 *
 * Hog (partner context) and Jo (user life context) are fetched once per
 * analyze call when their URLs are configured and threaded into the
 * brief / reframe prompts.
 */
import { serve } from 'bun';
import {
  DetectorOrchestrator,
  BriefGenerator,
  ReframeGenerator,
  ExtractionPipeline,
  RelationshipModelUpdater,
  SelfModelUpdater,
  PartnerModelUpdater,
  GBrainClient,
  type DetectorType,
} from '@dyad/engine';
import { ChatDbReader, MessageNormalizer, PIIRedactor } from '@dyad/ingestion';
import type {
  FeatureVector,
  NormalizedMessage,
  OrchestratorResult,
  RelationshipModel,
} from '@dyad/shared';

const PORT = Number(process.env.DYAD_SIDECAR_PORT ?? 7432);
const DYAD_ID = process.env.DYAD_CONVERSATION_ID ?? 'default';
const HOG_URL = process.env.HOG_URL;
const HOG_KEY = process.env.THE_HOG_API_KEY;
const JO_URL = process.env.JO_URL;
const JO_KEY = process.env.JO_API_KEY;

// ─── lazy components (some need an API key, some don't) ──────────────────
function tryBuild<T>(fn: () => T): T | null {
  try { return fn(); } catch { return null; }
}
const orchestrator = new DetectorOrchestrator({ dyadId: DYAD_ID });
const briefGen = tryBuild(() => new BriefGenerator());
const reframeGen = tryBuild(() => new ReframeGenerator());
const pipeline = tryBuild(() => new ExtractionPipeline());
const gbrain = new GBrainClient();

// GBrain helpers — bridge takes the engine's GBrainClient
async function storeDetectorResult(sessionId: string, result: OrchestratorResult): Promise<void> {
  try {
    await gbrain.upsertPage({
      id: `${sessionId}::detector::${result.analyzed_at}`,
      kind: 'dyad_detector_result',
      title: `Detector run ${result.generated_at}`,
      content: { session_id: sessionId, result },
    });
  } catch { /* GBrain optional */ }
}
async function storeModelSnapshot(sessionId: string, snapshot: unknown): Promise<void> {
  try {
    const ts = Date.now();
    await gbrain.upsertPage({
      id: `${sessionId}::snapshot::${ts}`,
      kind: 'dyad_model_snapshot',
      title: `Model snapshot ${new Date(ts).toISOString()}`,
      content: { session_id: sessionId, captured_at: ts, ...snapshot as Record<string, unknown> },
    });
  } catch { /* GBrain optional */ }
}

// ─── GStack session at boot ──────────────────────────────────────────────
interface GStackSession { session_id: string; pipeline: string; conversation_id: string }
let gstackSessionId: string | null = null;
async function gstackCreateOrResume(): Promise<void> {
  const url = process.env.GSTACK_URL;
  const key = process.env.GSTACK_API_KEY;
  if (!url || !key) {
    console.log('[dyad-sidecar] GStack unconfigured; running stand-alone');
    return;
  }
  try {
    const res = await fetch(`${url}/sessions/create-or-resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ pipeline: 'dyad', conversation_id: DYAD_ID }),
    });
    if (!res.ok) return;
    const data = await res.json() as GStackSession;
    gstackSessionId = data.session_id;
    console.log(`[dyad-sidecar] GStack session: ${gstackSessionId}`);
  } catch (err) {
    console.warn('[dyad-sidecar] GStack createOrResume failed:', (err as Error).message);
  }
}
async function gstackSetState(key: string, value: unknown): Promise<void> {
  if (!gstackSessionId || !process.env.GSTACK_URL || !process.env.GSTACK_API_KEY) return;
  try {
    await fetch(`${process.env.GSTACK_URL}/sessions/${encodeURIComponent(gstackSessionId)}/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GSTACK_API_KEY}` },
      body: JSON.stringify({ value }),
    });
  } catch { /* graceful */ }
}

// ─── Hog / Jo enrichment (server-side, cached) ───────────────────────────
interface HogContext { partner_summary: string; recent_events: string[]; enriched_at: number }
interface JoContext { recent_calendar_summary: string; mood_indicators: string[]; contextualized_at: number }
const HOG_TTL = 60 * 60 * 1000;
const JO_TTL = 30 * 60 * 1000;
const hogCache = new Map<string, { v: HogContext; expires: number }>();
let joCache: { v: JoContext; expires: number } | null = null;

async function fetchHog(conversationId: string): Promise<HogContext | null> {
  if (!HOG_URL) return null;
  const now = Date.now();
  const hit = hogCache.get(conversationId);
  if (hit && hit.expires > now) return hit.v;
  try {
    const res = await fetch(`${HOG_URL.replace(/\/$/, '')}/enrich`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(HOG_KEY ? { authorization: `Bearer ${HOG_KEY}` } : {}) },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Partial<HogContext> & { partnerSummary?: string; recentEvents?: string[] };
    const v: HogContext = {
      partner_summary: data.partner_summary ?? data.partnerSummary ?? '',
      recent_events: data.recent_events ?? data.recentEvents ?? [],
      enriched_at: data.enriched_at ?? now,
    };
    hogCache.set(conversationId, { v, expires: now + HOG_TTL });
    return v;
  } catch { return null; }
}

async function fetchJo(): Promise<JoContext | null> {
  if (!JO_URL) return null;
  const now = Date.now();
  if (joCache && joCache.expires > now) return joCache.v;
  try {
    const res = await fetch(`${JO_URL.replace(/\/$/, '')}/context`, {
      headers: JO_KEY ? { authorization: `Bearer ${JO_KEY}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json() as Partial<JoContext> & { recentCalendarSummary?: string; moodIndicators?: string[] };
    const v: JoContext = {
      recent_calendar_summary: data.recent_calendar_summary ?? data.recentCalendarSummary ?? '',
      mood_indicators: data.mood_indicators ?? data.moodIndicators ?? [],
      contextualized_at: data.contextualized_at ?? now,
    };
    joCache = { v, expires: now + JO_TTL };
    return v;
  } catch { return null; }
}

function enrichmentString(hog: HogContext | null, jo: JoContext | null): string {
  const parts: string[] = [];
  if (hog?.partner_summary) {
    parts.push(`Context about partner: ${hog.partner_summary}`);
    if (hog.recent_events.length > 0) parts.push(`Recent partner events: ${hog.recent_events.join('; ')}`);
  }
  if (jo?.recent_calendar_summary) {
    const moods = jo.mood_indicators.length > 0 ? ` Moods: ${jo.mood_indicators.join(', ')}.` : '';
    parts.push(`User's recent life context: ${jo.recent_calendar_summary}.${moods}`.trim());
  }
  return parts.join('\n');
}

// ─── HTTP plumbing ───────────────────────────────────────────────────────
async function readBody<T>(req: Request): Promise<T> {
  return JSON.parse(await req.text()) as T;
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

interface AnalyzeRequest {
  messages: NormalizedMessage[];
  features?: FeatureVector[];
}
interface BriefRequest {
  detectorType: DetectorType;
  result: OrchestratorResult;
  messages: NormalizedMessage[];
}
interface ReframeRequest extends BriefRequest { brief: string }
interface LoadMessagesRequest {
  chatId?: string;
  since?: number;
}

const server = serve({
  port: PORT,
  // Bind only to loopback (#69). Without this, Bun defaults to 0.0.0.0
  // and the sidecar would be reachable from anyone on the LAN.
  hostname: '127.0.0.1',
  development: false,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/status') {
      return json({
        ok: true,
        pipeline_ready: pipeline !== null,
        brief_ready: briefGen !== null,
        reframe_ready: reframeGen !== null,
        dyad_id: DYAD_ID,
        gstack_session: gstackSessionId,
        hog_configured: Boolean(HOG_URL),
        jo_configured: Boolean(JO_URL),
      });
    }

    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
      // ── /load-messages ────────────────────────────────────────────────
      if (url.pathname === '/load-messages') {
        const body = await readBody<LoadMessagesRequest>(req);
        try {
          const reader = new ChatDbReader();
          const normaliser = new MessageNormalizer();
          const redactor = new PIIRedactor();
          const raw = body.chatId
            ? reader.readMessages(body.chatId, body.since)
            : reader.readAllMessages(body.since);
          const messages = normaliser.normalizeBatch(
            raw,
            new Map(raw.map(r => [`${r.rowid}`, redactor.redact(r.text)]))
          );
          reader.close();
          return json({ messages });
        } catch (err) {
          // chat.db unreadable on this machine (e.g. running off macOS or
          // without Full Disk Access). Return empty array — frontend can
          // still load fixtures.
          console.warn('[sidecar] /load-messages failed:', (err as Error).message);
          return json({ messages: [], error: (err as Error).message }, 200);
        }
      }

      // ── /jo/refresh ───────────────────────────────────────────────────
      if (url.pathname === '/jo/refresh') {
        const jo = await fetchJo();
        return json({ jo_context: jo });
      }

      // ── /chat-summary — onboarding conversation picker (#68) ─────────
      if (url.pathname === '/chat-summary') {
        try {
          const reader = new ChatDbReader();
          const chatIds = reader.getChatIds();
          const conversations = chatIds
            .slice(0, 25)
            .map(id => ({ chat_id: id, message_count: reader.readMessages(id).length }))
            .sort((a, b) => b.message_count - a.message_count);
          reader.close();
          return json({ conversations });
        } catch (err) {
          return json({ conversations: [], error: (err as Error).message }, 200);
        }
      }

      // ── /permissions/full-disk-access — onboarding probe (#68) ───────
      if (url.pathname === '/permissions/full-disk-access') {
        try {
          const reader = new ChatDbReader();
          reader.close();
          return json({ granted: true });
        } catch (err) {
          return json({ granted: false, error: (err as Error).message });
        }
      }

      // ── /analyze ──────────────────────────────────────────────────────
      if (url.pathname === '/analyze') {
        const body = await readBody<AnalyzeRequest>(req);
        let features = body.features;
        if (!features) {
          if (!pipeline) return json({ error: 'extraction pipeline unavailable (missing ANTHROPIC_API_KEY)' }, 503);
          features = await pipeline.processBatch(body.messages);
        }

        const [hog, jo] = await Promise.all([fetchHog(DYAD_ID), fetchJo()]);

        const selfUpdater = new SelfModelUpdater(DYAD_ID);
        if (jo) selfUpdater.setJoContext(jo);
        const selfModel = selfUpdater.update(features, body.messages);
        selfUpdater.save();

        const partnerUpdater = new PartnerModelUpdater(DYAD_ID, `${DYAD_ID}-partner`);
        const partnerModel = partnerUpdater.update(features, body.messages);
        partnerUpdater.save();

        const relUpdater = new RelationshipModelUpdater(DYAD_ID);
        const relationshipModel: RelationshipModel = relUpdater.update(features, body.messages);
        relUpdater.save();

        const result = await orchestrator.run({
          messages: body.messages,
          features,
          relationshipModel,
        });

        // Persist analytical state — gracefully no-op when unreachable
        await Promise.all([
          storeDetectorResult(gstackSessionId ?? DYAD_ID, result),
          storeModelSnapshot(gstackSessionId ?? DYAD_ID, { self: selfModel, partner: partnerModel, relationship: relationshipModel }),
          gstackSetState('relationship-model', relationshipModel),
          gstackSetState('self-model', selfModel),
          gstackSetState('partner-model', partnerModel),
        ]);

        return json(result);
      }

      // ── /brief ───────────────────────────────────────────────────────
      if (url.pathname === '/brief') {
        if (!briefGen) return json({ error: 'brief generator unavailable' }, 503);
        const body = await readBody<BriefRequest>(req);
        const [hog, jo] = await Promise.all([fetchHog(DYAD_ID), fetchJo()]);
        const extra = enrichmentString(hog, jo);
        const text = await briefGen.generate(body.detectorType, body.result, body.messages, extra || undefined);
        return json({ brief: text });
      }

      // ── /reframe ─────────────────────────────────────────────────────
      if (url.pathname === '/reframe') {
        if (!reframeGen) return json({ error: 'reframe generator unavailable' }, 503);
        const body = await readBody<ReframeRequest>(req);
        const [hog, jo] = await Promise.all([fetchHog(DYAD_ID), fetchJo()]);
        const extra = enrichmentString(hog, jo);
        const text = await reframeGen.generate(
          body.detectorType,
          body.result,
          body.brief,
          body.messages,
          extra || undefined
        );
        return json({ reframe: text });
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  },
});

await gstackCreateOrResume();
console.log(`[dyad-sidecar] listening on http://localhost:${server.port}`);
