import type { CareCircleGBrainStore, CareCircleGBrainPage } from './carecircle-gbrain-store.js';
import { MEDICATION_KIND, MEDICATION_REGISTRY_ID } from './medication-gbrain.js';
import { CALENDAR_EVENT_KIND } from './sync-calendar-gbrain.js';
import type { CareRecentEvent, CareRecentEventsSummary } from '../views/carecircleRecentEvents.js';

const SOURCE_KIND = 'carecircle_source_document';

function pageToEvent(page: CareCircleGBrainPage): CareRecentEvent | null {
  const c = page.content;
  const path = String(c.path ?? '');
  const recencyRank = c.recency_rank;
  if (recencyRank == null || typeof recencyRank !== 'number') return null;

  return {
    path,
    title: page.title,
    source: String(c.source ?? ''),
    text: String(c.text ?? ''),
    whenLabel: String(c.when_label ?? 'This week'),
    person: String((c.metadata as Record<string, unknown>)?.person ?? 'family'),
  };
}

function synthesizeSummary(events: CareRecentEvent[], documentCount: number): string {
  if (events.length === 0) {
    return 'GBrain has no timeline events yet. Run `bun run carecircle:seed-gbrain` to load the demo corpus.';
  }

  const headline = events.slice(0, 4).map((e) => e.title.toLowerCase()).join(', ');
  const medical = events.some((e) => e.path.includes('pharmacy') || e.path.includes('med'));
  const meals = events.filter((e) => e.title.toLowerCase().includes('lunch')).length;
  const appointment = events.some((e) => e.title.toLowerCase().includes('appointment'));

  const parts: string[] = [
    `From GBrain (${documentCount} source pages), the most recent thread centers on ${headline}.`,
  ];

  if (medical) {
    parts.push(
      'A new blood pressure medication and morning dizziness are noted; CareCircle keeps this in human-review language only.',
    );
  }
  if (meals >= 2) {
    parts.push('Family notes logged two skipped lunches this week, flagged for gentle follow-up—not diagnosis.');
  }
  if (appointment) {
    parts.push('Linda asked about the Dr. Chen appointment more than once; Arjun is staged to confirm and remind the family.');
  }

  parts.push('Sarah owns the pharmacy call; Maya is coordinating check-ins with low-pressure tone.');

  return parts.join(' ');
}

export function buildRecentEventsFromGBrain(store: CareCircleGBrainStore): CareRecentEventsSummary {
  const pages = store
    .listPages(SOURCE_KIND)
    .filter((p) => typeof p.content.recency_rank === 'number')
    .sort((a, b) => (a.content.recency_rank as number) - (b.content.recency_rank as number));

  const events = pages.map(pageToEvent).filter((e): e is CareRecentEvent => e !== null);
  const allPages = store.listPages(SOURCE_KIND);

  return {
    summary: synthesizeSummary(events, allPages.length),
    events: events.slice(0, 6),
    documentCount: allPages.length,
    eventSourceCount: events.length,
    generatedAt: new Date().toISOString(),
    gbrainSlug: 'carecircle/dashboard/recent-events',
  };
}

export interface GBrainSearchHit {
  path: string;
  title: string;
  source: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

function searchHaystack(page: CareCircleGBrainPage): string {
  const c = page.content;
  if (page.kind === MEDICATION_KIND) {
    return `${page.title} ${c.name ?? ''} ${c.dosage ?? ''} ${c.schedule ?? ''} ${c.notes ?? ''} ${JSON.stringify(c.medications ?? {})}`.toLowerCase();
  }
  return `${page.title} ${c.source} ${c.summary ?? ''} ${c.text} ${c.description ?? ''} ${c.location ?? ''} ${JSON.stringify(c.metadata ?? {})}`.toLowerCase();
}

function searchHitText(page: CareCircleGBrainPage): string {
  const c = page.content;
  if (page.kind === MEDICATION_KIND) {
    const parts = [c.dosage, c.schedule, c.notes].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : String(c.name ?? page.title);
  }
  return String(c.text ?? c.description ?? page.title);
}

export function searchCareCircleGBrain(
  store: CareCircleGBrainStore,
  query: string
): {
  status: string;
  source: string;
  summary: string;
  indexedDocuments: number;
  results: GBrainSearchHit[];
} {
  const normalizedQuery = query.trim().toLowerCase();
  const pages = [
    ...store.listPages(SOURCE_KIND),
    ...store.listPages(CALENDAR_EVENT_KIND),
    ...store.listPages(MEDICATION_KIND),
  ];
  const terms = normalizedQuery
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const queryTokens = terms.length > 0 ? terms : normalizedQuery.length > 2 ? [normalizedQuery] : [];

  const results = pages
    .map((page) => {
      const c = page.content;
      const haystack = searchHaystack(page);
      let score = queryTokens.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);

      if (page.kind === MEDICATION_KIND && normalizedQuery.length > 2) {
        if (haystack.includes(normalizedQuery)) score += 5;
        // Individual medication pages rank above the registry when their title matches directly
        if (page.id !== MEDICATION_REGISTRY_ID && page.title.toLowerCase().includes(normalizedQuery)) {
          score += 3;
        }
      }

      const sourceLabel =
        page.kind === MEDICATION_KIND
          ? page.id === MEDICATION_REGISTRY_ID
            ? 'medication registry'
            : 'manual medication'
          : String(c.source ?? 'shared calendar');

      return {
        path: String(c.path ?? c.uid ?? page.id),
        title: page.title,
        source: sourceLabel,
        text: searchHitText(page),
        score,
        metadata: (c.metadata as Record<string, unknown>) ?? {},
      };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    status: 'ready',
    source: 'gbrain',
    summary:
      results.length > 0
        ? 'I searched GBrain family context and pulled the strongest sources behind this care plan.'
        : 'No GBrain matches for that query. Try a medication name, dizziness, lunch, appointment, or pharmacy.',
    indexedDocuments: pages.length,
    results,
  };
}
