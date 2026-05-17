/**
 * GBrain HTTP client
 */

export interface PageInput {
  content: string;
  metadata?: Record<string, unknown>;
  page_kind?: string;
  tags?: string[];
}

export interface Page extends PageInput {
  id: string;
  updated_at: string;
}

export interface RunInput {
  task_id: string;
  config?: Record<string, unknown>;
  verdict?: string;
  cost_usd?: number;
}

export interface Run extends RunInput {
  id: string;
  created_at: string;
}

export interface ReceiptInput {
  run_id: string;
  fingerprint: string;
  payload: Record<string, unknown>;
}

export interface Receipt extends ReceiptInput {
  id: string;
  created_at: string;
}

export interface DriftEntry {
  id: string;
  metric: string;
  value: number;
  window: string;
  recorded_at: string;
}

export interface ObservationInput {
  type: string;
  data?: Record<string, unknown>;
  source?: string;
}

export interface Observation extends ObservationInput {
  id: string;
  created_at: string;
}

export interface CognitiveState {
  id: string;
  user_id: string;
  state: Record<string, unknown>;
  updated_at: string;
}

export class GBrainClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3000';
    this.token = options.token;
  }

  // Pages
  async createPage(input: PageInput): Promise<Page> {
    return this.request<Page>('POST', '/pages', input);
  }

  async getPage(id: string): Promise<Page> {
    return this.request<Page>('GET', `/pages/${encodeURIComponent(id)}`);
  }

  async listPages(tag?: string): Promise<Page[]> {
    const qs = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return this.request<Page[]>('GET', `/pages${qs}`);
  }

  async deletePage(id: string): Promise<void> {
    return this.request<void>('DELETE', `/pages/${encodeURIComponent(id)}`);
  }

  // Runs
  async createRun(input: RunInput): Promise<Run> {
    return this.request<Run>('POST', '/runs', input);
  }

  async getRun(id: string): Promise<Run> {
    return this.request<Run>('GET', `/runs/${encodeURIComponent(id)}`);
  }

  async listRuns(taskId?: string): Promise<Run[]> {
    const qs = taskId ? `?task_id=${encodeURIComponent(taskId)}` : '';
    return this.request<Run[]>('GET', `/runs${qs}`);
  }

  // Receipts
  async createReceipt(input: ReceiptInput): Promise<Receipt> {
    return this.request<Receipt>('POST', '/receipts', input);
  }

  async getReceiptsByRun(runId: string): Promise<Receipt[]> {
    return this.request<Receipt[]>('GET', `/receipts/${encodeURIComponent(runId)}`);
  }

  // Drift
  async recordDrift(metric: string, value: number, window?: string): Promise<DriftEntry> {
    return this.request<DriftEntry>('POST', '/drift', { metric, value, window });
  }

  async getDrift(metric: string): Promise<DriftEntry[]> {
    return this.request<DriftEntry[]>('GET', `/drift/${encodeURIComponent(metric)}`);
  }

  // Cognitive state
  async getCognitiveState(userId: string): Promise<CognitiveState> {
    return this.request<CognitiveState>('GET', `/cognitive/${encodeURIComponent(userId)}`);
  }

  async setCognitiveState(userId: string, state: Record<string, unknown>): Promise<CognitiveState> {
    return this.request<CognitiveState>('PUT', `/cognitive/${encodeURIComponent(userId)}`, { state });
  }

  // Observations
  async createObservation(input: ObservationInput): Promise<Observation> {
    return this.request<Observation>('POST', '/observations', input);
  }

  async listObservations(type?: string, source?: string): Promise<Observation[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (source) params.set('source', source);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Observation[]>('GET', `/observations${qs}`);
  }

  // Health
  async health(): Promise<{ healthy: boolean; status: string; service: string; version: string }> {
    return this.request('GET', '/health/live');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }
}
