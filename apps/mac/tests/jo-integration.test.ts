import { describe, it, expect, afterEach } from 'bun:test';
import { getJoContext, clearJoCache, formatJoForPrompt } from '../src/lib/jo-integration.js';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; clearJoCache(); delete process.env.JO_URL; });

describe('issue #46: Jo integration', () => {
  it('returns null when JO_URL is unset', async () => {
    delete process.env.JO_URL;
    expect(await getJoContext()).toBeNull();
  });

  it('caches subsequent calls within the TTL', async () => {
    process.env.JO_URL = 'https://jo.example';
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({
        recent_calendar_summary: 'busy week',
        mood_indicators: ['tired'],
      }), { status: 200 });
    }) as typeof fetch;
    const a = await getJoContext();
    const b = await getJoContext();
    expect(a?.recent_calendar_summary).toBe('busy week');
    expect(b?.recent_calendar_summary).toBe('busy week');
    expect(calls).toBe(1);
  });

  it('formats prompt-ready string', () => {
    expect(formatJoForPrompt(null)).toBe('');
    expect(formatJoForPrompt({
      recent_calendar_summary: 'busy week',
      mood_indicators: ['tired', 'excited'],
      contextualized_at: 0,
    })).toContain('busy week');
  });

  it('falls back gracefully on fetch error', async () => {
    process.env.JO_URL = 'https://jo.example';
    globalThis.fetch = (async () => { throw new Error('net down'); }) as typeof fetch;
    expect(await getJoContext()).toBeNull();
  });
});
