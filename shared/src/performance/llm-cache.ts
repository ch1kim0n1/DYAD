/**
 * LLM Response Cache
 * 
 * Caches LLM responses to reduce costs and improve performance.
 * Supports memory cache with optional persistence to disk.
 */

import * as crypto from 'crypto';

export interface CacheEntry {
  key: string;
  prompt: string;
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
  ttl: number; // Time to live in milliseconds
}

export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  ttl: number; // Default TTL in milliseconds
  persistToDisk?: boolean; // Persist cache to disk
  cachePath?: string; // Path to cache file
}

export class LLMCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private accessOrder: string[]; // For LRU eviction

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 3600000, // 1 hour default
      persistToDisk: config.persistToDisk || false,
      cachePath: config.cachePath || '.gstack/llm-cache.json',
    };
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Generate cache key from prompt and model
   */
  private generateKey(prompt: string, model: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${model}:${prompt}`)
      .digest('hex');
    return hash;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();
    return (now - entryTime) > entry.ttl;
  }

  /**
   * Evict expired entries
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
      }
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.accessOrder.shift();
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Get a cached response
   */
  get(prompt: string, model: string): CacheEntry | null {
    this.evictExpired();
    
    const key = this.generateKey(prompt, model);
    const entry = this.cache.get(key);
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
      }
      return null;
    }
    
    this.updateAccessOrder(key);
    return entry;
  }

  /**
   * Set a cached response
   */
  set(
    prompt: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    ttl?: number
  ): void {
    this.evictExpired();
    
    // Evict if at max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    const key = this.generateKey(prompt, model);
    const entry: CacheEntry = {
      key,
      prompt,
      response,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      timestamp: new Date().toISOString(),
      ttl: ttl || this.config.ttl,
    };
    
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Check if a response is cached
   */
  has(prompt: string, model: string): boolean {
    const key = this.generateKey(prompt, model);
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(prompt: string, model: string): void {
    const key = this.generateKey(prompt, model);
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalRequests: number;
    totalHits: number;
    totalSavedCost: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.hitRate,
      totalRequests: this.totalRequests,
      totalHits: this.totalHits,
      totalSavedCost: this.totalSavedCost,
    };
  }

  private hitRate: number = 0;
  private totalRequests: number = 0;
  private totalHits: number = 0;
  private totalSavedCost: number = 0;

  /**
   * Record a cache hit
   */
  recordHit(savedCost: number): void {
    this.totalRequests++;
    this.totalHits++;
    this.totalSavedCost += savedCost;
    this.hitRate = this.totalHits / this.totalRequests;
  }

  /**
   * Record a cache miss
   */
  recordMiss(): void {
    this.totalRequests++;
    this.hitRate = this.totalHits / this.totalRequests;
  }

  /**
   * Get all cache entries
   */
  getAll(): CacheEntry[] {
    this.evictExpired();
    return Array.from(this.cache.values());
  }

  /**
   * Get cache entries by model
   */
  getByModel(model: string): CacheEntry[] {
    this.evictExpired();
    return Array.from(this.cache.values()).filter(entry => entry.model === model);
  }

  /**
   * Get cache size in bytes (estimated)
   */
  getEstimatedSize(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += entry.prompt.length * 2; // UTF-16
      size += entry.response.length * 2;
      size += 100; // Metadata overhead
    }
    return size;
  }
}

/**
 * Global LLM cache instance
 */
let globalLLMCache: LLMCache | null = null;

export function getLLMCache(config?: Partial<CacheConfig>): LLMCache {
  if (!globalLLMCache) {
    globalLLMCache = new LLMCache(config);
  }
  return globalLLMCache;
}

export function resetLLMCache(): void {
  globalLLMCache = null;
}
