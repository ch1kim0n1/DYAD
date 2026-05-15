import { useDyadStore } from '../store.js';

/**
 * "Analysis paused (offline)" badge (#67). Renders only when the engine
 * sidecar is unreachable. Views remain functional on L1 data + last
 * fetched OrchestratorResult; LLM-backed updates are suspended.
 */
export function OfflineBadge({ reason }: { reason?: string }) {
  const online = useDyadStore((s) => s.engineOnline);
  if (online) return null;
  return (
    <span className="offline-badge" role="status">
      ● {reason ?? 'Analysis paused (offline)'}
    </span>
  );
}
