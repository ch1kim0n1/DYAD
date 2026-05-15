#!/usr/bin/env bun
/**
 * Engine sidecar — a tiny HTTP server that exposes the @dyad/engine pipeline
 * to the Tauri-hosted React frontend over `localhost:7432`.
 *
 * Endpoints:
 *   GET  /status            → { ok: true }
 *   POST /analyze           → OrchestratorResult
 *   POST /brief             → { brief }
 *   POST /reframe           → { reframe }
 *
 * Launched as a Tauri sidecar via tauri-plugin-shell on app startup.
 * Logs go to stdout (Tauri forwards them to its devtools console).
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
  type DetectorType,
} from '@dyad/engine';
import type {
  FeatureVector,
  NormalizedMessage,
  OrchestratorResult,
} from '@dyad/shared';

const PORT = Number(process.env.DYAD_SIDECAR_PORT ?? 7432);
const DYAD_ID = process.env.DYAD_CONVERSATION_ID ?? 'default';

// Lazy-init the LLM-backed pieces; they throw without an API key.
function buildOrchestrator(): DetectorOrchestrator {
  return new DetectorOrchestrator({ dyadId: DYAD_ID });
}
function buildBrief(): BriefGenerator | null {
  try {
    return new BriefGenerator();
  } catch {
    return null;
  }
}
function buildReframe(): ReframeGenerator | null {
  try {
    return new ReframeGenerator();
  } catch {
    return null;
  }
}
function buildPipeline(): ExtractionPipeline | null {
  try {
    return new ExtractionPipeline();
  } catch {
    return null;
  }
}

const orchestrator = buildOrchestrator();
const briefGen = buildBrief();
const reframeGen = buildReframe();
const pipeline = buildPipeline();

async function readBody<T>(req: Request): Promise<T> {
  const text = await req.text();
  return JSON.parse(text) as T;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

interface AnalyzeRequest {
  messages: NormalizedMessage[];
  features?: FeatureVector[];   // optional — if omitted, sidecar runs extraction first
}

interface BriefRequest {
  detectorType: DetectorType;
  result: OrchestratorResult;
  messages: NormalizedMessage[];
}

interface ReframeRequest extends BriefRequest {
  brief: string;
}

const server = serve({
  port: PORT,
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
      });
    }

    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
      if (url.pathname === '/analyze') {
        const body = await readBody<AnalyzeRequest>(req);
        let features = body.features;
        if (!features) {
          if (!pipeline) return json({ error: 'extraction pipeline unavailable (missing ANTHROPIC_API_KEY)' }, 503);
          features = await pipeline.processBatch(body.messages);
        }
        // Update models so the result reflects the latest state
        const selfUpdater = new SelfModelUpdater(DYAD_ID);
        selfUpdater.update(features, body.messages);
        selfUpdater.save();
        const partnerUpdater = new PartnerModelUpdater(DYAD_ID, `${DYAD_ID}-partner`);
        partnerUpdater.update(features, body.messages);
        partnerUpdater.save();
        const relUpdater = new RelationshipModelUpdater(DYAD_ID);
        const relModel = relUpdater.update(features, body.messages);
        relUpdater.save();

        const result = await orchestrator.run({
          messages: body.messages,
          features,
          relationshipModel: relModel,
        });
        return json(result);
      }

      if (url.pathname === '/brief') {
        if (!briefGen) return json({ error: 'brief generator unavailable' }, 503);
        const body = await readBody<BriefRequest>(req);
        const text = await briefGen.generate(body.detectorType, body.result, body.messages);
        return json({ brief: text });
      }

      if (url.pathname === '/reframe') {
        if (!reframeGen) return json({ error: 'reframe generator unavailable' }, 503);
        const body = await readBody<ReframeRequest>(req);
        const text = await reframeGen.generate(body.detectorType, body.result, body.brief, body.messages);
        return json({ reframe: text });
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return json({ error: (err as Error).message }, 500);
    }
  },
});

console.log(`[dyad-sidecar] listening on http://localhost:${server.port}`);
