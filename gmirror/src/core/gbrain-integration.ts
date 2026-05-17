import { z } from 'zod';
import {
  GBrainAnalyticsRequest,
  GBrainAnalyticsRequestSchema,
  Scenario,
  ScenarioSchema,
  ScopeBundleSchema,
  TestRequest,
  TestRequestSchema,
} from '../types/index.js';
import { getDefaultSecretManager } from './security.js';

export type GBrainIntegrationMode = 'http' | 'mcp';

export interface GBrainIntegrationConfig {
  endpoint?: string;
  mcpEndpoint?: string;
  mode?: GBrainIntegrationMode;
  authToken?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  circuitBreakerFailureThreshold?: number;
  circuitBreakerCooldownMs?: number;
}

export class GBrainIntegrationError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'network' | 'auth' | 'server_error' | 'parse_error' | 'circuit_open',
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'GBrainIntegrationError';
  }
}

const HealthSchema = z.object({ ok: z.boolean().optional(), status: z.string().optional() }).passthrough();
const AnalyticsResponseSchema = z.object({
  user_distribution: z.record(z.number()).optional(),
}).passthrough();
const ReplayRequestSchema = z.object({
  request: TestRequestSchema,
  scope: ScopeBundleSchema,
});
const PageSchema = z.object({
  page_id: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
}).passthrough();
const PageArraySchema = z.array(PageSchema);
const DriftAckSchema = z.object({ ack_id: z.string().optional() }).passthrough();
const GenericObjectSchema = z.record(z.any());

export type GBrainPage = z.infer<typeof PageSchema>;

/**
 * Typed GBrain client for GMirror context, replay, analytics, and QC writes.
 */
export class GBrainIntegrationClient {
  private readonly endpoint: string;
  private readonly mcpEndpoint: string;
  private readonly mode: GBrainIntegrationMode;
  private readonly authToken?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly circuitBreakerFailureThreshold: number;
  private readonly circuitBreakerCooldownMs: number;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(config: GBrainIntegrationConfig = {}) {
    const secrets = getDefaultSecretManager();
    this.endpoint = trimTrailingSlash(config.endpoint || process.env.GBRAIN_ENDPOINT || 'http://localhost:3000');
    this.mcpEndpoint = trimTrailingSlash(config.mcpEndpoint || process.env.GBRAIN_MCP_ENDPOINT || `${this.endpoint}/mcp`);
    this.mode = config.mode || (process.env.GBRAIN_INTEGRATION_MODE as GBrainIntegrationMode | undefined) || 'http';
    this.authToken = config.authToken || secrets.get('gbrain_auth_token');
    this.timeoutMs = config.timeoutMs ?? Number(process.env.GBRAIN_TIMEOUT_MS ?? 30000);
    this.maxRetries = config.maxRetries ?? Number(process.env.GBRAIN_MAX_RETRIES ?? 3);
    this.initialBackoffMs = config.initialBackoffMs ?? Number(process.env.GBRAIN_BACKOFF_MS ?? 250);
    this.circuitBreakerFailureThreshold = config.circuitBreakerFailureThreshold ?? Number(process.env.GBRAIN_CIRCUIT_FAILURES ?? 3);
    this.circuitBreakerCooldownMs = config.circuitBreakerCooldownMs ?? Number(process.env.GBRAIN_CIRCUIT_COOLDOWN_MS ?? 60000);
  }

  async healthCheck(): Promise<{ ok?: boolean; status?: string }> {
    if (this.mode === 'mcp') {
      return this.callMcpTool('gbrain.health', {}, HealthSchema);
    }
    return this.requestJson('/health', { method: 'GET' }, HealthSchema);
  }

  async getAnalytics(request: GBrainAnalyticsRequest): Promise<z.infer<typeof AnalyticsResponseSchema>> {
    const payload = GBrainAnalyticsRequestSchema.parse(request);
    if (this.mode === 'mcp') {
      return this.callMcpTool('gbrain.get_analytics', payload, AnalyticsResponseSchema);
    }
    return this.requestJson('/gbrain/analytics', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, AnalyticsResponseSchema);
  }

  async getReplayRequest(requestId: string): Promise<{ request: TestRequest; scope: z.infer<typeof ScopeBundleSchema> }> {
    if (this.mode === 'mcp') {
      return this.callMcpTool('gbrain.get_gmirror_request', { request_id: requestId }, ReplayRequestSchema);
    }
    return this.requestJson(`/api/requests/${encodeURIComponent(requestId)}`, { method: 'GET' }, ReplayRequestSchema);
  }

  async searchPages(query: string, tags: string[] = []): Promise<GBrainPage[]> {
    if (this.mode === 'mcp') {
      return this.callMcpTool('gbrain.search_pages', { query, tags }, PageArraySchema);
    }
    const params = new URLSearchParams({ query });
    if (tags.length > 0) {
      params.set('tags', tags.join(','));
    }
    return this.requestJson(`/api/pages/search?${params.toString()}`, { method: 'GET' }, PageArraySchema);
  }

  async getScenarioCorpus(request: TestRequest, scenarioSetIds: string[]): Promise<Scenario[]> {
    if (this.mode === 'mcp') {
      const response = await this.callMcpTool('gbrain.get_gmirror_scenarios', {
        request_id: request.request_id,
        scenario_set: scenarioSetIds,
        mode: request.mode,
      }, z.object({ scenarios: z.array(ScenarioSchema) }).or(z.array(ScenarioSchema)));
      return Array.isArray(response) ? response : response.scenarios;
    }

    const query = [
      'gmirror scenario',
      request.mode,
      ...scenarioSetIds,
      String(request.context?.surface || ''),
    ].filter(Boolean).join(' ');
    const pages = await this.searchPages(query, ['gmirror', 'scenario']);
    return pages.flatMap((page) => scenariosFromPage(page)).slice(0, 10);
  }

