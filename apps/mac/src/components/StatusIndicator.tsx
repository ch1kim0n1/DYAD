import { useEffect, useState } from 'react';
import { pingSidecar, type SidecarStatus } from '../lib/gbrain-bridge.js';
import { useDyadStore } from '../store.js';

export type Connection = 'connected' | 'loading' | 'disconnected';

interface Props {
  pollIntervalMs?: number;
}

/**
 * Polls the sidecar `/status` endpoint every `pollIntervalMs` (default 5s).
 * Renders a coloured dot + label reflecting engine health.
 */
export function StatusIndicator({ pollIntervalMs = 5000 }: Props) {
  const [connection, setConnection] = useState<Connection>('loading');
  const [details, setDetails] = useState<SidecarStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const setEngineOnline = useDyadStore.getState().setEngineOnline;
    const tick = async () => {
      const r = await pingSidecar();
      if (cancelled) return;
      if (r?.ok) {
        setConnection('connected');
        setDetails(r);
        setEngineOnline(true);
      } else {
        setConnection('disconnected');
        setEngineOnline(false);
      }
    };
    tick();
    timer = setInterval(tick, pollIntervalMs);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [pollIntervalMs]);

  const label =
    connection === 'connected' ? 'Live'
    : connection === 'loading' ? 'Engine loading…'
    : 'Disconnected';

  return (
    <span className={`conn-indicator conn-${connection}`} title={details?.dyad_id ? `dyad: ${details.dyad_id}` : undefined}>
      <span className="conn-dot" />
      {label}
    </span>
  );
}
