/**
 * GBrain HTTP Client
 * 
 * Typed HTTP client for GBrain with timeout and retry logic.
 */

export interface GBrainMemory {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GBrainQuery {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface GBrainQueryResult {
  memories: Array<{
    memory: GBrainMemory;
    score: number;
  }>;
  query_time_ms: number;
}

export interface GBrainClientConfig {
  endpoint: string;
  timeout_ms?: number;
  max_retries?: number;
  api_key?: string;
}

export class GBrainClient {
  private config: Required<Omit<GBrainClientConfig, 'api_key'>> & { api_key?: string };

  constructor(config: GBrainClientConfig) {
    this.config = {
      endpoint: config.endpoint,
      timeout_ms: config.timeout_ms || 30000,
      max_retries: config.max_retries || 3,
      api_key: config.api_key,
    };
  }

  /**
   * Execute a request with retry logic
   */
  private async fetchWithRetry(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let lastError: Error | null = null;
    const url = `${this.config.endpoint}${path}`;

    for (let attempt = 0; attempt < this.config.max_retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout_ms);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        };

        if (this.config.api_key) {
          headers['Authorization'] = `Bearer ${this.config.api_key}`;
        }

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx)
        if (lastError.message.includes('HTTP 4')) {
          throw lastError;
        }

        // Exponential backoff before retry
        if (attempt < this.config.max_retries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Write a memory to GBrain
   */
  async writeMemory(memory: {
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
  }): Promise<GBrainMemory> {
    const response = await this.fetchWithRetry('/api/v1/memories', {
      method: 'POST',
      body: JSON.stringify(memory),
    });

    return response.json() as Promise<GBrainMemory>;
  }

  /**
   * Batch write memories
   */
  async writeMemories(memories: Array<{
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
  }>): Promise<GBrainMemory[]> {
    const response = await this.fetchWithRetry('/api/v1/memories/batch', {
      method: 'POST',
      body: JSON.stringify({ memories }),
    });

    return response.json() as Promise<GBrainMemory[]>;
  }

  /**
   * Query memories from GBrain
   */
  async query(query: GBrainQuery): Promise<GBrainQueryResult> {
    const response = await this.fetchWithRetry('/api/v1/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });

    return response.json() as Promise<GBrainQueryResult>;
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(id: string): Promise<GBrainMemory | null> {
    try {
      const response = await this.fetchWithRetry(`/api/v1/memories/${id}`, {
        method: 'GET',
      });

      return response.json() as Promise<GBrainMemory>;
    } catch (error) {
      if ((error as Error).message.includes('HTTP 404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<void> {
    await this.fetchWithRetry(`/api/v1/memories/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Update a memory
   */
  async updateMemory(
    id: string,
    updates: {
      content?: string;
      embedding?: number[];
      metadata?: Record<string, any>;
    }
  ): Promise<GBrainMemory> {
    const response = await this.fetchWithRetry(`/api/v1/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    return response.json() as Promise<GBrainMemory>;
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{
    healthy: boolean;
    version?: string;
    latency_ms: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.fetchWithRetry('/health', {
        method: 'GET',
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      return {
        healthy: true,
        version: data.version,
        latency_ms: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency_ms: latency,
      };
    }
  }

  /**
   * Update the endpoint configuration
   */
  setEndpoint(endpoint: string): void {
    this.config.endpoint = endpoint;
  }

  /**
   * Update the API key
   */
  setApiKey(apiKey: string): void {
    this.config.api_key = apiKey;
  }

  /**
   * Get current configuration
   */
  getConfig(): GBrainClientConfig {
    return {
      endpoint: this.config.endpoint,
      timeout_ms: this.config.timeout_ms,
      max_retries: this.config.max_retries,
      api_key: this.config.api_key,
    };
  }
}
