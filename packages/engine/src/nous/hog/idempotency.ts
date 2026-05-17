/**
 * NOUS semantic idempotency keys.
 *
 * Hog operations are content-addressed so the same logical query — regardless
 * of when it's submitted — collapses to the same operation. Two effects:
 *   1. Within a single dyad: identical queries within the time bucket
 *      reuse the previous result without burning credits.
 *   2. Across the fleet (post-deploy): when two users have an overlapping
 *      partner identity, their queries share an idempotency key and Hog
 *      serves the same operation_id to both. Cost amortises down with scale.
 *
 * Key = sha256( capability || canonicalJson(payload) || dyad_id_salt || temporal_bucket )
 *
 * `temporal_bucket` is hours-since-epoch / `bucketHours`. Within a bucket,
 * the key is stable. Cross-bucket queries get fresh keys.
 *
 * No external deps. Uses node:crypto subtle when available, otherwise
 * a streaming SHA-256.
 */
import { createHash } from 'node:crypto';

export interface IdempotencyOptions {
  /** Temporal bucket width in hours. Default 6 hours. */
  bucketHours?: number;
  /** Per-dyad salt — `dyad_id` or any stable identifier. */
  dyadIdSalt?: string;
  /** Override now() for tests. */
  now?: () => number;
}

const DEFAULT_BUCKET_HOURS = 6;

/** Canonical JSON: stable key ordering for deterministic hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return 'null';
}

/** Returns the integer bucket index (hours / bucketHours) for a given time. */
export function temporalBucket(now: number, bucketHours = DEFAULT_BUCKET_HOURS): number {
  return Math.floor(now / (bucketHours * 3_600_000));
}

/**
 * Compute the semantic idempotency key for a Hog operation.
 *
 *   capability   — 'deep_research' | 'people_research' | ...
 *   payload      — request body
 *   options      — bucket width + dyad salt + clock injection
 */
export function idempotencyKey(
  capability: string,
  payload: unknown,
  options: IdempotencyOptions = {},
): string {
  const now = options.now ? options.now() : Date.now();
  const bucket = temporalBucket(now, options.bucketHours ?? DEFAULT_BUCKET_HOURS);
  const salt = options.dyadIdSalt ?? '';
  const material = `${capability}|${canonicalJson(payload)}|${salt}|${bucket}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

/**
 * In-memory cache with TTL eviction, keyed by idempotency key.
 *
 * Used by HogClient to avoid re-issuing operations whose semantic key
 * matches a recent call. NOT a substitute for Hog-side idempotency —
 * Hog will dedup on its end if we pass `Idempotency-Key` header.
 *
 * The local cache is opportunistic: it lets us skip the round-trip
 * entirely on a hit.
 */
export class IdempotencyCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly ttlMs: number = 24 * 60 * 60 * 1000) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) { this.misses += 1; return undefined; }
    if (entry.expiresAt < now) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Telemetry for AuditDrawer. */
  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.store.size };
  }
}
