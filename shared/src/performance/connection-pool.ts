/**
 * HTTP Connection Pool
 * 
 * Manages a pool of HTTP connections to improve performance and reduce overhead.
 * Supports connection reuse, keep-alive, and concurrent request limits.
 */

export interface ConnectionConfig {
  maxConnections: number; // Maximum number of connections per host
  maxFreeConnections: number; // Maximum number of idle connections to keep
  keepAliveTimeoutMs: number; // How long to keep idle connections alive
  requestTimeoutMs: number; // Default request timeout
}

export interface PooledRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface PooledResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  fromCache: boolean;
}

export class ConnectionPool {
  private config: ConnectionConfig;
  private connections: Map<string, any[]>; // Host -> connections
  private activeConnections: Map<string, number>; // Host -> active count
  private requestQueue: Map<string, Array<(response: PooledResponse) => void>>;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      maxFreeConnections: config.maxFreeConnections || 5,
      keepAliveTimeoutMs: config.keepAliveTimeoutMs || 30000,
      requestTimeoutMs: config.requestTimeoutMs || 30000,
    };
    this.connections = new Map();
    this.activeConnections = new Map();
    this.requestQueue = new Map();
  }

  /**
   * Extract hostname from URL
   */
  private extractHost(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get or create a connection for a host
   */
  private async getConnection(host: string): Promise<any> {
    const connections = this.connections.get(host) || [];
    const active = this.activeConnections.get(host) || 0;

    // Reuse existing idle connection
    if (connections.length > 0 && active < this.config.maxConnections) {
      const connection = connections.pop();
      this.activeConnections.set(host, active + 1);
      return connection;
    }

    // Create new connection if under limit
    if (active < this.config.maxConnections) {
      this.activeConnections.set(host, active + 1);
      return this.createConnection(host);
    }

    // Wait for available connection
    return new Promise((resolve) => {
      const queue = this.requestQueue.get(host) || [];
      queue.push(resolve);
      this.requestQueue.set(host, queue);
    });
  }

  /**
   * Create a new connection
   */
  private async createConnection(host: string): Promise<any> {
    // In a real implementation, this would create an actual HTTP connection
    // For now, we return a mock object
    return {
      host,
      createdAt: Date.now(),
      used: false,
    };
  }

  /**
   * Release a connection back to the pool
   */
  private async releaseConnection(host: string, connection: any): Promise<void> {
    const connections = this.connections.get(host) || [];
    const active = this.activeConnections.get(host) || 0;

    // Check if connection is still valid (not expired)
    const age = Date.now() - connection.createdAt;
    if (age > this.config.keepAliveTimeoutMs) {
      this.activeConnections.set(host, Math.max(0, active - 1));
      this.checkQueue(host);
      return;
    }

    // Return to pool if under limit
    if (connections.length < this.config.maxFreeConnections) {
      connection.used = true;
      connection.lastUsed = Date.now();
      connections.push(connection);
      this.connections.set(host, connections);
    }

    this.activeConnections.set(host, Math.max(0, active - 1));
    this.checkQueue(host);
  }

  /**
   * Check if there are pending requests waiting for a connection
   */
  private checkQueue(host: string): void {
    const queue = this.requestQueue.get(host) || [];
    if (queue.length > 0) {
      const next = queue.shift();
      if (next) {
        this.getConnection(host).then(next);
      }
      this.requestQueue.set(host, queue);
    }
  }

  /**
   * Make an HTTP request using the pool
   */
  async request(request: PooledRequest): Promise<PooledResponse> {
    const host = this.extractHost(request.url);
    const connection = await this.getConnection(host);
    const timeout = request.timeout || this.config.requestTimeoutMs;

    try {
      return await this.executeRequest(connection, request, timeout);
    } finally {
      await this.releaseConnection(host, connection);
    }
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest(
    connection: any,
    request: PooledRequest,
    timeout: number
  ): Promise<PooledResponse> {
    // In a real implementation, this would use the connection to make the request
    // For now, we simulate a request
    return {
      status: 200,
      headers: {},
      body: '{}',
      fromCache: false,
    };
  }

  /**
   * Make a GET request
   */
  async get(url: string, headers?: Record<string, string>, timeout?: number): Promise<PooledResponse> {
    return this.request({
      url,
      method: 'GET',
      headers,
      timeout,
    });
  }

  /**
   * Make a POST request
   */
  async post(
    url: string,
    body: string,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<PooledResponse> {
    return this.request({
      url,
      method: 'POST',
      headers,
      body,
      timeout,
    });
  }

  /**
   * Make a PUT request
   */
  async put(
    url: string,
    body: string,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<PooledResponse> {
    return this.request({
      url,
      method: 'PUT',
      headers,
      body,
      timeout,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(url: string, headers?: Record<string, string>, timeout?: number): Promise<PooledResponse> {
    return this.request({
      url,
      method: 'DELETE',
      headers,
      timeout,
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalHosts: number;
    totalConnections: number;
    totalActive: number;
    totalIdle: number;
    totalQueued: number;
    byHost: Record<string, { active: number; idle: number; queued: number }>;
  } {
    let totalConnections = 0;
    let totalActive = 0;
    let totalIdle = 0;
    let totalQueued = 0;
    const byHost: Record<string, { active: number; idle: number; queued: number }> = {};

    for (const [host, connections] of this.connections.entries()) {
      const active = this.activeConnections.get(host) || 0;
      const queued = this.requestQueue.get(host)?.length || 0;
      const idle = connections.length;

      totalConnections += active + idle;
      totalActive += active;
      totalIdle += idle;
      totalQueued += queued;

      byHost[host] = { active, idle, queued };
    }

    return {
      totalHosts: this.connections.size,
      totalConnections,
      totalActive,
      totalIdle,
      totalQueued,
      byHost,
    };
  }

  /**
   * Close all connections for a host
   */
  async closeHost(host: string): Promise<void> {
    this.connections.delete(host);
    this.activeConnections.delete(host);
    const queue = this.requestQueue.get(host) || [];
    for (const resolve of queue) {
      resolve({
        status: 503,
        headers: {},
        body: 'Service Unavailable',
        fromCache: false,
      });
    }
    this.requestQueue.delete(host);
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const hosts = Array.from(this.connections.keys());
    for (const host of hosts) {
      await this.closeHost(host);
    }
  }

  /**
   * Clean up expired connections
   */
  cleanup(): void {
    const now = Date.now();
    for (const [host, connections] of this.connections.entries()) {
      const validConnections = connections.filter(
        conn => (now - conn.createdAt) < this.config.keepAliveTimeoutMs
      );
      this.connections.set(host, validConnections);
    }
  }
}

/**
 * Global connection pool instance
 */
let globalConnectionPool: ConnectionPool | null = null;

export function getConnectionPool(config?: Partial<ConnectionConfig>): ConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new ConnectionPool(config);
  }
  return globalConnectionPool;
}

export function resetConnectionPool(): void {
  if (globalConnectionPool) {
    globalConnectionPool.closeAll();
  }
  globalConnectionPool = null;
}
