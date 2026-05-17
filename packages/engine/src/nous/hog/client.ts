/**
 * NOUS Hog adapter — real `developer.thehog.ai` client.
 *
 * Replaces the local-stub `HogEnricher` for cognitive-twin use cases.
 * Supports the four capabilities NOUS exercises:
 *   - `peopleResearch` — cross-platform identity dossier (sync, 2-30s)
 *   - `peopleEnrich`   — verified emails/phones (200 sync or 202 async)
 *   - `deepResearch`   — schema-driven LLM research (always 202)
 *   - `getOperation`   — poll terminal status of an async op
 *
 * Errors are typed (`HogAuthError`, `HogRateLimitError`, `HogPaymentError`,
 * `HogValidationError`, `HogTransportError`) so callers can degrade
 * differently. Transport failures fall through to `HogTransportError`.
 *
 * `fetchImpl` injection lets tests run against a `MockFetch` without
 * touching the network.
 */
import type {
  DeepResearchInput,
  DeepResearchResult,
  HogCapability,
  HogOperationHandle,
  HogOperationResult,
  PeopleResearchInput,
  PeopleResearchResult,
} from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// Errors
// ════════════════════════════════════════════════════════════════════════════

export class HogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly requestId?: string,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'HogError';
  }
}
export class HogAuthError extends HogError {
  constructor(m: string, r?: string, p?: string) { super(m, 401, r, p); this.name = 'HogAuthError'; }
}
export class HogPaymentError extends HogError {
  constructor(m: string, r?: string, p?: string) { super(m, 402, r, p); this.name = 'HogPaymentError'; }
}
export class HogValidationError extends HogError {
  constructor(m: string, public readonly errors: { property: string; message: string }[], r?: string, p?: string) {
    super(m, 400, r, p); this.name = 'HogValidationError';
  }
}
export class HogRateLimitError extends HogError {
  constructor(m: string, r?: string, p?: string) { super(m, 429, r, p); this.name = 'HogRateLimitError'; }
}
export class HogTransportError extends HogError {
  constructor(m: string, public readonly cause?: unknown) { super(m, 0); this.name = 'HogTransportError'; }
}

// ════════════════════════════════════════════════════════════════════════════
// Inputs / outputs (capability-specific)
// ════════════════════════════════════════════════════════════════════════════

export interface PeopleEnrichIdentity {
  platform: 'linkedin' | 'x' | 'reddit' | 'github' | 'instagram' | 'tiktok';
  username: string;
}
export interface PeopleEnrichInput {
  identities?: PeopleEnrichIdentity[];
  people?: { id: string }[];
  asyncPreferred?: boolean;
  maxEmailProviderAttempts?: number;
  maxPhoneProviderAttempts?: number;
  projectId?: string;
}
export interface PeopleEnrichRecord {
  id: string;
  canonicalPersonId?: string;
  fullName?: string;
  title?: string;
  companyName?: string;
  location?: string;
  emailStatus?: 'available' | 'not_found' | 'error';
  phoneStatus?: 'available' | 'not_found' | 'error';
  emails?: { email: string; emailType: string; isVerified: boolean }[];
  phoneNumbers?: { phoneNumber: string; phoneType: string; isVerified: boolean }[];
  fromCache?: boolean;
}
export interface PeopleEnrichSyncResult {
  data: { people: PeopleEnrichRecord[] };
  meta: { requestId: string; cost?: { estimated: number; actual: number | null } };
}

// ════════════════════════════════════════════════════════════════════════════
// Client
// ════════════════════════════════════════════════════════════════════════════

export interface HogClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  projectId?: string;
  defaultTimeoutMs?: number;
}
export interface HogRequestOptions {
  idempotencyKey?: string;
  projectId?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = 'https://developer.thehog.ai';
const DEFAULT_TIMEOUT_MS = 30_000;

export class HogClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultProjectId?: string;
  private readonly defaultTimeoutMs: number;

