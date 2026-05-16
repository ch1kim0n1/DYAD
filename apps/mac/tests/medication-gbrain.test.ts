import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CareCircleGBrainStore } from '../src/lib/carecircle-gbrain-store.js';
import {
  loadMedicationsFromGBrain,
  searchMedicationContextInGBrain,
  syncMedicationsToGBrain,
} from '../src/lib/medication-gbrain.js';
import { seedCareCircleGBrain } from '../src/lib/seed-carecircle-gbrain.js';

const tempDirs: string[] = [];

function tempStore(): CareCircleGBrainStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carecircle-med-gbrain-'));
  tempDirs.push(dir);
  return new CareCircleGBrainStore(dir);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('medication GBrain', () => {
  test('syncs manual medications and finds corpus mentions', () => {
    const store = tempStore();
    seedCareCircleGBrain(store);

    syncMedicationsToGBrain(store, [
      {
        id: 'med-1',
        name: 'Lisinopril',
        dosage: '10mg',
        schedule: 'morning',
        personId: 'linda',
        notes: '',
        addedAt: new Date().toISOString(),
      },
    ]);

    const loaded = loadMedicationsFromGBrain(store);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('Lisinopril');

    const snapshot = searchMedicationContextInGBrain(store, loaded);
    expect(snapshot.source).toBe('gbrain');
    expect(snapshot.manual).toHaveLength(1);
    expect(snapshot.gbrainMatches.length).toBeGreaterThan(0);
    expect(snapshot.summary.toLowerCase()).toContain('gbrain');
  });
});
