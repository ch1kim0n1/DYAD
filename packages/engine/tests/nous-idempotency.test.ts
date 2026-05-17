import { describe, it, expect } from 'bun:test';
import {
  canonicalJson,
  temporalBucket,
  idempotencyKey,
  IdempotencyCache,
} from '../src/nous/hog/idempotency';

describe('canonicalJson', () => {
  it('sorts object keys deterministically', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: { z: 1, b: 2 } })).toBe('{"a":{"b":2,"z":1}}');
  });

  it('preserves array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('s')).toBe('"s"');
    expect(canonicalJson(42)).toBe('42');
  });
});

describe('temporalBucket', () => {
  it('floors to bucket index', () => {
    const hours6Ms = 6 * 3_600_000;
    expect(temporalBucket(0)).toBe(0);
    expect(temporalBucket(hours6Ms - 1)).toBe(0);
    expect(temporalBucket(hours6Ms)).toBe(1);
    expect(temporalBucket(hours6Ms * 2)).toBe(2);
  });

  it('respects custom bucketHours', () => {
    const hours1Ms = 3_600_000;
    expect(temporalBucket(hours1Ms - 1, 1)).toBe(0);
    expect(temporalBucket(hours1Ms, 1)).toBe(1);
  });
});

describe('idempotencyKey', () => {
  const nowA = new Date('2026-05-16T01:00:00Z').getTime();
  const nowB = new Date('2026-05-16T05:00:00Z').getTime();   // same 6h bucket
  const nowC = new Date('2026-05-16T07:00:00Z').getTime();   // next 6h bucket

  it('is stable within the temporal bucket for identical inputs', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA });
    const b = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowB });
    expect(a).toBe(b);
  });

  it('changes across temporal buckets', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA });
    const c = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowC });
    expect(a).not.toBe(c);
  });

  it('changes when payload changes', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA });
    const b = idempotencyKey('deep_research', { prompt: 'Y' }, { now: () => nowA });
    expect(a).not.toBe(b);
  });

  it('changes when capability changes', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA });
    const b = idempotencyKey('people_research', { prompt: 'X' }, { now: () => nowA });
    expect(a).not.toBe(b);
  });

  it('changes when dyad salt changes (cross-dyad isolation)', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA, dyadIdSalt: 'dyad-1' });
    const b = idempotencyKey('deep_research', { prompt: 'X' }, { now: () => nowA, dyadIdSalt: 'dyad-2' });
    expect(a).not.toBe(b);
  });

  it('produces 32-char keys', () => {
    expect(idempotencyKey('x', {}, { now: () => 0 })).toHaveLength(32);
  });

  it('is invariant under key-order permutation in payload', () => {
    const a = idempotencyKey('deep_research', { prompt: 'X', urls: ['u'] }, { now: () => nowA });
    const b = idempotencyKey('deep_research', { urls: ['u'], prompt: 'X' }, { now: () => nowA });
    expect(a).toBe(b);
  });
});

describe('IdempotencyCache', () => {
  it('caches values with TTL', () => {
    const cache = new IdempotencyCache<string>(1000);
    cache.set('k', 'v', 0);
    expect(cache.get('k', 500)).toBe('v');
    expect(cache.get('k', 1001)).toBeUndefined();
  });

  it('counts hits and misses', () => {
    const cache = new IdempotencyCache<number>();
    cache.set('a', 1);
    cache.get('a');     // hit
    cache.get('a');     // hit
    cache.get('b');     // miss
    const s = cache.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.size).toBe(1);
  });

  it('clear() resets state', () => {
    const cache = new IdempotencyCache<number>();
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.stats().size).toBe(0);
  });
});