  async storeDriftDetection(input: {
    component: string;
    metric_name: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    confidence: number;
    current_value: number;
    average_value: number;
    at_risk: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<{ ack_id?: string }> {
    if (this.mode === 'mcp') {
      return this.callMcpTool('gbrain.qc_store_drift_detection', input, DriftAckSchema);
    }
    return this.requestJson('/api/qc/drift-detection', {
      method: 'POST',
      body: JSON.stringify(input),
    }, DriftAckSchema);
  }

  async getGmirrorStats(): Promise<Record<string, unknown>> {
    return this.requestJson('/api/gmirror/stats', { method: 'GET' }, GenericObjectSchema);
  }

  async getGmirrorTrend(windowDays: number): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ window: String(windowDays) });
    return this.requestJson(`/api/gmirror/trend?${params.toString()}`, { method: 'GET' }, GenericObjectSchema);
  }

  async getGmirrorSandboxStats(): Promise<Record<string, unknown>> {
    return this.requestJson('/api/gmirror/sandbox-stats', { method: 'GET' }, GenericObjectSchema);
  }

  getCircuitState(): { open: boolean; openUntil?: string; consecutiveFailures: number } {
    const open = this.isCircuitOpen();
    return {
      open,
      openUntil: open ? new Date(this.circuitOpenUntil).toISOString() : undefined,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private async callMcpTool<T>(toolName: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const raw = await this.requestJson(`${this.mcpEndpoint}/tools/${encodeURIComponent(toolName)}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }, z.unknown(), true);
    return schema.parse(normalizeMcpResponse(raw));
  }

  private async requestJson<T>(
    pathOrUrl: string,
    options: RequestInit,
    schema: z.ZodType<T>,
    absoluteUrl = false,
  ): Promise<T> {
    this.assertCircuitClosed();
    const url = absoluteUrl ? pathOrUrl : `${this.endpoint}${pathOrUrl}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);
        if (!response.ok) {
          throw this.errorFromResponse(response);
        }
        const parsed = schema.parse(await parseJson(response));
        this.resetCircuit();
        return parsed;
      } catch (error) {
        lastError = normalizeError(error, url, this.timeoutMs);
        this.recordFailure(lastError);
        const retryable = lastError instanceof GBrainIntegrationError && lastError.retryable;
        if (!retryable || attempt >= this.maxRetries) {
          throw lastError;
        }
        await delay(this.initialBackoffMs * Math.pow(2, attempt));
      }
    }

    throw normalizeError(lastError, url, this.timeoutMs);
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headersToRecord(options.headers),
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private errorFromResponse(response: Response): GBrainIntegrationError {
    if (response.status === 401 || response.status === 403) {
      return new GBrainIntegrationError('auth', `GBrain authentication failed with ${response.status}`, response.status, false);
    }
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    return new GBrainIntegrationError('server_error', `GBrain returned ${response.status}`, response.status, retryable);
  }

  private assertCircuitClosed(): void {
    if (!this.isCircuitOpen()) {
      return;
    }
    throw new GBrainIntegrationError('circuit_open', `GBrain circuit breaker is open until ${new Date(this.circuitOpenUntil).toISOString()}`, undefined, true);
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil === 0) {
      return false;
    }
    if (Date.now() >= this.circuitOpenUntil) {
      this.circuitOpenUntil = 0;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  private recordFailure(error: unknown): void {
    if (!(error instanceof GBrainIntegrationError) || !error.retryable) {
      return;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.circuitBreakerFailureThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitBreakerCooldownMs;
    }
  }

  private resetCircuit(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }
}

function scenariosFromPage(page: GBrainPage): Scenario[] {
  try {
    const parsed = JSON.parse(page.content);
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scenarios)
        ? parsed.scenarios
        : [parsed.scenario ?? parsed];
    return candidates
      .map((candidate: unknown) => ScenarioSchema.safeParse(candidate))
      .filter((result: z.SafeParseReturnType<unknown, Scenario>): result is z.SafeParseSuccess<Scenario> => result.success)
      .map((result: z.SafeParseSuccess<Scenario>) => result.data);
  } catch {
    return [];
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new GBrainIntegrationError('parse_error', `GBrain response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`, response.status, false);
  }
}

function normalizeError(error: unknown, url: string, timeoutMs: number): GBrainIntegrationError {
  if (error instanceof GBrainIntegrationError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new GBrainIntegrationError('parse_error', `GBrain response failed schema validation: ${error.message}`, undefined, false);
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new GBrainIntegrationError('timeout', `GBrain request to ${url} timed out after ${timeoutMs}ms`, undefined, true);
  }
  return new GBrainIntegrationError('network', `GBrain request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`, undefined, true);
}

function normalizeMcpResponse(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const value = data as Record<string, unknown>;
  if ('result' in value) {
    return value.result;
  }
  if ('data' in value) {
    return value.data;
  }
  if (Array.isArray(value.content)) {
    const text = value.content
      .map((item) => typeof item === 'object' && item !== null ? (item as Record<string, unknown>).text : undefined)
      .filter((item): item is string => typeof item === 'string')
      .join('\n');
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
  return data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
