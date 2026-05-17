import type { CareManualMedication, MedicationGBrainSnapshot } from './medication-gbrain.js';

export async function fetchMedicationsFromGBrain(): Promise<MedicationGBrainSnapshot> {
  const response = await fetch('/api/carecircle/medications', { method: 'GET' });
  const data = (await response.json()) as MedicationGBrainSnapshot & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Failed to load medications (${response.status})`);
  return data;
}

export async function saveMedicationsToGBrain(
  medications: CareManualMedication[]
): Promise<MedicationGBrainSnapshot> {
  const response = await fetch('/api/carecircle/medications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ medications }),
  });
  const data = (await response.json()) as MedicationGBrainSnapshot & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Failed to save medications (${response.status})`);
  return data;
}

export async function scanMedicationGBrain(
  medications?: CareManualMedication[]
): Promise<MedicationGBrainSnapshot> {
  const response = await fetch('/api/carecircle/medications/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ medications: medications ?? [] }),
  });
  const data = (await response.json()) as MedicationGBrainSnapshot & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Medication scan failed (${response.status})`);
  return data;
}
