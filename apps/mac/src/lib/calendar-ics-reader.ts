export interface ParsedCalendarEvent {
  uid: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface FetchIcsOptions {
  pastDays?: number;
  futureDays?: number;
}

export async function fetchIcsEvents(
  icsUrl: string,
  options: FetchIcsOptions = {}
): Promise<ParsedCalendarEvent[]> {
  const pastDays = options.pastDays ?? 7;
  const futureDays = options.futureDays ?? 60;

  const response = await fetch(icsUrl, {
    headers: { accept: 'text/calendar,text/plain,*/*' },
  });
  if (!response.ok) {
    throw new Error(`ICS fetch failed: ${response.status} ${response.statusText}`);
  }

  const icsText = await response.text();
  const parsed = parseIcsCalendar(icsText);
  const now = Date.now();
  const min = now - pastDays * 24 * 60 * 60 * 1000;
  const max = now + futureDays * 24 * 60 * 60 * 1000;

  return parsed
    .filter((event) => {
      const startMs = Date.parse(event.start);
      return startMs >= min && startMs <= max;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function parseIcsCalendar(icsText: string): ParsedCalendarEvent[] {
  const unfolded = unfoldIcsLines(icsText);
  const events: ParsedCalendarEvent[] = [];

  for (const block of unfolded.split('BEGIN:VEVENT')) {
    if (!block.includes('END:VEVENT')) continue;
    const chunk = block.split('END:VEVENT')[0] ?? '';
    const uid = readIcsProperty(chunk, 'UID');
    const summary = readIcsProperty(chunk, 'SUMMARY') || 'Untitled event';
    const dtstart = readIcsProperty(chunk, 'DTSTART');
    if (!uid || !dtstart) continue;

    const dtend = readIcsProperty(chunk, 'DTEND') || dtstart;
    const start = icsDateToIso(dtstart);
    const end = icsDateToIso(dtend);
    if (!start) continue;

    events.push({
      uid,
      summary: unescapeIcsText(summary),
      start,
      end: end ?? start,
      location: unescapeIcsText(readIcsProperty(chunk, 'LOCATION') || ''),
      description: unescapeIcsText(readIcsProperty(chunk, 'DESCRIPTION') || ''),
    });
  }

  return events;
}

function unfoldIcsLines(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .reduce((acc, line) => {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        acc[acc.length - 1] += line.slice(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, [] as string[])
    .join('\n');
}

function readIcsProperty(chunk: string, name: string): string {
  const re = new RegExp(`^${name}[^\\n:]*:(.*)$`, 'im');
  const match = chunk.match(re);
  return match?.[1]?.trim() ?? '';
}

function icsDateToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{8}T\d{6}Z$/i.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }

  if (/^\d{8}T\d{6}$/i.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }

  if (/^\d{8}$/.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T12:00:00.000Z`;
    return new Date(iso).toISOString();
  }

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
