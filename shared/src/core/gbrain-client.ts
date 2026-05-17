/**
 * Typed GBrain Client (REST/MCP)
 * 
 * Provides:
 * - REST API client for GBrain
 * - MCP client for GBrain
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Structured error handling
 * - Type-safe request/response interfaces
 */

export interface GBrainClientConfig {
  baseUrl?: string;
  mcpUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  apiKey?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

export interface GBrainPage {
  page_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface GBrainTranscript {
  transcript_id: string;
  session_id: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface GBrainReceipt {
  receipt_id: string;
  schema_version: number;
  timestamp: string;
  project: string;
  rubric_name: string;
  verdict: 'pass' | 'fail';
  score?: number;
}

export class GBrainClientError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'network' | 'auth' | 'not_found' | 'server_error' | 'parse_error',
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'GBrainClientError';
  }
}

/**
 * GBrain REST Client
 */
export class GBrainRESTClient {
  private config: Required<Omit<GBrainClientConfig, 'mcpUrl' | 'oauthClientId' | 'oauthClientSecret'>>;

  constructor(config: GBrainClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeoutMs: config.timeoutMs || 30000,
      maxRetries: config.maxRetries || 3,
      apiKey: config.apiKey || '',
    };
  }

  /**
   * Fetch with timeout and retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Merge existing headers if provided
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, options.headers);
        }
      }

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = this.handleError(response, retryCount);
        
        if (error.retryable && retryCount < this.config.maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
        
        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new GBrainClientError(
          'timeout',
          `Request to ${url} timed out after ${this.config.timeoutMs}ms`,
          undefined,
          true
        );
        
        if (retryCount < this.config.maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
        
        throw timeoutError;
      }

      if (error instanceof GBrainClientError) {
        throw error;
      }

      throw new GBrainClientError(
        'network',
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        true
      );
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleError(response: Response, retryCount: number): GBrainClientError {
    const status = response.status;

    if (status === 401 || status === 403) {
      return new GBrainClientError('auth', 'Authentication failed', status, false);
    }

    if (status === 404) {
      return new GBrainClientError('not_found', 'Resource not found', status, false);
    }

    if (status >= 500) {
      return new GBrainClientError('server_error', `Server error: ${status}`, status, true);
    }

    if (status >= 400) {
      return new GBrainClientError('server_error', `Client error: ${status}`, status, false);
    }

    return new GBrainClientError('server_error', `Unexpected status: ${status}`, status, false);
  }

  /**
   * Get a page by ID
   */
  async getPage(pageId: string): Promise<GBrainPage> {
    const url = `${this.config.baseUrl}/api/pages/${pageId}`;
    const response = await this.fetchWithRetry(url);
    const data = await response.json();
    return data as GBrainPage;
  }

  /**
   * Create a new page
   */
  async createPage(page: Omit<GBrainPage, 'page_id' | 'created_at' | 'updated_at'>): Promise<GBrainPage> {
    const url = `${this.config.baseUrl}/api/pages`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(page),
    });
    const data = await response.json();
    return data as GBrainPage;
  }

  /**
   * Update a page
   */
  async updatePage(pageId: string, updates: Partial<GBrainPage>): Promise<GBrainPage> {
    const url = `${this.config.baseUrl}/api/pages/${pageId}`;
    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data as GBrainPage;
  }

  /**
   * Search pages
   */
  async searchPages(query: string, tags?: string[]): Promise<GBrainPage[]> {
    const params = new URLSearchParams({ query });
    if (tags) {
      params.append('tags', tags.join(','));
    }
    const url = `${this.config.baseUrl}/api/pages/search?${params.toString()}`;
    const response = await this.fetchWithRetry(url);
    const data = await response.json();
    return data as GBrainPage[];
  }

  /**
   * Get a transcript
   */
  async getTranscript(transcriptId: string): Promise<GBrainTranscript> {
    const url = `${this.config.baseUrl}/api/transcripts/${transcriptId}`;
    const response = await this.fetchWithRetry(url);
    const data = await response.json();
    return data as GBrainTranscript;
  }

  /**
   * Create a transcript
   */
  async createTranscript(transcript: Omit<GBrainTranscript, 'transcript_id'>): Promise<GBrainTranscript> {
    const url = `${this.config.baseUrl}/api/transcripts`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(transcript),
    });
    const data = await response.json();
    return data as GBrainTranscript;
  }

  /**
   * Store a receipt
   */
  async storeReceipt(receipt: Omit<GBrainReceipt, 'receipt_id'>): Promise<GBrainReceipt> {
    const url = `${this.config.baseUrl}/api/receipts`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
    const data = await response.json();
    return data as GBrainReceipt;
  }

  /**
   * Get receipts by project
   */
  async getReceipts(project: string, limit = 100): Promise<GBrainReceipt[]> {
    const params = new URLSearchParams({ project, limit: limit.toString() });
    const url = `${this.config.baseUrl}/api/receipts?${params.toString()}`;
    const response = await this.fetchWithRetry(url);
    const data = await response.json();
    return data as GBrainReceipt[];
  }
}

/**
 * GBrain MCP Client
 */
export class GBrainMCPClient {
  private config: Required<Omit<GBrainClientConfig, 'baseUrl' | 'apiKey'>>;

  constructor(config: GBrainClientConfig = {}) {
    this.config = {
      mcpUrl: config.mcpUrl || 'http://localhost:3000/mcp',
      timeoutMs: config.timeoutMs || 30000,
      maxRetries: config.maxRetries || 3,
      oauthClientId: config.oauthClientId || '',
      oauthClientSecret: config.oauthClientSecret || '',
    };
  }

  /**
   * Call an MCP tool
   */
  async callTool(
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add OAuth token if available
      if (this.config.oauthClientId && this.config.oauthClientSecret) {
        const token = await this.getOAuthToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.config.mcpUrl}/tools/${toolName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw this.handleMCPError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GBrainClientError(
          'timeout',
          `MCP call to ${toolName} timed out after ${this.config.timeoutMs}ms`,
          undefined,
          true
        );
      }

      if (error instanceof GBrainClientError) {
        throw error;
      }

      throw new GBrainClientError(
        'network',
        `MCP call failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        true
      );
    }
  }

  /**
   * Get OAuth token
   */
  private async getOAuthToken(): Promise<string> {
    const response = await fetch(`${this.config.mcpUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.oauthClientId,
        client_secret: this.config.oauthClientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new GBrainClientError('auth', 'OAuth token fetch failed', response.status, false);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Handle MCP errors
   */
  private handleMCPError(response: Response): GBrainClientError {
    const status = response.status;

    if (status === 401 || status === 403) {
      return new GBrainClientError('auth', 'MCP authentication failed', status, false);
    }

    if (status === 404) {
      return new GBrainClientError('not_found', 'MCP tool not found', status, false);
    }

    if (status >= 500) {
      return new GBrainClientError('server_error', `MCP server error: ${status}`, status, true);
    }

    return new GBrainClientError('server_error', `MCP error: ${status}`, status, false);
  }
}

/**
 * Unified GBrain Client
 */
export class GBrainClient {
  private rest: GBrainRESTClient;
  private mcp: GBrainMCPClient;

  constructor(config: GBrainClientConfig = {}) {
    this.rest = new GBrainRESTClient(config);
    this.mcp = new GBrainMCPClient(config);
  }

  get restClient(): GBrainRESTClient {
    return this.rest;
  }

  get mcpClient(): GBrainMCPClient {
    return this.mcp;
  }
}
