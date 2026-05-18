/**
 * Request Batching and Deduplication
 * 
 * Provides request batching to reduce API calls and deduplication
 * to avoid duplicate processing of identical requests.
 */

export interface BatchOptions {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  deduplicationWindowMs: number;
}

export interface BatchRequest<T, R> {
  id: string;
  request: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface DeduplicationKey {
  key: string;
  timestamp: number;
  result: any;
  error: Error | null;
}

export class RequestBatcher<T, R> {
  private batch: BatchRequest<T, R>[] = [];
  private processor: (requests: T[]) => Promise<R[]>;
  private options: BatchOptions;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    processor: (requests: T[]) => Promise<R[]>,
    options: Partial<BatchOptions> = {}
  ) {
    this.processor = processor;
    this.options = {
      maxBatchSize: options.maxBatchSize || 10,
      maxWaitTimeMs: options.maxWaitTimeMs || 100,
      deduplicationWindowMs: options.deduplicationWindowMs || 5000,
    };
  }

  async add(request: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      
      this.batch.push({
        id,
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Check if batch is full
      if (this.batch.length >= this.options.maxBatchSize) {
        this.processBatch();
      } else {
        this.scheduleBatch();
      }
    });
  }

  private scheduleBatch(): void {
    if (this.timer) {
      return; // Already scheduled
    }

    this.timer = setTimeout(() => {
      this.processBatch();
    }, this.options.maxWaitTimeMs);
  }

  private async processBatch(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const currentBatch = [...this.batch];
    this.batch = [];

    const requests = currentBatch.map(b => b.request);

    try {
      const results = await this.processor(requests);

      // Match results to requests
      for (let i = 0; i < currentBatch.length; i++) {
        const batchRequest = currentBatch[i];
        if (i < results.length) {
          batchRequest.resolve(results[i]);
        } else {
          batchRequest.reject(new Error('No result for request'));
        }
      }
    } catch (error) {
      for (const batchRequest of currentBatch) {
        batchRequest.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class RequestDeduplicator<T, R> {
  private pendingRequests: Map<string, Array<{ resolve: (result: R) => void; reject: (error: Error) => void }>> = new Map();
  private cache: Map<string, DeduplicationKey> = new Map();
  private processor: (request: T) => Promise<R>;
  private options: BatchOptions;

  constructor(
    processor: (request: T) => Promise<R>,
    options: Partial<BatchOptions> = {}
  ) {
    this.processor = processor;
    this.options = {
      maxBatchSize: options.maxBatchSize || 10,
      maxWaitTimeMs: options.maxWaitTimeMs || 100,
      deduplicationWindowMs: options.deduplicationWindowMs || 5000,
    };
  }

  async execute(request: T, key: string): Promise<R> {
    // Check cache for recent result
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.options.deduplicationWindowMs) {
      if (cached.error) {
        throw cached.error;
      }
      return cached.result;
    }

    // Check if request is pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    }

    // Execute new request
    this.pendingRequests.set(key, []);

    try {
      const result = await this.processor(request);
      
      // Cache result
      this.cache.set(key, {
        key,
        timestamp: Date.now(),
        result,
        error: null,
      });

      // Resolve all pending requests
      const pendingReqs = this.pendingRequests.get(key) || [];
      for (const { resolve } of pendingReqs) {
        resolve(result);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Cache error
      this.cache.set(key, {
        key,
        timestamp: Date.now(),
        result: null,
        error: err,
      });

      // Reject all pending requests
      const pendingReqs = this.pendingRequests.get(key) || [];
      for (const { reject } of pendingReqs) {
        reject(err);
      }

      throw err;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.deduplicationWindowMs) {
        this.cache.delete(key);
      }
    }
  }
}

// Combined batching and deduplication
export class OptimizedRequestHandler<T, R> {
  private batcher: RequestBatcher<T, R>;
  private deduplicator: RequestDeduplicator<T, R>;

  constructor(
    processor: (requests: T[]) => Promise<R[]>,
    singleProcessor: (request: T) => Promise<R>,
    options: Partial<BatchOptions> = {}
  ) {
    this.batcher = new RequestBatcher(processor, options);
    this.deduplicator = new RequestDeduplicator(singleProcessor, options);
  }

  async execute(request: T, key?: string): Promise<R> {
    if (key) {
      return this.deduplicator.execute(request, key);
    }
    return this.batcher.add(request);
  }

  invalidate(key: string): void {
    this.deduplicator.invalidate(key);
  }

  cleanup(): void {
    this.deduplicator.cleanup();
  }
}

// Request prioritization
export class PriorityQueue<T> {
  private queue: Array<{ item: T; priority: number; id: string }> = [];
  private nextId = 0;

  enqueue(item: T, priority: number = 0): string {
    const id = `${this.nextId++}`;
    this.queue.push({ item, priority, id });
    this.queue.sort((a, b) => b.priority - a.priority);
    return id;
  }

  dequeue(): T | undefined {
    return this.queue.shift()?.item;
  }

  peek(): T | undefined {
    return this.queue[0]?.item;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
}
