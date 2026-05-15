import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GStackClient } from '../src/lib/gstack-client.js';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe('issue #43: GStackClient', () => {
  it('is unconfigured when no URL / key present', () => {
    delete process.env.GSTACK_URL;
    delete process.env.GSTACK_API_KEY;
    const c = new GStackClient();
    expect(c.isConfigured()).toBe(false);
  });

  it('createOrResume returns null when unconfigured', async () => {
    const c = new GStackClient();
    expect(await c.createOrResume('dyad', 'conv1')).toBeNull();
  });

  it('persistModels is a no-op when unconfigured', async () => {
    const c = new GStackClient();
    await expect(c.persistModels({})).resolves.toBeUndefined();
  });

  it('createOrResume hits the configured endpoint and stores sessionId', async () => {
    let captured: { url: string; init: RequestInit | undefined } | null = null;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({
        session_id: 's-1', pipeline: 'dyad', conversation_id: 'conv1', created_at: 'now',
      }), { status: 200 });
    }) as typeof fetch;
    const c = new GStackClient({ baseUrl: 'https://gstack.example', apiKey: 'k' });
    const res = await c.createOrResume('dyad', 'conv1');
    expect(res?.session_id).toBe('s-1');
    expect(c.sessionId).toBe('s-1');
    expect(captured?.url).toBe('https://gstack.example/sessions/create-or-resume');
  });
});
