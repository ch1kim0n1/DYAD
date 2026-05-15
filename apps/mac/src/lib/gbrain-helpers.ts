/**
 * GBrain helpers — persist analytical state and retrieve history.
 *
 * Reuses the engine's GBrainClient and adds typed helpers for the DYAD
 * page kinds: `dyad_detector_result` and `dyad_model_snapshot`.
 *
 * All helpers degrade gracefully:
 *   - storeDetectorResult / storeModelSnapshot → swallow errors, log
 *   - getDetectorHistory → returns []
 *   - getLatestSnapshot  → returns null
 */
import { GBrainClient, type GBrainPage } from '@dyad/engine';
import type {
  OrchestratorResult,
  SelfModel,
  PartnerModel,
  RelationshipModel,
} from '@dyad/shared';

export interface ModelSnapshot {
  self: SelfModel;
  partner: PartnerModel;
  relationship: RelationshipModel;
}

function defaultClient(): GBrainClient {
  return new GBrainClient();
}

export async function storeDetectorResult(
  sessionId: string,
  result: OrchestratorResult,
  client: GBrainClient = defaultClient()
): Promise<void> {
  try {
    await client.upsertPage({
      id: `${sessionId}::detector::${result.analyzed_at}`,
      kind: 'dyad_detector_result',
      title: `Detector run ${result.generated_at}`,
      content: { session_id: sessionId, result },
    });
  } catch (err) {
    console.warn('[gbrain] storeDetectorResult failed:', (err as Error).message);
  }
}

export async function getDetectorHistory(
  sessionId: string,
  limit: number = 10,
  client: GBrainClient = defaultClient()
): Promise<OrchestratorResult[]> {
  try {
    const pages = await client.searchPages('dyad_detector_result', { session_id: sessionId });
    if (!Array.isArray(pages)) return [];
    return pages
      .map((p: GBrainPage) => extractResult(p))
      .filter((r): r is OrchestratorResult => r !== null)
      .sort((a, b) => b.analyzed_at - a.analyzed_at)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function storeModelSnapshot(
  sessionId: string,
  models: ModelSnapshot,
  client: GBrainClient = defaultClient()
): Promise<void> {
  try {
    const ts = Date.now();
    await client.upsertPage({
      id: `${sessionId}::snapshot::${ts}`,
      kind: 'dyad_model_snapshot',
      title: `Model snapshot ${new Date(ts).toISOString()}`,
      content: { session_id: sessionId, captured_at: ts, ...models },
    });
  } catch (err) {
    console.warn('[gbrain] storeModelSnapshot failed:', (err as Error).message);
  }
}

export async function getLatestSnapshot(
  sessionId: string,
  client: GBrainClient = defaultClient()
): Promise<ModelSnapshot | null> {
  try {
    const pages = await client.searchPages('dyad_model_snapshot', { session_id: sessionId });
    if (!Array.isArray(pages) || pages.length === 0) return null;
    const latest = pages
      .map((p: GBrainPage) => extractSnapshot(p))
      .filter((s): s is { captured_at: number; snapshot: ModelSnapshot } => s !== null)
      .sort((a, b) => b.captured_at - a.captured_at)[0];
    return latest?.snapshot ?? null;
  } catch {
    return null;
  }
}

function extractResult(page: GBrainPage): OrchestratorResult | null {
  const content = page.content as { result?: OrchestratorResult } | undefined;
  return content?.result ?? null;
}

function extractSnapshot(
  page: GBrainPage
): { captured_at: number; snapshot: ModelSnapshot } | null {
  const content = page.content as
    | (ModelSnapshot & { captured_at?: number })
    | undefined;
  if (!content || !content.self || !content.partner || !content.relationship) return null;
  return {
    captured_at: content.captured_at ?? 0,
    snapshot: {
      self: content.self,
      partner: content.partner,
      relationship: content.relationship,
    },
  };
}
