/**
 * GMirror HTTP Server
 * 
 * Exposes HTTP endpoints for scoring attempts:
 * - POST /gmirror/score - Score a single attempt
 * - POST /gmirror/score/stream - Stream scoring results
 * - GET /health/live - Liveness probe
 * - GET /health/ready - Readiness probe
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { GMirror } from './core/gmirror';
import { LocalLogger } from './core/observability.js';

export const ScoreRequestSchema = z.object({
  attempt_id: z.string().uuid(),
  task: z.string().min(1),
  output: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export interface ScoreRequest {
  attempt_id: string;
  task: string;
  output: string;
  metadata?: Record<string, any>;
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
  scores?: Record<string, any>;
}

export interface RelationalInsightScoreRequest {
  insight_id: string;
  dyad_id: string;
  insight_type: 'emotion_label' | 'bid_classification' | 'repair_suggestion' | 'labor_asymmetry';
  insight_text: string;
  confidence?: number;
  supporting_evidence: string[];
  ethical_refusal_triggered: boolean;
}

export class GMirrorServer {
  private gmirror: GMirror;
  private server: any = null;
  private port: number;
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private logger: LocalLogger;

  constructor(gmirror: GMirror, port: number = 3002) {
    this.gmirror = gmirror;
    this.port = port;
    this.logger = new LocalLogger('gmirror-server');
  }

  /**
   * Add a shutdown handler to be called during graceful shutdown
   */
  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const http = await import('node:http');

    this.server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleRequest(req, res);
    });

    // Add SIGTERM and SIGINT handlers for graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        this.logger.info('Listening', { port: this.port });
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { method, url } = req;

    // Security headers (helmet-equivalent for plain http server)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (url === '/gmirror/score-insight' && method === 'POST') {
        await this.handleScoreInsight(req, res);
      } else if (url === '/gmirror/score' && method === 'POST') {
        await this.handleScore(req, res);
      } else if (url === '/health/live' && method === 'GET') {
        await this.handleLiveness(res);
      } else if (url === '/health/ready' && method === 'GET') {
        await this.handleReadiness(res);
      } else if (url === '/metrics' && method === 'GET') {
        await this.handlePrometheusMetrics(res);
      } else if (url === '/metrics/otel' && method === 'GET') {
        await this.handleOpenTelemetryMetrics(res);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      this.logger.error('Request error', error instanceof Error ? error : { error: String(error) });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle score request
   */
  private async handleScore(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const http = await import('node:http');
    const bufferModule = await import('node:buffer');

    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk as Buffer);
    }
    const body = bufferModule.Buffer.concat(buffers).toString();

    const parsed = ScoreRequestSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }));
      return;
    }
    const request: ScoreRequest = parsed.data;
    // Adapt the request to GMirror.scoreChange which is the actual public API.
    const result = await this.gmirror.scoreChange(
      {
        request_id: request.attempt_id,
        mode: 'change',
        payload: { task: request.task, output: request.output },
        context: request.metadata ?? {},
        budget: { max_cost_usd: 10, max_latency_ms: 60000, max_panel_size: 10 },
        caller: { source: 'http', ref: 'server' },
        created_at: new Date().toISOString(),
      } as any,
      {
        request_id: request.attempt_id,
        population_filter: { persona_labels: [], expertise_domains: [], trust_range: [0, 1] },
        scenario_set: [],
        red_team_set: [],
        scoring_profile: 'default',
        panel_size: 10,
      } as any
    );

    const response: ScoreResponse = {
      attempt_id: request.attempt_id,
      score: result.scores.correctness.score.point,
      confidence: result.scores.confidence.score.point,
      breakdown: {
        correctness: result.scores.correctness.score.point,
        completeness: result.scores.user_outcome.score.point,
        clarity: result.scores.robustness.score.point,
      },
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private async handleScoreInsight(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const request = await this.readJsonBody<RelationalInsightScoreRequest>(req);
    const validationError = this.validateRelationalInsightRequest(request);
    if (validationError) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: validationError }));
      return;
    }

    const verdict = await this.gmirror.scoreRelationalInsight({
      ...request,
      confidence: request.confidence ?? 0.7,
    });
    const scores = verdict.scores as any;
    const response: ScoreResponse = {
      attempt_id: request.insight_id,
      score: verdict.execution_receipt?.overall_score ?? 0,
      confidence: scores.confidence?.score?.point ?? 1,
      breakdown: {
        correctness: scores.research_grounding?.score?.point ?? 0,
        completeness: scores.actionability?.score?.point ?? 0,
        clarity: scores.non_harm?.score?.point ?? 0,
      },
      timestamp: new Date().toISOString(),
      overall: verdict.overall,
      scoring_mode: 'dyad_insight',
      scores,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private async readJsonBody<T>(req: IncomingMessage): Promise<T> {
    const bufferModule = await import('node:buffer');
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk as Buffer);
    }
    return JSON.parse(bufferModule.Buffer.concat(buffers).toString());
  }

  private validateRelationalInsightRequest(request: RelationalInsightScoreRequest): string | null {
    if (!/^[a-f0-9]{8,}$/i.test(request.dyad_id)) {
      return 'dyad_id must be a hashed hex identifier';
    }
    const evidence = Array.isArray(request.supporting_evidence) ? request.supporting_evidence.join('\n') : '';
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(evidence)) {
      return 'supporting_evidence must not contain email addresses';
    }
    if (/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/.test(evidence)) {
      return 'supporting_evidence must not contain phone numbers';
    }
    return null;
  }

  /**
   * Handle liveness probe
   */
  private async handleLiveness(res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  }

  /**
   * Handle readiness probe
   */
  private async handleReadiness(res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready', timestamp: new Date().toISOString() }));
  }

  private async handlePrometheusMetrics(res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(this.gmirror.exportPrometheusMetrics());
  }

  private async handleOpenTelemetryMetrics(res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.gmirror.exportOpenTelemetryMetrics()));
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown');

    // Run all shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Shutdown handler error', error instanceof Error ? error : { error: String(error) });
      }
    }

    // Close the server
    this.stop();
    this.logger.info('Shutdown complete');
  }
}
