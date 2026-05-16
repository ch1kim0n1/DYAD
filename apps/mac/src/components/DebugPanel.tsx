import { useEffect, useState } from 'react';
import { useDyadStore } from '../store.js';

interface DebugInfo {
  ok?: boolean;
  pipeline_ready?: boolean;
  brief_ready?: boolean;
  reframe_ready?: boolean;
  dyad_id?: string;
  gstack_session?: string | null;
  hog_configured?: boolean;
  jo_configured?: boolean;
  telemetry?: {
    totalCalls: number;
    totalFailures: number;
    avgMs: number;
    estCostUsd: number;
  };
}

/**
 * In-app debug panel (#86). Toggled with Cmd/Ctrl+Shift+D. Polls the
 * sidecar's /debug endpoint every 2s while open and shows engine
 * status, telemetry rollup, and the last error from the Zustand store.
 *
 * Hidden in production builds (gated on import.meta.env.MODE).
 */
export function DebugPanel({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const error = useDyadStore((s) => s.error);
  const lastAnalyzedAt = useDyadStore((s) => s.lastAnalyzedAt);
  const featureCount = useDyadStore((s) => s.features.length);

  useEffect(() => {
    let cancelled = false;
    const url = ((import.meta as unknown as { env?: { VITE_DYAD_SIDECAR_URL?: string } }).env?.VITE_DYAD_SIDECAR_URL)
      ?? 'http://localhost:7432';
    const tick = async () => {
      try {
        const r = await fetch(`${url}/debug`);
        if (!cancelled && r.ok) setInfo(await r.json());
      } catch {
        if (!cancelled) setInfo(null);
      }
    };
    tick();
    const i = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  return (
    <aside className="debug-panel" aria-label="Debug panel">
      <button className="close-btn" onClick={onClose} aria-label="Close debug panel">×</button>
      <h3>Debug</h3>
      <dl>
        <dt>Engine</dt>
        <dd>{info?.ok ? 'running' : 'unreachable'}</dd>
        <dt>Pipeline</dt>
        <dd>{info?.pipeline_ready ? 'ready' : 'no key'}</dd>
        <dt>Brief / reframe</dt>
        <dd>{info?.brief_ready ? '✓ / ' : '✗ / '}{info?.reframe_ready ? '✓' : '✗'}</dd>
        <dt>GStack</dt>
        <dd>{info?.gstack_session ?? '—'}</dd>
        <dt>Hog / Jo</dt>
        <dd>{info?.hog_configured ? '✓ / ' : '✗ / '}{info?.jo_configured ? '✓' : '✗'}</dd>
        <dt>Conv id</dt>
        <dd>{info?.dyad_id?.slice(0, 12) ?? '—'}</dd>
      </dl>
      <h3 style={{ marginTop: 12 }}>Telemetry</h3>
      <dl>
        <dt>Calls</dt>
        <dd>{info?.telemetry?.totalCalls ?? 0}</dd>
        <dt>Failures</dt>
        <dd>{info?.telemetry?.totalFailures ?? 0}</dd>
        <dt>Avg latency</dt>
        <dd>{Math.round(info?.telemetry?.avgMs ?? 0)}ms</dd>
        <dt>Est cost</dt>
        <dd>${(info?.telemetry?.estCostUsd ?? 0).toFixed(4)}</dd>
      </dl>
      <h3 style={{ marginTop: 12 }}>Last state</h3>
      <dl>
        <dt>Last analysis</dt>
        <dd>{lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString() : '—'}</dd>
        <dt>Features</dt>
        <dd>{featureCount}</dd>
        <dt>Last error</dt>
        <dd style={{ color: error ? 'var(--red)' : undefined }}>{error ?? '—'}</dd>
      </dl>
    </aside>
  );
}