  constructor(opts: HogClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env['THE_HOG_API_KEY'];
    this.baseUrl = (opts.baseUrl ?? process.env['THE_HOG_BASE_URL'] ?? DEFAULT_BASE).replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.defaultProjectId = opts.projectId ?? process.env['THE_HOG_PROJECT_ID'];
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // ── Public capabilities ──────────────────────────────────────────────────

  /** Synchronous (2-30s wall). Returns a dossier; never async. */
  async peopleResearch(input: PeopleResearchInput, opts: HogRequestOptions = {}): Promise<PeopleResearchResult> {
    const body = await this.post<{ data?: unknown }>('/api/people/researches', input, opts);
    // The shape varies; map defensively.
    const raw = (body as { data?: Record<string, unknown> }).data ?? body;
    return mapPeopleResearchResponse(raw);
  }

  /**
   * Sync or async depending on payload. When `asyncPreferred: true` or a 202
   * is returned, this resolves to a `HogOperationHandle`. Otherwise to a
   * `PeopleEnrichSyncResult`. Caller inspects `'operation_id' in result`.
   */
  async peopleEnrich(
    input: PeopleEnrichInput,
    opts: HogRequestOptions = {},
  ): Promise<PeopleEnrichSyncResult | HogOperationHandle> {
    const { status, body } = await this.postRaw('/api/people/enrich', input, opts);
    if (status === 202) {
      return parseOperationHandle('people_enrich', body);
    }
    return body as PeopleEnrichSyncResult;
  }

  /** Always async — returns a 202 with operation_id. Poll via `getOperation`. */
  async deepResearch(input: DeepResearchInput, opts: HogRequestOptions = {}): Promise<HogOperationHandle> {
    const body = await this.post<unknown>('/api/deep-research', input, opts);
    return parseOperationHandle('deep_research', body);
  }

  /** Polls operation status. Cheap; safe to call repeatedly under rate limits. */
  async getOperation<T = unknown>(operationId: string, opts: HogRequestOptions = {}): Promise<HogOperationResult<T>> {
    const body = await this.get<RawOperation>(`/api/operations/${encodeURIComponent(operationId)}`, opts);
    return mapOperation<T>(body);
  }

  // ── HTTP plumbing ────────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown, opts: HogRequestOptions): Promise<T> {
    const { body: parsed } = await this.postRaw(path, body, opts);
    return parsed as T;
  }

  private async postRaw(path: string, body: unknown, opts: HogRequestOptions): Promise<{ status: number; body: unknown }> {
    return this.request('POST', path, body, opts);
  }

  private async get<T>(path: string, opts: HogRequestOptions): Promise<T> {
    const { body } = await this.request('GET', path, null, opts);
    return body as T;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    opts: HogRequestOptions,
  ): Promise<{ status: number; body: unknown }> {
    if (!this.apiKey) {
      throw new HogAuthError('THE_HOG_API_KEY not configured');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    const projectId = opts.projectId ?? this.defaultProjectId;
    if (projectId) headers['X-Project-Id'] = projectId;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      const msg = (e as Error)?.name === 'AbortError'
        ? `Hog request timed out after ${timeoutMs}ms (${method} ${path})`
        : `Hog transport failure: ${(e as Error).message}`;
      throw new HogTransportError(msg, e);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      throw this.mapErrorResponse(res.status, parsed, path);
    }
    return { status: res.status, body: parsed };
  }

