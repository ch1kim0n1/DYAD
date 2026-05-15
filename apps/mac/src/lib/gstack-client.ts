/**
 * GStackClient — thin HTTP client for the hackathon GStack service.
 *
 * GStack provides session management and a key/value state store that's
 * shared across pipelines. DYAD uses it for:
 *   - session lifecycle (create/resume per conversation)
 *   - SelfModel / PartnerModel / RelationshipModel snapshots
 *
 * Graceful degradation: when GSTACK_URL or GSTACK_API_KEY is not set
 * (or the service is unreachable), every method becomes a no-op that
 * returns `null` / `false`. Callers fall back to `~/.dyad/*.json`.
 */
import type { RelationshipModel, SelfModel, PartnerModel } from '@dyad/shared';
import { APIError } from './errors.js';

export interface GStackSession {
  session_id: string;
  pipeline: string;
  conversation_id: string;
  created_at: string;
}

export interface GStackClientOptions {
  baseUrl?: string;
  apiKey?: string;
  /** When true (default), failures throw instead of returning null. Useful in tests. */
  strict?: boolean;
}

const env = (key: string): string | undefined => {
  // Vite exposes import.meta.env in the browser, process.env in Node/Bun.
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
  return meta?.[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined);
};

export class GStackClient {
  private baseUrl: string | null;
  private apiKey: string | null;
  private strict: boolean;
  public sessionId: string | null = null;

  constructor(options: GStackClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? env('GSTACK_URL') ?? null;
    this.apiKey = options.apiKey ?? env('GSTACK_API_KEY') ?? null;
    this.strict = options.strict ?? false;
  }

  /** True when both URL and API key are present. */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Create or resume a session for the given conversation.
   * Returns null when GStack isn't configured/unreachable.
   */
  async createOrResume(pipeline: string, conversationId: string): Promise<GStackSession | null> {
    if (!this.isConfigured()) return null;
    const resp = await this.request<GStackSession>('POST', '/sessions/create-or-resume', {
      pipeline,
      conversation_id: conversationId,
    });
    if (resp?.session_id) this.sessionId = resp.session_id;
    return resp;
  }

  async setState(key: string, value: unknown): Promise<boolean> {
    if (!this.sessionId || !this.isConfigured()) return false;
    const resp = await this.request<{ ok: boolean }>(
      'PUT',
      `/sessions/${encodeURIComponent(this.sessionId)}/state/${encodeURIComponent(key)}`,
      { value }
    );
    return resp?.ok === true;
  }

  async getState<T>(key: string): Promise<T | null> {
    if (!this.sessionId || !this.isConfigured()) return null;
    const resp = await this.request<{ value: T }>(
      'GET',
      `/sessions/${encodeURIComponent(this.sessionId)}/state/${encodeURIComponent(key)}`
    );
    return resp?.value ?? null;
  }

  /** Convenience: persist all three model snapshots in one call. */
  async persistModels(models: {
    self?: SelfModel;
    partner?: PartnerModel;
    relationship?: RelationshipModel;
  }): Promise<void> {
    if (models.self) await this.setState('self-model', models.self);
    if (models.partner) await this.setState('partner-model', models.partner);
    if (models.relationship) await this.setState('relationship-model', models.relationship);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    if (!this.baseUrl) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        if (this.strict) throw new APIError(res.status, path);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      if (this.strict) throw err;
      return null;
    }
  }
}
