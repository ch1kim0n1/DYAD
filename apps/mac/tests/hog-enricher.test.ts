import { describe, it, expect, afterEach } from 'bun:test';
import { enrichWithHog, clearHogCache } from '../src/lib/hog-enricher.js';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; clearHogCache(); delete process.env.HOG_URL; });

describe('issue #45: HogEnricher', () => {
  it('returns null when HOG_URL is unset', async () => {
    delete process.env.HOG_URL;
    expect(await enrichWithHog('conv1')).toBeNull();
  });

  it('returns null when request fails', async () => {
    process.env.HOG_URL = 'https://hog.example';
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch;
    expect(await enrichWithHog('conv1')).toBeNull();
  });

  it('parses snake_case and camelCase shapes', async () => {
    process.env.HOG_URL = 'https://hog.example';
    globalThis.fetch = (async () => new Response(JSON.stringify({
      partnerSummary: 'works at acme, recently moved',
      recentEvents: ['job change'],
    }), { status: 200 })) as typeof fetch;
    const r = await enrichWithHog('convA');
    expect(r?.partner_summary).toContain('acme');
    expect(r?.recent_events).toEqual(['job change']);
  });

  it('caches subsequent calls within the TTL', async () => {
    process.env.HOG_URL = 'https://hog.example';
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ partner_summary: 's', recent_events: [] }), { status: 200 });
    }) as typeof fetch;
    await enrichWithHog('convB');
    await enrichWithHog('convB');
    expect(calls).toBe(1);
  });
});
