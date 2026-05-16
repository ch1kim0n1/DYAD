import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildRecentEventsFromGBrain, searchCareCircleGBrain } from '../src/lib/carecircle-gbrain-queries.js';
import { CareCircleGBrainStore } from '../src/lib/carecircle-gbrain-store.js';
import { seedCareCircleGBrain } from '../src/lib/seed-carecircle-gbrain.js';
import { careCircleMessyCorpus } from '../src/views/carecircleMessyCorpus.js';

const tempDirs: string[] = [];

function tempStore(): CareCircleGBrainStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carecircle-gbrain-'));
  tempDirs.push(dir);
  return new CareCircleGBrainStore(dir);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('carecircle GBrain store', () => {
  test('seeds 24 documents into GBrain pages', () => {
    const store = tempStore();
    const { seeded } = seedCareCircleGBrain(store);
    expect(seeded).toBe(24);
    expect(store.countPages('carecircle_source_document')).toBe(24);
  });

  test('recent events are read only from GBrain', () => {
    const store = tempStore();
    seedCareCircleGBrain(store);
    const payload = buildRecentEventsFromGBrain(store);
    expect(payload.documentCount).toBe(24);
    expect(payload.events[0]?.path).toBe('notes/maya-friday-tone.txt');
    expect(payload.summary.toLowerCase()).toContain('from gbrain');
  });

  test('context search queries GBrain pages only', () => {
    const store = tempStore();
    seedCareCircleGBrain(store);
    const result = searchCareCircleGBrain(store, 'dizziness pharmacy appointment');
    expect(result.source).toBe('gbrain');
    expect(result.indexedDocuments).toBe(careCircleMessyCorpus.length);
    expect(result.results.length).toBeGreaterThan(0);
  });
});
