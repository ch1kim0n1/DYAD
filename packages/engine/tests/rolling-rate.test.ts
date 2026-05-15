import { describe, it, expect } from 'bun:test';
import { RollingRate } from '../src/rolling-rate.js';

describe('issue #18: RollingRate', () => {
  it('returns 0 with no events', () => {
    expect(new RollingRate(5).getCurrentRate()).toBe(0);
  });

  it('counts recent events', () => {
    const rr = new RollingRate(5);
    const now = Date.now();
    rr.addEvent(now);
    rr.addEvent(now);
    rr.addEvent(now);
    expect(rr.getCurrentRate(now)).toBe(3 / 5);
  });

  it('drops events older than window', () => {
    const rr = new RollingRate(1);
    const now = Date.now();
    rr.addEvent(now - 5 * 60_000); // 5 minutes ago, outside 1-min window
    rr.addEvent(now);
    expect(rr.getEventCount(now)).toBe(1);
  });

  it('getRateAt computes window ending at a timestamp', () => {
    const rr = new RollingRate(1);
    const t = Date.now();
    rr.addEvent(t - 30_000);
    rr.addEvent(t);
    expect(rr.getRateAt(t)).toBe(2);
  });
});
