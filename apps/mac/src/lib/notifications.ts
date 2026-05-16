/**
 * macOS system notifications (#93).
 *
 * Uses the Tauri notification plugin when available. Falls back to the
 * web Notification API for browser-only previews. Enforces:
 *   - 4-hour cooldown per detector type
 *   - silent when the app window is focused
 *   - severity gate (only `medium` / `high`)
 *
 * Click handler bringing the window to front is owned by the Tauri side;
 * we just emit the OS-level notification here.
 */
import type { OrchestratorResult } from '@dyad/shared';
import type { DetectorType } from '@dyad/engine';

const COOLDOWN_MS = 4 * 60 * 60 * 1000;
const STORAGE_KEY = 'dyad_notif_last_sent';
const NOTIFICATIONS_KEY = 'dyad_notifications_enabled';

interface CooldownState { [detector: string]: number }

function readCooldowns(): CooldownState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as CooldownState;
  } catch { return {}; }
}
function writeCooldowns(state: CooldownState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function enabledByUser(): boolean {
  return localStorage.getItem(NOTIFICATIONS_KEY) !== 'false';
}

async function sendOsNotification(title: string, body: string): Promise<void> {
  // Prefer Tauri plugin when present
  try {
    const mod = await import('@tauri-apps/plugin-notification' as string).catch(() => null);
    if (mod && typeof (mod as { sendNotification?: (a: { title: string; body: string }) => void }).sendNotification === 'function') {
      (mod as { sendNotification: (a: { title: string; body: string }) => void }).sendNotification({ title, body });
      return;
    }
  } catch { /* fall through */ }
  // Web fallback (dev preview)
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') new Notification(title, { body });
    else if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      if (p === 'granted') new Notification(title, { body });
    }
  }
}

function severityFor(result: OrchestratorResult, det: DetectorType): 'low' | 'medium' | 'high' | null {
  switch (det) {
    case 'bid_asymmetry':         return result.bid_asymmetry?.severity ?? null;
    case 'predictive_divergence': return result.predictive_divergence?.detected ? 'medium' : null;
    case 'phantom_third_party':   return result.phantom_third_party?.detected ? 'medium' : null;
    case 'primary_secondary':
      return result.primary_secondary && result.primary_secondary.confidence >= 0.7 ? 'medium' : null;
  }
}

function readableTitle(det: DetectorType): string {
  return ({
    bid_asymmetry: 'Bid asymmetry detected',
    predictive_divergence: 'Predictive divergence detected',
    phantom_third_party: 'Phantom third-party presence',
    primary_secondary: 'Emotional layering detected',
  } satisfies Record<DetectorType, string>)[det];
}

/**
 * Notify on detected patterns. Caller passes the just-arrived
 * OrchestratorResult plus whether the app window is focused.
 */
export async function maybeNotify(
  result: OrchestratorResult,
  detectors: DetectorType[],
  appWindowFocused: boolean,
): Promise<void> {
  if (!enabledByUser()) return;
  if (appWindowFocused) return;
  const now = Date.now();
  const cooldowns = readCooldowns();
  for (const det of detectors) {
    const sev = severityFor(result, det);
    if (sev !== 'medium' && sev !== 'high') continue;
    if (cooldowns[det] && now - cooldowns[det] < COOLDOWN_MS) continue;
    await sendOsNotification(
      'DYAD — ' + readableTitle(det),
      `Severity: ${sev} · Click to see your insight`,
    );
    cooldowns[det] = now;
  }
  writeCooldowns(cooldowns);
}
