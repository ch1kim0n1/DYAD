import { careCircleMessyCorpus } from '../views/carecircleMessyCorpus.js';
import { RECENCY_RANK, WHEN_LABEL } from '../views/carecircleRecentEvents.js';
import { CareCircleGBrainStore, careCircleSourcePageId } from './carecircle-gbrain-store.js';

const SOURCE_KIND = 'carecircle_source_document';

export function seedCareCircleGBrain(store: CareCircleGBrainStore): { seeded: number } {
  store.clear();

  for (const doc of careCircleMessyCorpus) {
    const recencyRank = RECENCY_RANK[doc.path];
    store.upsertPage({
      id: careCircleSourcePageId(doc.path),
      kind: SOURCE_KIND,
      title: doc.title,
      content: {
        path: doc.path,
        source: doc.source,
        text: doc.text,
        metadata: doc.metadata,
        recency_rank: recencyRank ?? null,
        when_label: WHEN_LABEL[doc.path] ?? null,
      },
    });
  }

  return { seeded: careCircleMessyCorpus.length };
}

export async function ensureCareCircleGBrainSeeded(
  store: CareCircleGBrainStore
): Promise<{ seeded: number; alreadyHadData: boolean }> {
  const existing = store.countPages(SOURCE_KIND);
  if (existing >= careCircleMessyCorpus.length) {
    return { seeded: existing, alreadyHadData: true };
  }
  const result = seedCareCircleGBrain(store);
  return { seeded: result.seeded, alreadyHadData: false };
}
