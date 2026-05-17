/**
 * GMirror HTTP client
 */

export interface ScoreInput {
  attempt_id: string;
  task: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface ScoreResponse {
  attempt_id: string;
  score: number;
  confidence: number;
  breakdown: {
    correctness: number;
    completeness: number;
    clarity: number;
  };
  timestamp: string;
  overall?: string;
  scoring_mode?: string;
  scores?: Record<string, unknown>;
}

export interface RelationalInsightScoreInput {
  insight_id: string;
  dyad_id: string;
  insight_type: 'emotion_label' | 'bid_classification' | 'repair_suggestion' | 'labor_asymmetry';
  insight_text: string;
  confidence?: number;
  supporting_evidence: string[];
  ethical_refusal_triggered: boolean;
}

export interface HealthResult {
  status: string;
  timestamp: string;
  [key: string]: unknown;
}

export class GMirrorClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3002';
    this.token = options.token;
  }

  /** POST /gmirror/score — score a single attempt */
  async score(input: ScoreInput): Promise<ScoreResponse> {
    return this.request<ScoreResponse>('POST', '/gmirror/score', input);
  }

  /** POST /gmirror/score-insight — score a relational insight with DYAD rubric */
  async scoreInsight(input: RelationalInsightScoreInput): Promise<ScoreResponse> {
    return this.request<ScoreResponse>('POST', '/gmirror/score-insight', input);
  }

  /** GET /health/live */
  async health(): Promise<HealthResult> {
    return this.request<HealthResult>('GET', '/health/live');
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
    return res.json() as Promise<T>;
  }
}
