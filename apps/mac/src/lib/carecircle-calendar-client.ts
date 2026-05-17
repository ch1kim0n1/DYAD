import type { CareCalendarBlock } from '../views/carecircleRuntime.js';

export interface CalendarSyncResponse {
  synced: number;
  upcoming: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    source: string;
  }>;
  past: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    source: string;
  }>;
  lastSyncAt: string;
  source: 'gbrain';
  error?: string;
}

export interface CalendarListResponse {
  upcoming: CalendarSyncResponse['upcoming'];
  past: CalendarSyncResponse['past'];
  lastSyncAt?: string;
  source: 'gbrain';
}

export async function syncCalendarToGBrain(icsUrl: string): Promise<CalendarSyncResponse> {
  const response = await fetch('/api/carecircle/calendar-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ icsUrl }),
  });
  const data = (await response.json()) as CalendarSyncResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Calendar sync failed (${response.status})`);
  }
  return data;
}

export async function fetchCalendarFromGBrain(): Promise<CalendarListResponse> {
  const response = await fetch('/api/carecircle/calendar-events', { method: 'GET' });
  const data = (await response.json()) as CalendarListResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Failed to load calendar (${response.status})`);
  }
  return data;
}

export function gbrainBlocksToCareBlocks(
  blocks: CalendarListResponse['upcoming']
): CareCalendarBlock[] {
  return blocks.map((block) => ({
    id: `gbrain-cal-${block.id}`,
    title: block.title,
    start: block.start,
    end: block.end,
  }));
}

export function formatCalendarWhen(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
