import { fetchIcsEvents, type ParsedCalendarEvent } from './calendar-ics-reader.js';
import { CareCircleGBrainStore, type CareCircleGBrainPage } from './carecircle-gbrain-store.js';

export const CALENDAR_EVENT_KIND = 'carecircle_calendar_event';
export const CALENDAR_SYNC_KIND = 'carecircle_calendar_sync_state';

export interface CareCalendarGBrainBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  source: 'shared_calendar';
}

export interface CalendarSyncResult {
  synced: number;
  upcoming: CareCalendarGBrainBlock[];
  past: CareCalendarGBrainBlock[];
  lastSyncAt: string;
  icsUrlConfigured: boolean;
}

export function calendarEventPageId(uid: string): string {
  const safe = uid.replace(/[^a-zA-Z0-9._@-]+/g, '_').slice(0, 120);
  return `carecircle::calendar::${safe}`;
}

function eventToPage(event: ParsedCalendarEvent): Omit<CareCircleGBrainPage, 'created_at' | 'updated_at'> {
  return {
    id: calendarEventPageId(event.uid),
    kind: CALENDAR_EVENT_KIND,
    title: event.summary,
    content: {
      uid: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      location: event.location ?? '',
      description: event.description ?? '',
      source: 'shared_calendar',
    },
  };
}

function pageToBlock(page: CareCircleGBrainPage): CareCalendarGBrainBlock {
  const c = page.content;
  return {
    id: String(c.uid ?? page.id),
    title: page.title,
    start: String(c.start ?? ''),
    end: String(c.end ?? ''),
    location: String(c.location ?? ''),
    source: 'shared_calendar',
  };
}

function splitBlocks(blocks: CareCalendarGBrainBlock[]): {
  upcoming: CareCalendarGBrainBlock[];
  past: CareCalendarGBrainBlock[];
} {
  const now = Date.now();
  return {
    upcoming: blocks
      .filter((b) => Date.parse(b.start) >= now)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    past: blocks
      .filter((b) => Date.parse(b.start) < now)
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start)),
  };
}

export async function syncCalendarIcsToGBrain(
  store: CareCircleGBrainStore,
  icsUrl: string
): Promise<CalendarSyncResult> {
  const events = await fetchIcsEvents(icsUrl);
  store.clearKind(CALENDAR_EVENT_KIND);

  for (const event of events) {
    store.upsertPage(eventToPage(event));
  }

  const lastSyncAt = new Date().toISOString();
  store.upsertPage({
    id: 'carecircle::calendar::sync_state',
    kind: CALENDAR_SYNC_KIND,
    title: 'Calendar sync state',
    content: {
      last_sync_at: lastSyncAt,
      event_count: events.length,
      feed_configured: true,
    },
  });

  const blocks = events.map((e) => ({
    id: e.uid,
    title: e.summary,
    start: e.start,
    end: e.end,
    location: e.location,
    source: 'shared_calendar' as const,
  }));

  const { upcoming, past } = splitBlocks(blocks);

  return {
    synced: events.length,
    upcoming,
    past,
    lastSyncAt,
    icsUrlConfigured: true,
  };
}

export function listCalendarBlocksFromGBrain(store: CareCircleGBrainStore): {
  upcoming: CareCalendarGBrainBlock[];
  past: CareCalendarGBrainBlock[];
  lastSyncAt?: string;
} {
  const pages = store.listPages(CALENDAR_EVENT_KIND);
  const blocks = pages.map(pageToBlock).filter((b) => b.start);

  const syncPage = store.getPage('carecircle::calendar::sync_state');
  const lastSyncAt =
    syncPage?.content?.last_sync_at != null ? String(syncPage.content.last_sync_at) : undefined;

  return { ...splitBlocks(blocks), lastSyncAt };
}

export function normalizeIcsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('ICS URL is required');
  const withProtocol = trimmed.replace(/^webcal:/i, 'https:');
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('ICS link must use http://, https://, or webcal://');
  }
  return url.toString();
}

export function getCalendarIcsUrlFromEnv(): string | undefined {
  const url = process.env.CARECIRCLE_CALENDAR_ICS_URL?.trim();
  return url || undefined;
}
