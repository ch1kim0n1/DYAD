import { describe, it, expect, afterEach } from 'bun:test';
import { loadMessages } from '../src/lib/gbrain-bridge.js';

const ORIGINAL_FETCH = globalThis.fetch;
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

describe('gbrain-bridge.loadMessages (#42 wiring)', () => {
  it('returns the parsed messages array', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      messages: [{ message_id: 'm1', participant_id: 'me', is_from_me: true, text: 'hi', timestamp: new Date().toISOString(), chat_id: 'c' }],
    }), { status: 200 })) as typeof fetch;
    const r = await loadMessages();
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe('hi');
  });

  it('returns empty array on transport error', async () => {
    globalThis.fetch = (async () => { throw new Error('down'); }) as typeof fetch;
    const r = await loadMessages();
    expect(r.messages).toEqual([]);
  });

  it('forwards chatId + since in the request body', async () => {
    let captured: { chatId?: string; since?: number } | null = null;
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      captured = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    }) as typeof fetch;
    await loadMessages('chat-1', 12345);
    expect(captured?.chatId).toBe('chat-1');
    expect(captured?.since).toBe(12345);
  });

  it('passes through error field from sidecar', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      messages: [], error: 'chat.db unreadable',
    }), { status: 200 })) as typeof fetch;
    const r = await loadMessages();
    expect(r.error).toBe('chat.db unreadable');
  });
});
