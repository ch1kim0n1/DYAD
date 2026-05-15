import { describe, it, expect, afterEach } from 'bun:test';
import { pingSidecar, runAnalysis, requestBrief, requestReframe } from '../src/lib/gbrain-bridge.js';

const ORIGINAL_FETCH = globalThis.fetch;
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe('issue #42: gbrain-bridge sidecar client', () => {
  it('pingSidecar parses /status response', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      ok: true, pipeline_ready: true, brief_ready: false, reframe_ready: false, dyad_id: 'd',
    }), { status: 200 })) as typeof fetch;
    const r = await pingSidecar();
    expect(r?.ok).toBe(true);
  });

  it('pingSidecar returns null on transport error', async () => {
    globalThis.fetch = (async () => { throw new Error('down'); }) as typeof fetch;
    expect(await pingSidecar()).toBeNull();
  });

  it('runAnalysis posts to /analyze and returns the parsed result', async () => {
    let path = '';
    globalThis.fetch = (async (url: string | URL) => {
      path = new URL(String(url)).pathname;
      return new Response(JSON.stringify({ result_id: 'r' }), { status: 200 });
    }) as typeof fetch;
    const r = await runAnalysis([]);
    expect(path).toBe('/analyze');
    expect((r as { result_id?: string } | null)?.result_id).toBe('r');
  });

  it('requestBrief / requestReframe unwrap the inner field', async () => {
    globalThis.fetch = (async (url: string | URL) => {
      const p = new URL(String(url)).pathname;
      if (p === '/brief') return new Response(JSON.stringify({ brief: 'OK brief' }), { status: 200 });
      if (p === '/reframe') return new Response(JSON.stringify({ reframe: 'OK reframe' }), { status: 200 });
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    expect(await requestBrief('bid_asymmetry', {} as never, [])).toBe('OK brief');
    expect(await requestReframe('bid_asymmetry', {} as never, 'b', [])).toBe('OK reframe');
  });
});
