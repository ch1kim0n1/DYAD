import type { CareEvent, CareObservation, GmailSyncState } from '@dyad/shared';
import { GBrainClient, type GBrainPage } from './client.js';

export interface CareEventPageContent {
  session_id: string;
  event: CareEvent;
  source_message_id: string;
  extracted_at: string;
}

export interface CareObservationPageContent {
  session_id: string;
  observation: CareObservation;
  source_message_id: string;
  extracted_at: string;
}

export async function storeCareEvents(
  sessionId: string,
  events: CareEvent[],
  sourceMessageIds: Map<string, string>,
  client: GBrainClient
): Promise<void> {
  const extractedAt = new Date().toISOString();
  for (const event of events) {
    try {
      const sourceMessageId = sourceMessageIds.get(event.id) ?? 'unknown';
      await client.upsertPage({
        id: `${sessionId}::care_event::${event.id}`,
        kind: 'dyad_care_event',
        title: event.title,
        content: {
          session_id: sessionId,
          event,
          source_message_id: sourceMessageId,
          extracted_at: extractedAt,
        } satisfies CareEventPageContent,
      });
    } catch (err) {
      console.warn('[gbrain] storeCareEvents failed:', (err as Error).message);
    }
  }
}

export async function storeCareObservations(
  sessionId: string,
  observations: CareObservation[],
  sourceMessageIds: Map<string, string>,
  client: GBrainClient
): Promise<void> {
  const extractedAt = new Date().toISOString();
  for (const observation of observations) {
    try {
      const sourceMessageId = sourceMessageIds.get(observation.id) ?? 'unknown';
      await client.upsertPage({
        id: `${sessionId}::care_obs::${observation.id}`,
        kind: 'dyad_care_observation',
        title: observation.text.slice(0, 80),
        content: {
          session_id: sessionId,
          observation,
          source_message_id: sourceMessageId,
          extracted_at: extractedAt,
        } satisfies CareObservationPageContent,
      });
    } catch (err) {
      console.warn('[gbrain] storeCareObservations failed:', (err as Error).message);
    }
  }
}

export async function storeGmailSyncState(
  sessionId: string,
  state: GmailSyncState,
  client: GBrainClient
): Promise<void> {
  try {
    await client.upsertPage({
      id: `${sessionId}::gmail_sync`,
      kind: 'dyad_gmail_sync_state',
      title: 'Gmail sync state',
      content: { session_id: sessionId, ...state },
    });
  } catch (err) {
    console.warn('[gbrain] storeGmailSyncState failed:', (err as Error).message);
  }
}

export async function searchCareEvents(
  sessionId: string,
  client: GBrainClient
): Promise<CareEvent[]> {
  try {
    const pages = await client.searchPages('dyad_care_event', { session_id: sessionId });
    if (!Array.isArray(pages)) return [];
    return pages
      .map((p: GBrainPage) => {
        const content = p.content as CareEventPageContent | undefined;
        return content?.event ?? null;
      })
      .filter((e): e is CareEvent => e !== null);
  } catch {
    return [];
  }
}

export async function searchCareObservations(
  sessionId: string,
  client: GBrainClient
): Promise<CareObservation[]> {
  try {
    const pages = await client.searchPages('dyad_care_observation', { session_id: sessionId });
    if (!Array.isArray(pages)) return [];
    return pages
      .map((p: GBrainPage) => {
        const content = p.content as CareObservationPageContent | undefined;
        return content?.observation ?? null;
      })
      .filter((o): o is CareObservation => o !== null);
  } catch {
    return [];
  }
}

export function getUpcomingCareEvents(events: CareEvent[]): CareEvent[] {
  const now = Date.now();
  return events
    .filter((e) => Date.parse(e.timestamp) > now)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function getPastCareEvents(events: CareEvent[]): CareEvent[] {
  const now = Date.now();
  return events
    .filter((e) => Date.parse(e.timestamp) <= now)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
