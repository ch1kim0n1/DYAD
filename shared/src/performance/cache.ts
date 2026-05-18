/**
 * Caching Strategies
 * 
 * Provides multi-tier caching with TTL, LRU eviction,
 * and cache warming for frequently accessed data.
 */

export interface CacheOptions {
  ttl?: number;           // Time to live in milliseconds
  maxSize?: number;       // Maximum number of entries
  maxSizeBytes?: number;  // Maximum size in bytes
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
  hits: number;
  lastAccessed: number;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxSizeBytes = options.maxSizeBytes || 100 * 1024 * 1024; // 100MB
    this.defaultTtl = options.ttl || 5 * 60 * 1000; // 5 minutes
  }

  set(key: string, value: T, ttl?: number): void {
    const size = this.calculateSize(value);
    const now = Date.now();

    // Evict if necessary
    this.evictIfNeeded(size);

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttl || this.defaultTtl),
      size,
      hits: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.currentSizeBytes += size;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();

    // Check expiration
    if (now > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = now;

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSizeBytes -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private evictIfNeeded(neededSize: number): void {
    // Evict expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
      }
    }

    // Evict LRU if still over size limits
    while (
      (this.cache.size >= this.maxSize || this.currentSizeBytes + neededSize > this.maxSizeBytes) &&
      this.cache.size > 0
    ) {
      let lruKey: string | null = null;
      let lruTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.delete(lruKey);
      }
    }
  }

  private calculateSize(value: T): number {
    // Approximate size calculation
    const str = JSON.stringify(value);
    return str.length * 2; // UTF-16 encoding
  }

  getStats(): { size: number; hits: number; totalHits: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      hits: this.cache.size > 0 ? Math.floor(totalHits / this.cache.size) : 0,
      totalHits,
      hitRate: this.cache.size > 0 ? totalHits / (totalHits + this.cache.size) : 0,
    };
  }
}

// Multi-level cache with memory and disk tiers
export class MultiLevelCache<T> {
  private l1Cache: Cache<T>;  // Memory cache
  private l2Cache: Cache<T> | null;  // Optional disk cache
  private l1Ttl: number;
  private l2Ttl: number;

  constructor(options: {
    l1Size?: number;
    l1Ttl?: number;
    l2Size?: number;
    l2Ttl?: number;
  } = {}) {
    this.l1Cache = new Cache<T>({
      maxSize: options.l1Size || 100,
      ttl: options.l1Ttl || 60 * 1000, // 1 minute
    });

    this.l2Cache = options.l2Size
      ? new Cache<T>({
          maxSize: options.l2Size || 10000,
          ttl: options.l2Ttl || 10 * 60 * 1000, // 10 minutes
        })
      : null;

    this.l1Ttl = options.l1Ttl || 60 * 1000;
    this.l2Ttl = options.l2Ttl || 10 * 60 * 1000;
  }

  async get(key: string): Promise<T | undefined> {
    // Try L1 first
    const l1Value = this.l1Cache.get(key);
    if (l1Value !== undefined) {
      return l1Value;
    }

    // Try L2
    if (this.l2Cache) {
      const l2Value = this.l2Cache.get(key);
      if (l2Value !== undefined) {
        // Promote to L1
        this.l1Cache.set(key, l2Value, this.l1Ttl);
        return l2Value;
      }
    }

    return undefined;
  }

  async set(key: string, value: T): Promise<void> {
    this.l1Cache.set(key, value, this.l1Ttl);
    if (this.l2Cache) {
      this.l2Cache.set(key, value, this.l2Ttl);
    }
  }

  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    if (this.l2Cache) {
      this.l2Cache.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.l1Cache.clear();
    if (this.l2Cache) {
      this.l2Cache.clear();
    }
  }

  getStats(): {
    l1: ReturnType<Cache<T>['getStats']>;
    l2: ReturnType<Cache<T>['getStats']> | null;
  } {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache ? this.l2Cache.getStats() : null,
    };
  }
}

// Cache warming utility
export async function warmCache<T>(
  cache: Cache<T>,
  keys: string[],
  loader: (key: string) => Promise<T>
): Promise<void> {
  const batchSize = 10;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (key) => {
        try {
          const value = await loader(key);
          cache.set(key, value);
        } catch (error) {
          console.warn(`Failed to warm cache for key ${key}:`, error);
        }
      })
    );
  }
}

// Cache invalidation utility
export class CacheInvalidator {
  private patterns: Map<string, RegExp[]> = new Map();

  addPattern(namespace: string, pattern: RegExp): void {
    if (!this.patterns.has(namespace)) {
      this.patterns.set(namespace, []);
    }
    this.patterns.get(namespace)!.push(pattern);
  }

  invalidate(cache: Cache<any>, namespace: string, key: string): void {
    const patterns = this.patterns.get(namespace);
    if (!patterns) {
      return;
    }

    for (const pattern of patterns) {
      if (pattern.test(key)) {
        cache.delete(key);
      }
    }
  }

  invalidateAll(cache: Cache<any>, namespace: string): void {
    const patterns = this.patterns.get(namespace);
    if (!patterns) {
      return;
    }

    for (const key of Array.from((cache as any).cache.keys())) {
      for (const pattern of patterns) {
        if (pattern.test(String(key))) {
          cache.delete(String(key));
          break;
        }
      }
    }
  }
}
