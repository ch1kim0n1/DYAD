/**
 * Request Batcher
 * 
 * Batches multiple API requests together to improve efficiency and reduce overhead.
 * Supports automatic batching with configurable batch size and timeout.
 */

export interface BatchRequest<T> {
  id: string;
  data: T;
  timestamp: number;
}

export interface BatchResult<T> {
  id: string;
  result?: T;
  error?: Error;
}

export interface BatcherConfig {
  batchSize: number; // Maximum number of requests per batch
  batchTimeoutMs: number; // Maximum time to wait before flushing batch
  maxRetries: number; // Maximum retry attempts
  retryDelayMs: number; // Delay between retries
}

export class RequestBatcher<T, R> {
  private config: BatcherConfig;
  private queue: BatchRequest<T>[];
  private processing: boolean;
  private batchProcessor: (requests: T[]) => Promise<R[]>;
  private pendingPromises: Map<string, { resolve: (value: R) => void; reject: (error: Error) => void }>;
  private timeoutId: ReturnType<typeof setTimeout> | null;

  constructor(
    batchProcessor: (requests: T[]) => Promise<R[]>,
    config: Partial<BatcherConfig> = {}
  ) {
    this.batchProcessor = batchProcessor;
    this.config = {
      batchSize: config.batchSize || 10,
      batchTimeoutMs: config.batchTimeoutMs || 100,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };
    this.queue = [];
    this.processing = false;
    this.pendingPromises = new Map();
    this.timeoutId = null;
  }

  /**
   * Add a request to the batch
   */
  async add(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const request: BatchRequest<T> = {
        id,
        data,
        timestamp: Date.now(),
      };

      this.queue.push(request);
      this.pendingPromises.set(id, { resolve, reject });

      // Check if we should flush the batch
      if (this.queue.length >= this.config.batchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.config.batchTimeoutMs);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Flush the current batch
   */
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.processing = true;
    const requests = this.queue.splice(0, this.config.batchSize);

    try {
      const results = await this.processBatchWithRetry(requests);
      this.resolveResults(results);
    } catch (error) {
      this.rejectAllRequests(error as Error);
    } finally {
      this.processing = false;

      // Check if more requests are queued
      if (this.queue.length > 0) {
        this.flush();
      }
    }
  }

  /**
   * Process batch with retry logic
   */
  private async processBatchWithRetry(requests: BatchRequest<T>[]): Promise<BatchResult<R>[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const data = requests.map(r => r.data);
        const results = await this.batchProcessor(data);

        return requests.map((request, index) => ({
          id: request.id,
          result: results[index],
        }));
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Batch processing failed');
  }

  /**
   * Resolve individual request promises
   */
  private resolveResults(results: BatchResult<R>[]): void {
    for (const result of results) {
      const pending = this.pendingPromises.get(result.id);
      if (pending) {
        if (result.result !== undefined) {
          pending.resolve(result.result);
        } else if (result.error) {
          pending.reject(result.error);
        }
        this.pendingPromises.delete(result.id);
      }
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllRequests(error: Error): void {
    for (const [id, pending] of this.pendingPromises.entries()) {
      pending.reject(error);
      this.pendingPromises.delete(id);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get batch statistics
   */
  getStats(): {
    queueSize: number;
    pendingPromises: number;
    processing: boolean;
  } {
    return {
      queueSize: this.queue.length,
      pendingPromises: this.pendingPromises.size,
      processing: this.processing,
    };
  }

  /**
   * Clear the queue and reject all pending requests
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.queue = [];
    this.rejectAllRequests(new Error('Batcher cleared'));
  }
}

/**
 * Specialized batcher for LLM API calls
 */
export interface LLMBatchRequest {
  id: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMBatchResponse {
  id: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
}

export class LLMBatcher extends RequestBatcher<LLMBatchRequest, LLMBatchResponse> {
  constructor(
    batchProcessor: (requests: LLMBatchRequest[]) => Promise<LLMBatchResponse[]>,
    config?: Partial<BatcherConfig>
  ) {
    super(batchProcessor, config);
  }
}

/**
 * Global batcher instances
 */
const globalBatchers: Map<string, RequestBatcher<any, any>> = new Map();

export function getBatcher<T, R>(
  name: string,
  batchProcessor: (requests: T[]) => Promise<R[]>,
  config?: Partial<BatcherConfig>
): RequestBatcher<T, R> {
  if (!globalBatchers.has(name)) {
    globalBatchers.set(name, new RequestBatcher(batchProcessor, config));
  }
  return globalBatchers.get(name) as RequestBatcher<T, R>;
}

export function removeBatcher(name: string): void {
  const batcher = globalBatchers.get(name);
  if (batcher) {
    batcher.clear();
    globalBatchers.delete(name);
  }
}

export function clearAllBatchers(): void {
  for (const [name, batcher] of globalBatchers.entries()) {
    batcher.clear();
  }
  globalBatchers.clear();
}
