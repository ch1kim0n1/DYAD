/**
 * NOUS View - displays mentalization graph and hypothesis fork
 */
import { useState } from 'react';
import { OfflineBadge } from '../components/OfflineBadge.js';
import { HypothesisForkPanel } from '../components/HypothesisForkPanel.js';
import { MentalizationGraphPanel } from '../components/MentalizationGraphPanel.js';
import type { CognitiveTwinCycleOutput } from '@dyad/shared';

export function NousView() {
  const [cycleOutput, setCycleOutput] = useState<CognitiveTwinCycleOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runNousCycle = async (budget: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:7432/nous/cycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budget }),
      });
      if (!response.ok) throw new Error('Failed to run NOUS cycle');
      const result = await response.json() as CognitiveTwinCycleOutput;
      setCycleOutput(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nous-view">
      <div className="nous-header">
        <h2>NOUS Analysis</h2>
        <OfflineBadge />
      </div>

      <div className="nous-controls">
        <button 
          onClick={() => runNousCycle(10)}
          disabled={loading}
          className="nous-button primary"
        >
          {loading ? 'Running Analysis...' : 'Run NOUS Cycle (10 credits)'}
        </button>
        <button 
          onClick={() => runNousCycle(5)}
          disabled={loading}
          className="nous-button secondary"
        >
          {loading ? 'Running Analysis...' : 'Quick Run (5 credits)'}
        </button>
      </div>

      {error && <div className="nous-error">{error}</div>}

      {cycleOutput && (
        <div className="nous-results">
          <div className="nous-summary">
            <h3>Enriched Summary</h3>
            <p>{cycleOutput.enriched_summary}</p>
          </div>

          <div className="nous-panels">
            {cycleOutput.hypothesis_fork && (
              <HypothesisForkPanel fork={cycleOutput.hypothesis_fork} />
            )}
            <MentalizationGraphPanel graphSnapshotId={cycleOutput.graph_snapshot_id} />
          </div>

          <div className="nous-details">
            <h3>Details</h3>
            <div className="nous-stats">
              <div>Hog Operations: {cycleOutput.hog_results.length}</div>
              <div>Arbiter Decisions: {cycleOutput.decisions.length}</div>
              <div>Total Cost: {cycleOutput.mvi_plan.total_cost} credits</div>
              <div>Information Gain: {cycleOutput.mvi_plan.total_information_gain.toFixed(3)} bits</div>
            </div>
          </div>
        </div>
      )}

      {!cycleOutput && !loading && (
        <div className="nous-empty">
          <p>Run a NOUS cycle to analyze the mentalization graph and generate hypotheses.</p>
        </div>
      )}
    </div>
  );
}
