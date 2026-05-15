/**
 * gbrain-bridge — typed client that calls the local engine sidecar
 * launched by Tauri on `localhost:7432`.
 *
 * Falls back to the engine's reachable URL via `VITE_DYAD_SIDECAR_URL`
 * (override for dev). Each function returns null on transport error and
 * surfaces the original error message via console.error.
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

export async function runAnalysis(
  messages: NormalizedMessage[],
  features?: FeatureVector[]
): Promise<OrchestratorResult | null> {
  return post<OrchestratorResult>('/analyze', { messages, features });
}

export async function requestBrief(
  detectorType: DetectorType,
  result: OrchestratorResult,
  messages: NormalizedMessage[]
): Promise<string | null> {
  const resp = await post<{ brief: string | null }>('/brief', {
    detectorType,
    result,
    messages,
  });
  return resp?.brief ?? null;
}

export async function requestReframe(
  detectorType: DetectorType,
  result: OrchestratorResult,
  brief: string,
  messages: NormalizedMessage[]
): Promise<string | null> {
  const resp = await post<{ reframe: string | null }>('/reframe', {
    detectorType,
    result,
    brief,
    messages,
  });
  return resp?.reframe ?? null;
}
