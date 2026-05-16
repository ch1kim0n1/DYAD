import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareManualMedication, MedicationGBrainSnapshot } from '../lib/medication-gbrain.js';
import {
  fetchMedicationsFromGBrain,
  saveMedicationsToGBrain,
  scanMedicationGBrain,
} from '../lib/carecircle-medication-client.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';
import { personName } from './carecircleDemo.js';

interface CareMedicationPanelProps {
  runtimeState: CareCircleRuntimeState;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
  variants: Variants;
}

export function CareMedicationPanel({
  runtimeState,
  onRuntimeStateChange,
  variants,
}: CareMedicationPanelProps) {
  const [snapshot, setSnapshot] = useState<MedicationGBrainSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState('');
  const [notes, setNotes] = useState('');

  const medications = snapshot?.manual ?? runtimeState.medications ?? [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMedicationsFromGBrain();
      setSnapshot(data);
      onRuntimeStateChange((s) => ({ ...s, medications: data.manual }));
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [onRuntimeStateChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const entry: CareManualMedication = {
      id: `med-${Date.now()}`,
      name: trimmed,
      dosage: dosage.trim(),
      schedule: schedule.trim(),
      personId: 'linda',
      notes: notes.trim(),
      addedAt: new Date().toISOString(),
    };

    const next = [...medications, entry];
    setSaving(true);
    try {
      const data = await saveMedicationsToGBrain(next);
      setSnapshot(data);
      onRuntimeStateChange((s) => ({
        ...s,
        medications: data.manual,
        medicationSyncError: undefined,
      }));
      setName('');
      setDosage('');
      setSchedule('');
      setNotes('');
    } catch (err) {
      onRuntimeStateChange((s) => ({
        ...s,
        medicationSyncError: (err as Error).message,
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const next = medications.filter((m) => m.id !== id);
    setSaving(true);
    try {
      const data = await saveMedicationsToGBrain(next);
      setSnapshot(data);
      onRuntimeStateChange((s) => ({ ...s, medications: data.manual, medicationSyncError: undefined }));
    } catch (err) {
      onRuntimeStateChange((s) => ({
        ...s,
        medicationSyncError: (err as Error).message,
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const data = await scanMedicationGBrain(medications);
      setSnapshot(data);
      onRuntimeStateChange((s) => ({ ...s, medicationSyncError: undefined }));
    } catch (err) {
      onRuntimeStateChange((s) => ({
        ...s,
        medicationSyncError: (err as Error).message,
      }));
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.section
      className="care-panel medication-gbrain-panel"
      variants={variants}
      aria-label="Medication list and GBrain context"
    >
      <div className="medication-gbrain-header">
        <div>
          <p className="care-kicker">GBrain · medications</p>
          <h2>Medicine list</h2>
        </div>
        <span
          className={`provider-context-badge ${scanning ? 'checking' : medications.length ? 'ready' : 'idle'}`}
        >
          {scanning ? 'Scanning' : medications.length ? `${medications.length} in GBrain` : 'Add meds'}
        </span>
      </div>
      <p className="medication-gbrain-lead">
        Add what {personName('linda')} is taking. Each entry is saved to GBrain, then CareCircle scans all indexed
        family context for pharmacy alerts, medication notes, and related mentions.
      </p>

      <form
        className="medication-add-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <label className="medication-field">
          <span>Medication name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lisinopril"
            disabled={saving}
          />
        </label>
        <label className="medication-field">
          <span>Dosage</span>
          <input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g. 10mg"
            disabled={saving}
          />
        </label>
        <label className="medication-field">
          <span>Schedule</span>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="e.g. morning with breakfast"
            disabled={saving}
          />
        </label>
        <label className="medication-field wide">
          <span>Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. started 5 days ago"
            disabled={saving}
          />
        </label>
        <button className="care-card-button gbrain-retrieval-button" type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Add to GBrain'}
        </button>
      </form>

      <div className="medication-actions-row">
        <button
          className="care-card-button secondary"
          type="button"
          onClick={() => void handleScan()}
          disabled={scanning || loading}
        >
          {scanning ? 'Traversing GBrain…' : 'Scan GBrain for medication context'}
        </button>
      </div>

      {runtimeState.medicationSyncError && (
        <p className="medication-gbrain-error" role="alert">
          {runtimeState.medicationSyncError}
        </p>
      )}

      {loading ? (
        <p className="medication-gbrain-meta">Loading medication list from GBrain…</p>
      ) : (
        <>
          {snapshot?.summary && <p className="medication-gbrain-summary">{snapshot.summary}</p>}

          {medications.length > 0 && (
            <ul className="medication-manual-list">
              {medications.map((med) => (
                <li key={med.id}>
                  <div className="medication-manual-top">
                    <strong>{med.name}</strong>
                    <button type="button" className="medication-remove" onClick={() => void handleRemove(med.id)}>
                      Remove
                    </button>
                  </div>
                  <p>
                    {[med.dosage, med.schedule].filter(Boolean).join(' · ') || 'No dosage or schedule recorded'}
                  </p>
                  {med.notes ? <p className="medication-note">{med.notes}</p> : null}
                  <span className="dashboard-recent-event-source">manual entry · GBrain</span>
                </li>
              ))}
            </ul>
          )}

          {snapshot && snapshot.gbrainMatches.length > 0 && (
            <>
              <h3 className="medication-matches-heading">From GBrain context</h3>
              <ul className="medication-gbrain-matches">
                {snapshot.gbrainMatches.map((hit) => (
                  <li key={hit.pageId}>
                    <div className="medication-manual-top">
                      <strong>{hit.title}</strong>
                      <span className="medication-score">{hit.source}</span>
                    </div>
                    <p>{hit.text}</p>
                    {hit.matchedTerms.length > 0 && (
                      <span className="medication-match-terms">matched: {hit.matchedTerms.join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </motion.section>
  );
}
