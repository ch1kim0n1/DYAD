/**
 * Health Server - Exposes HTTP endpoints for readiness/liveness probes
 *
 * Provides standard Kubernetes-style health endpoints:
 * - /health/live - Liveness probe (is the process running?)
 * - /health/ready - Readiness probe (is the service ready to accept traffic?)
 * - /health/shutdown - Graceful shutdown trigger
 */

import { IncomingMessage, ServerResponse } from 'http';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

export interface ReadinessCheckResult extends HealthCheckResult {
  dependencies: {
    [key: string]: 'ok' | 'error';
  };
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;
export type ReadinessCheckFn = () => Promise<ReadinessCheckResult>;

export class HealthServer {
  private livenessCheck: HealthCheckFn;
  private readinessCheck: ReadinessCheckFn;
  private server: any = null;
  private isShuttingDown = false;
  private shutdownTimeout: number;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  constructor(
    livenessCheck: HealthCheckFn,
    readinessCheck: ReadinessCheckFn,
    private port: number = 8080,
    shutdownTimeout: number = 30000
  ) {
    this.livenessCheck = livenessCheck;
    this.readinessCheck = readinessCheck;
    this.shutdownTimeout = shutdownTimeout;
  }

  /**
   * Add a shutdown handler to be called during graceful shutdown
   */
  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Start the health server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Health server already running');
    }

    // Dynamically import http to avoid issues in non-Node environments
    const http = await import('node:http');

    this.server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleRequest(req, res);
    });

    this.server.on('error', (err: Error) => {
      console.error('[HealthServer] Error:', err);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`[HealthServer] Listening on port ${this.port}`);
        console.log(`[HealthServer] Endpoints:`);
        console.log(`[HealthServer]   GET /health/live - Liveness probe`);
        console.log(`[HealthServer]   GET /health/ready - Readiness probe`);
        console.log(`[HealthServer]   POST /health/shutdown - Graceful shutdown`);
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: any, res: any): Promise<void> {
    const { method, url } = req;

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
      if (url === '/health/live' && method === 'GET') {
        await this.handleLiveness(res);
      } else if (url === '/health/ready' && method === 'GET') {
        await this.handleReadiness(res);
      } else if (url === '/health/shutdown' && method === 'POST') {
        await this.handleShutdown(res);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[HealthServer] Request error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle liveness probe
   */
  private async handleLiveness(res: ServerResponse): Promise<void> {
    if (this.isShuttingDown) {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'shutting_down' }));
      return;
    }

    const result = await this.livenessCheck();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  /**
   * Handle readiness probe
   */
  private async handleReadiness(res: ServerResponse): Promise<void> {
    if (this.isShuttingDown) {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'shutting_down' }));
      return;
    }

    const result = await this.readinessCheck();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  /**
   * Handle graceful shutdown trigger
   */
  private async handleShutdown(res: ServerResponse): Promise<void> {
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'shutdown_initiated' }));
    
    // Trigger graceful shutdown asynchronously
    this.shutdown().catch(err => {
      console.error('[HealthServer] Shutdown error:', err);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('[HealthServer] Initiating graceful shutdown...');

    // Run all shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('[HealthServer] Shutdown handler error:', error);
      }
    }

    // Close the server
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('[HealthServer] Server closed');
          resolve();
        });
        
        // Force close after timeout
        setTimeout(() => {
          console.warn('[HealthServer] Shutdown timeout, forcing close');
          resolve();
        }, this.shutdownTimeout);
      });
    }
  }

  /**
   * Stop the health server immediately (non-graceful)
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
