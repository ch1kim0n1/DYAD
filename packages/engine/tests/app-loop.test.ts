import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { startAppLoop } from '../src/app-loop.js';
import type { NormalizedMessage } from '@dyad/shared';

const tmp = path.join(os.tmpdir(), 'dyad-loop-' + Math.random().toString(36).slice(2));
beforeEach(() => fs.mkdirSync(tmp, { recursive: true }));
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

function msg(id: string, isFromMe: boolean, text: string, atMs: number): NormalizedMessage {
  return {
    message_id: id,
    participant_id: isFromMe ? 'self' : 'partner',
    is_from_me: isFromMe,
    text,
    timestamp: new Date(atMs).toISOString(),
    chat_id: 'loop-test',
  };
}

describe('issue #104: startAppLoop', () => {
  it('returns null when called with an empty batch', async () => {
    const loop = startAppLoop({
      conversationId: 'c1', storageDir: tmp, apiKey: 'fake',
    });
    expect(await loop.process([])).toBeNull();
    expect(loop.getModels()).toBeNull();
  });

  it('surfaces extraction failure through onError without throwing', async () => {
    let captured: Error | null = null;
    const loop = startAppLoop({
      conversationId: 'c1', storageDir: tmp, apiKey: 'fake',
      onError: (err) => { captured = err; },
    });
    // Real LlmExtractor will 401 with the fake key — the loop should
    // catch and report via onError, not throw.
    const t = Date.now();
    const result = await loop.process([msg('m1', true, 'hi', t)]);
    expect(result).toBeNull();
    expect(captured).not.toBeNull();
  });

  it('exposes the lifecycle handle shape from the spec', () => {
    const loop = startAppLoop({
      conversationId: 'c1', storageDir: tmp, apiKey: 'fake',
    });
    expect(typeof loop.process).toBe('function');
    expect(typeof loop.stop).toBe('function');
    expect(typeof loop.getModels).toBe('function');
    // stop() should be safe to call even before any process() call
    expect(() => loop.stop()).not.toThrow();
  });
});
