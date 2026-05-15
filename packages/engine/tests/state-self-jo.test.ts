import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SelfModelUpdater } from '../src/state/self-model-updater.js';

const tmp = path.join(os.tmpdir(), 'dyad-jo-' + Math.random().toString(36).slice(2));
beforeEach(() => { fs.mkdirSync(tmp, { recursive: true }); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

describe('issue #46: SelfModel.jo_context', () => {
  it('setJoContext attaches Jo summary to the model', () => {
    const u = new SelfModelUpdater('u1', tmp);
    u.setJoContext({
      recent_calendar_summary: 'high-stress week: 3 presentations',
      mood_indicators: ['tired', 'focused'],
      contextualized_at: Date.now(),
    });
    const m = u.getModel();
    expect(m.jo_context?.recent_calendar_summary).toContain('high-stress');
    expect(m.jo_context?.mood_indicators).toContain('tired');
  });

  it('setJoContext(null) clears the context', () => {
    const u = new SelfModelUpdater('u1', tmp);
    u.setJoContext({ recent_calendar_summary: 'x', mood_indicators: [], contextualized_at: 0 });
    u.setJoContext(null);
    expect(u.getModel().jo_context).toBeNull();
  });

  it('jo_context survives save+reload round-trip', () => {
    const u = new SelfModelUpdater('u1', tmp);
    u.setJoContext({ recent_calendar_summary: 'finals week', mood_indicators: ['anxious'], contextualized_at: 1234 });
    u.save();
    const u2 = new SelfModelUpdater('u1', tmp);
    expect(u2.getModel().jo_context?.recent_calendar_summary).toBe('finals week');
  });
});