  private mapErrorResponse(status: number, body: unknown, path: string): HogError {
    const b = body as Partial<{
      error: string;
      message: string;
      requestId: string;
      errors: { property: string; message: string }[];
    }>;
    const msg = b?.message ?? b?.error ?? `Hog HTTP ${status}`;
    const reqId = b?.requestId;
    switch (status) {
      case 400: return new HogValidationError(msg, b?.errors ?? [], reqId, path);
      case 401: return new HogAuthError(msg, reqId, path);
      case 402: return new HogPaymentError(msg, reqId, path);
      case 429: return new HogRateLimitError(msg, reqId, path);
      default:  return new HogError(msg, status, reqId, path);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Response mapping helpers
// ════════════════════════════════════════════════════════════════════════════

interface RawOperation {
  id?: string;
  operationId?: string;
  status: string;
  progress?: number;
  result?: unknown;
  error?: { code?: string; message?: string };
  meta?: { cost?: { actual?: number } };
}

function mapOperation<T>(raw: RawOperation): HogOperationResult<T> {
  const id = raw.id ?? raw.operationId ?? '';
  // Hog uses 'succeeded' (and historically 'completed'); normalise to 'completed'.
  const status = normaliseStatus(raw.status);
  return {
    operation_id: id,
    status,
    result: raw.result as T | undefined,
    credits_spent: raw.meta?.cost?.actual ?? 0,
    error: raw.error?.message ? { code: raw.error.code ?? 'unknown', message: raw.error.message } : undefined,
  };
}

function normaliseStatus(s: string): HogOperationResult['status'] {
  switch (s) {
    case 'queued':         return 'pending';
    case 'processing':     return 'running';
    case 'running':        return 'running';
    case 'succeeded':      return 'completed';
    case 'completed':      return 'completed';
    case 'partial_success':return 'completed';
    case 'failed':         return 'failed';
    case 'cancelled':      return 'failed';
    default:               return 'running';
  }
}

function parseOperationHandle(capability: HogCapability, body: unknown): HogOperationHandle {
  const b = body as Partial<{ operationId: string; meta: { estimatedCost?: number; requestId?: string } }>;
  return {
    operation_id: b.operationId ?? '',
    capability,
    submitted_at: Date.now(),
    est_cost_credits: b.meta?.estimatedCost ?? 0,
    idempotency_key: '', // populated by caller when issuing the op
  };
}

function mapPeopleResearchResponse(raw: unknown): PeopleResearchResult {
  const r = raw as Partial<{
    fullName: string;
    title: string;
    companyName: string;
    location: string;
    signals: { source?: string; text?: string; observedAt?: string }[];
    recent_signals: { source?: string; text?: string; observed_at?: string }[];
  }>;
  const signals = r.recent_signals ?? r.signals ?? [];
  return {
    full_name: r.fullName,
    title: r.title,
    company_name: r.companyName,
    location: r.location,
    recent_signals: signals.map((s) => ({
      source: s.source ?? 'unknown',
      text: s.text ?? '',
      observed_at: (s as Record<string, string>).observed_at ?? (s as Record<string, string>).observedAt ?? new Date().toISOString(),
    })),
  };
}

/** Map a `DeepResearchResult` out of an Operation's `result` payload. */
export function extractDeepResearchResult(raw: unknown): DeepResearchResult | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Partial<{ headline: string; facts: { source: string; text: string; url?: string; confidence?: number }[]; companyName: string; mainProducts: string[]; recentFunding: { amount?: string; round?: string; date?: string } }>;
  if (r.headline && Array.isArray(r.facts)) {
    return {
      headline: r.headline,
      facts: r.facts.map((f) => ({
        source: f.source,
        text: f.text,
        url: f.url,
        confidence: f.confidence ?? 0.8,
      })),
    };
  }
  // Synthesize a headline + facts from common deep-research result shapes.
  const headline = r.companyName
    ? `${r.companyName} — ${r.recentFunding?.round ?? 'recent activity'} ${r.recentFunding?.date ?? ''}`.trim()
    : 'Deep research completed';
  const facts: DeepResearchResult['facts'] = [];
  if (r.mainProducts?.length) {
    facts.push({ source: 'product_summary', text: r.mainProducts.join(', '), confidence: 0.9 });
  }
  if (r.recentFunding?.amount) {
    facts.push({
      source: 'funding_news',
      text: `${r.recentFunding.round ?? 'Funding'} of ${r.recentFunding.amount} (${r.recentFunding.date ?? 'date unknown'})`,
      confidence: 0.85,
    });
  }
  return facts.length > 0 ? { headline, facts } : null;
}
