import type { CareEvent, CareObservation, NormalizedEmail } from '@dyad/shared';
import * as crypto from 'node:crypto';

export interface CareExtractionResult {
  events: CareEvent[];
  observations: CareObservation[];
}

const PHARMACY_PATTERNS = [
  /\b(cvs|walgreens|rite aid|costco pharmacy|mail.?order|pharmacy|prescription|refill|rx\b|medication ready)/i,
  /\b(order confirmed|your prescription)/i,
];

const APPOINTMENT_PATTERNS = [
  /\b(appointment|scheduled|reminder|telehealth|office visit|check-?up|see you (on|at)|visit with dr)/i,
  /\b(health system|patient portal|mychart|zocdoc)/i,
];

const FAMILY_PATTERNS = [
  /\b(mom|dad|mother|father|sister|brother|family|grandma|grandpa|aunt|uncle)\b/i,
  /\b(calling you|miss you|love you|checking in)\b/i,
];

function stableId(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 24);
}

function parseFamilyHints(): string[] {
  const raw = process.env.DYAD_FAMILY_SENDERS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function matchesFamily(from: string, subject: string, body: string, hints: string[]): boolean {
  const blob = `${from} ${subject} ${body}`.toLowerCase();
  if (hints.some((h) => blob.includes(h))) return true;
  return matchesAny(blob, FAMILY_PATTERNS);
}

function inferEventTimestamp(email: NormalizedEmail): string {
  return email.timestamp;
}

function inferFutureTimestamp(email: NormalizedEmail, category: CareEvent['category']): string {
  const base = Date.parse(email.timestamp);
  const body = `${email.subject} ${email.body_text}`.toLowerCase();

  const dateMatch = body.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?/i
  );
  if (dateMatch) {
    const parsed = Date.parse(dateMatch[0]);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  const isoMatch = body.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const parsed = Date.parse(isoMatch[0]);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  if (category === 'appointment' && /\b(tomorrow|next week)\b/i.test(body)) {
    const offset = /\btomorrow\b/i.test(body) ? 86_400_000 : 7 * 86_400_000;
    return new Date(base + offset).toISOString();
  }

  return email.timestamp;
}

export class CareEventExtractor {
  extract(emails: NormalizedEmail[]): CareExtractionResult {
    const events: CareEvent[] = [];
    const observations: CareObservation[] = [];
    const familyHints = parseFamilyHints();

    for (const email of emails) {
      const text = `${email.subject} ${email.snippet} ${email.body_text}`;
      const categories: CareEvent['category'][] = [];

      if (matchesAny(text, PHARMACY_PATTERNS)) categories.push('medication');
      if (email.has_ics_attachment || matchesAny(text, APPOINTMENT_PATTERNS)) {
        categories.push('appointment');
      }
      if (matchesFamily(email.from_id, email.subject, email.body_text, familyHints)) {
        categories.push('family_call');
      }

      if (categories.length === 0) continue;

      const obsId = stableId(['obs', email.message_id]);
      const observation: CareObservation = {
        id: obsId,
        personId: 'email',
        text: email.subject || email.snippet.slice(0, 120) || 'Email',
        timestamp: email.timestamp,
        source: categories.includes('medication')
          ? 'medication'
          : categories.includes('appointment')
            ? 'appointment'
            : 'message',
        tags: ['gmail', `msg:${email.message_id}`, ...categories],
        sensitivity: categories.includes('appointment') ? 'medium' : 'low',
      };
      observations.push(observation);

      for (const category of categories) {
        const eventId = stableId(['evt', email.message_id, category]);
        const ts =
          Date.parse(inferFutureTimestamp(email, category)) > Date.now() &&
          category === 'appointment'
            ? inferFutureTimestamp(email, category)
            : inferEventTimestamp(email);

        events.push({
          id: eventId,
          title: buildTitle(email, category),
          timestamp: ts,
          category,
          relatedPersonIds: ['email'],
          linkedObservationIds: [obsId],
        });
      }
    }

    return { events, observations };
  }
}

function buildTitle(email: NormalizedEmail, category: CareEvent['category']): string {
  const subj = email.subject.trim();
  if (subj) return subj.slice(0, 120);
  switch (category) {
    case 'medication':
      return 'Medication-related email';
    case 'appointment':
      return 'Appointment-related email';
    case 'family_call':
      return 'Family communication';
    default:
      return 'Care-related email';
  }
}

export function partitionCareEvents(events: CareEvent[]): {
  upcoming: CareEvent[];
  past: CareEvent[];
} {
  const now = Date.now();
  const upcoming: CareEvent[] = [];
  const past: CareEvent[] = [];
  for (const event of events) {
    if (Date.parse(event.timestamp) > now) upcoming.push(event);
    else past.push(event);
  }
  upcoming.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  past.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return { upcoming, past };
}
