import type { CareCircleGBrainStore, CareCircleGBrainPage } from './carecircle-gbrain-store.js';
import { CALENDAR_EVENT_KIND } from './sync-calendar-gbrain.js';

export const MEDICATION_KIND = 'carecircle_medication';
export const MEDICATION_REGISTRY_ID = 'carecircle::medication::registry';

const SOURCE_KIND = 'carecircle_source_document';

const MEDICATION_KEYWORDS = [
  'medication',
  'medicine',
  'pharmacy',
  'pill',
  'dosage',
  'prescription',
  'rx',
  'blood pressure',
  'side effect',
  'refill',
];

export interface CareManualMedication {
  id: string;
  name: string;
  dosage: string;
  schedule: string;
  personId: string;
  notes: string;
  addedAt: string;
}

export interface MedicationGBrainHit {
  pageId: string;
  title: string;
  source: string;
  text: string;
  score: number;
  kind: string;
  matchedTerms: string[];
}

export interface MedicationGBrainSnapshot {
  manual: CareManualMedication[];
  gbrainMatches: MedicationGBrainHit[];
  summary: string;
  scannedAt: string;
  source: 'gbrain';
}

export function medicationPageId(medId: string): string {
  return `carecircle::medication::${medId.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
}

function normalizeMedication(raw: Partial<CareManualMedication>): CareManualMedication {
  return {
    id: String(raw.id ?? `med-${Date.now()}`),
    name: String(raw.name ?? '').trim(),
    dosage: String(raw.dosage ?? '').trim(),
    schedule: String(raw.schedule ?? '').trim(),
    personId: String(raw.personId ?? 'linda'),
    notes: String(raw.notes ?? '').trim(),
    addedAt: String(raw.addedAt ?? new Date().toISOString()),
  };
}

export function syncMedicationsToGBrain(
  store: CareCircleGBrainStore,
  medications: CareManualMedication[]
): { synced: number } {
  const normalized = medications.map(normalizeMedication).filter((m) => m.name.length > 0);

  store.clearKind(MEDICATION_KIND);

  for (const med of normalized) {
    store.upsertPage({
      id: medicationPageId(med.id),
      kind: MEDICATION_KIND,
      title: med.name,
      content: {
        ...med,
        source: 'manual_entry',
      },
    });
  }

  store.upsertPage({
    id: MEDICATION_REGISTRY_ID,
    kind: MEDICATION_KIND,
    title: 'Manual medication registry',
    content: {
      medications: normalized,
      updated_at: new Date().toISOString(),
      source: 'manual_registry',
    },
  });

  return { synced: normalized.length };
}

export function loadMedicationsFromGBrain(store: CareCircleGBrainStore): CareManualMedication[] {
  const registry = store.getPage(MEDICATION_REGISTRY_ID);
  if (registry?.content?.medications && Array.isArray(registry.content.medications)) {
    return (registry.content.medications as Partial<CareManualMedication>[]).map(normalizeMedication);
  }

  return store
    .listPages(MEDICATION_KIND)
    .filter((p) => p.id !== MEDICATION_REGISTRY_ID)
    .map((p) => normalizeMedication(p.content as Partial<CareManualMedication>));
}

function pageHaystack(page: CareCircleGBrainPage): string {
  const c = page.content;
  return `${page.kind} ${page.title} ${c.source ?? ''} ${c.text ?? ''} ${c.summary ?? ''} ${c.description ?? ''} ${c.name ?? ''} ${c.dosage ?? ''} ${c.notes ?? ''} ${JSON.stringify(c.metadata ?? {})}`.toLowerCase();
}

function isMedicationRelatedPage(page: CareCircleGBrainPage, extraTerms: string[]): boolean {
  if (page.kind === MEDICATION_KIND && page.id !== MEDICATION_REGISTRY_ID) return true;

  const haystack = pageHaystack(page);
  const path = String(page.content.path ?? '').toLowerCase();
  const metaSource = String((page.content.metadata as Record<string, unknown>)?.source ?? '').toLowerCase();

  if (path.includes('pharmacy') || path.includes('med')) return true;
  if (metaSource === 'medication') return true;

  const terms = [...MEDICATION_KEYWORDS, ...extraTerms];
  return terms.some((term) => term.length > 2 && haystack.includes(term.toLowerCase()));
}

function scorePage(page: CareCircleGBrainPage, terms: string[]): { score: number; matched: string[] } {
  const haystack = pageHaystack(page);
  const matched: string[] = [];
  let score = 0;

  for (const term of terms) {
    const t = term.toLowerCase();
    if (t.length < 2) continue;
    if (haystack.includes(t)) {
      score += t.length > 5 ? 2 : 1;
      matched.push(term);
    }
  }

  return { score, matched };
}

export function searchMedicationContextInGBrain(
  store: CareCircleGBrainStore,
  manualMedications: CareManualMedication[] = loadMedicationsFromGBrain(store)
): MedicationGBrainSnapshot {
  const manualNames = manualMedications.flatMap((m) => {
    const full = m.name.toLowerCase().trim();
    const tokens = full.split(/\W+/).filter((w) => w.length > 2);
    return full.length > 2 ? [full, ...tokens] : tokens;
  });
  const searchTerms = [...new Set([...MEDICATION_KEYWORDS, ...manualNames])];

  const candidateKinds = [SOURCE_KIND, CALENDAR_EVENT_KIND, MEDICATION_KIND];
  const seen = new Set<string>();

  const hits: MedicationGBrainHit[] = [];

  for (const kind of candidateKinds) {
    for (const page of store.listPages(kind)) {
      if (seen.has(page.id)) continue;
      if (page.id === MEDICATION_REGISTRY_ID) continue;
      if (!isMedicationRelatedPage(page, manualNames)) continue;

      const { score, matched } = scorePage(page, searchTerms);
      if (score === 0 && page.kind !== MEDICATION_KIND) continue;

      seen.add(page.id);
      const c = page.content;
      hits.push({
        pageId: page.id,
        title: page.title,
        source: String(c.source ?? page.kind),
        text: String(c.text ?? c.description ?? c.notes ?? page.title),
        score: score + (page.kind === MEDICATION_KIND ? 3 : 0),
        kind: page.kind,
        matchedTerms: matched,
      });
    }
  }

  const manualHits = hits.filter((h) => h.kind === MEDICATION_KIND);
  const corpusHits = hits.filter((h) => h.kind !== MEDICATION_KIND);
  const rankedHits = [...manualHits.sort((a, b) => b.score - a.score), ...corpusHits.sort((a, b) => b.score - a.score)];

  const summary =
    hits.length > 0
      ? `Found ${hits.length} GBrain page${hits.length === 1 ? '' : 's'} mentioning medication${manualMedications.length ? ` (including ${manualMedications.length} manual entr${manualMedications.length === 1 ? 'y' : 'ies'})` : ''}. CareCircle does not diagnose or claim causation.`
      : manualMedications.length > 0
        ? `${manualMedications.length} manual medication${manualMedications.length === 1 ? '' : 's'} saved to GBrain. No other medication mentions found in indexed family context yet.`
        : 'Add medications manually, then scan GBrain for pharmacy notes, alerts, and family context.';

  return {
    manual: manualMedications,
    gbrainMatches: rankedHits.slice(0, 12),
    summary,
    scannedAt: new Date().toISOString(),
    source: 'gbrain',
  };
}
