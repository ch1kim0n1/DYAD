/**
 * gbrain-bridge — typed client that calls the local engine sidecar
 * launched by Tauri on `localhost:7432`.
 *
 * Falls back to the engine's reachable URL via `VITE_DYAD_SIDECAR_URL`
 * (override for dev). Each function returns null on transport error and
 * surfaces the original error message via console.error.
 *
 * Offline/degraded mode: briefs and reframes are cached in localStorage
 * for fallback when the sidecar is unavailable.
 */
import type {
  FeatureVector,
  NormalizedMessage,
  OrchestratorResult,
} from '@dyad/shared';
import type { DetectorType } from '@dyad/engine';

const BASE_URL =
  (import.meta as unknown as { env?: { VITE_DYAD_SIDECAR_URL?: string } })
    .env?.VITE_DYAD_SIDECAR_URL ?? 'http://localhost:7432';

// LocalStorage cache keys
const CACHE_PREFIX = 'dyad_cache_';
const BRIEF_CACHE_KEY = (detectorType: DetectorType, conversationId: string) =>
  `${CACHE_PREFIX}brief_${detectorType}_${conversationId}`;
const REFRAME_CACHE_KEY = (detectorType: DetectorType, conversationId: string) =>
  `${CACHE_PREFIX}reframe_${detectorType}_${conversationId}`;

function getCached<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { value, timestamp } = JSON.parse(item);
    // Cache expires after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function setCached<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[gbrain-bridge] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[gbrain-bridge] ${path} failed:`, err);
    return null;
  }
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface SidecarStatus {
  ok: boolean;
  pipeline_ready: boolean;
  brief_ready: boolean;
  reframe_ready: boolean;
  dyad_id: string;
}

/** Health probe — frontend polls this before first analyze call. */
export async function pingSidecar(): Promise<SidecarStatus | null> {
  return get<SidecarStatus>('/status');
}

/** Block until /status returns ok (with retry/backoff). */
export async function waitForSidecar(timeoutMs: number = 20_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await pingSidecar();
    if (r?.ok) return true;
    await new Promise(res => setTimeout(res, 500));
  }
  return false;
}

export async function loadMessages(
  chatId?: string,
  since?: number
): Promise<{ messages: NormalizedMessage[]; error?: string }> {
  const resp = await post<{ messages: NormalizedMessage[]; error?: string }>(
    '/load-messages',
    { chatId, since }
  );
  return resp ?? { messages: [] };
}

export interface ChatSummary { chat_id: string; message_count: number }
export async function getChatSummary(): Promise<ChatSummary[]> {
  const r = await get<{ conversations: ChatSummary[] }>('/chat-summary');
  return r?.conversations ?? [];
}

export async function checkFullDiskAccess(): Promise<{ granted: boolean; error?: string }> {
  const r = await get<{ granted: boolean; error?: string }>('/permissions/full-disk-access');
  return r ?? { granted: false, error: 'sidecar unreachable' };
}

export async function runAnalysis(
  messages: NormalizedMessage[],
  features?: FeatureVector[]
): Promise<OrchestratorResult | null> {
  return post<OrchestratorResult>('/analyze', { messages, features });
}

export async function requestBrief(
  detectorType: DetectorType,
  result: OrchestratorResult,
  messages: NormalizedMessage[],
  conversationId?: string
): Promise<string | null> {
  // Check cache first for offline/degraded mode
  if (conversationId) {
    const cached = getCached<string>(BRIEF_CACHE_KEY(detectorType, conversationId));
    if (cached) return cached;
  }

  const resp = await post<{ brief: string | null }>('/brief', {
    detectorType,
    result,
    messages,
  });
  const brief = resp?.brief ?? null;
  
  // Cache successful briefs
  if (brief && conversationId) {
    setCached(BRIEF_CACHE_KEY(detectorType, conversationId), brief);
  }
  
  return brief;
}

export async function requestReframe(
  detectorType: DetectorType,
  result: OrchestratorResult,
  brief: string,
  messages: NormalizedMessage[],
  conversationId?: string
): Promise<string | null> {
  // Check cache first for offline/degraded mode
  if (conversationId) {
    const cached = getCached<string>(REFRAME_CACHE_KEY(detectorType, conversationId));
    if (cached) return cached;
  }

  const resp = await post<{ reframe: string | null }>('/reframe', {
    detectorType,
    result,
    brief,
    messages,
  });
  const reframe = resp?.reframe ?? null;
  
  // Cache successful reframes
  if (reframe && conversationId) {
    setCached(REFRAME_CACHE_KEY(detectorType, conversationId), reframe);
  }
  
  return reframe;
}
