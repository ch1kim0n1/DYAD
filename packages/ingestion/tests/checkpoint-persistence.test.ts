import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CheckpointPersistence } from '../src/checkpoint-persistence.js';

const tmpDir = path.join(os.tmpdir(), 'dyad-test-' + Math.random().toString(36).slice(2));

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe('issue #11: CheckpointPersistence', () => {
  it('writes per-conversation file under storageDir', () => {
    const cp = new CheckpointPersistence({ storageDir: tmpDir, conversationId: 'convA' });
    cp.save({ lastSeenDate: 123, lastProcessedMessageId: 'x', checkpointTimestamp: 'now' });
    const expected = path.join(tmpDir, 'checkpoint-convA.json');
    expect(fs.existsSync(expected)).toBe(true);
  });

  it('round-trips data', () => {
    const cp = new CheckpointPersistence({ storageDir: tmpDir, conversationId: 'convB' });
    cp.save({ lastSeenDate: 42, lastProcessedMessageId: 'mid', checkpointTimestamp: 't' });
    const loaded = cp.load();
    expect(loaded?.lastSeenDate).toBe(42);
  });

  it('returns null when no checkpoint exists', () => {
    const cp = new CheckpointPersistence({ storageDir: tmpDir, conversationId: 'nope' });
    expect(cp.load()).toBeNull();
  });

  it('creates storage directory automatically', () => {
    const nested = path.join(tmpDir, 'deeply', 'nested');
    const cp = new CheckpointPersistence({ storageDir: nested });
    cp.save({ lastSeenDate: 1, lastProcessedMessageId: 'x', checkpointTimestamp: 't' });
    expect(fs.existsSync(nested)).toBe(true);
  });
});
