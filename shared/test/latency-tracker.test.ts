import { LatencyTracker } from '../src/core/latency-tracker';

describe('LatencyTracker', () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  it('record() adds to history (count increases)', () => {
    tracker.record(100);
    expect(tracker.getCount()).toBe(1);
    tracker.record(200);
    expect(tracker.getCount()).toBe(2);
  });

  it('getMetrics() p50_ms returns approximate median', () => {
    // 1, 2, 3, 4, 5 — median is 3
    [1, 2, 3, 4, 5].forEach(v => tracker.record(v));
    const metrics = tracker.getMetrics();
    expect(metrics.p50_ms).toBe(3);
  });

  it('getMetrics() p95_ms returns approximate 95th percentile', () => {
    // 100 values 1-100, p95 ≈ 95
    for (let i = 1; i <= 100; i++) tracker.record(i);
    const metrics = tracker.getMetrics();
    expect(metrics.p95_ms).toBeGreaterThanOrEqual(94);
    expect(metrics.p95_ms).toBeLessThanOrEqual(96);
  });

  it('getMetrics() returns count, min, max, avg, p50, p95, p99', () => {
    [10, 20, 30].forEach(v => tracker.record(v));
    const metrics = tracker.getMetrics();
    expect(metrics.count).toBe(3);
    expect(metrics.min_ms).toBe(10);
    expect(metrics.max_ms).toBe(30);
    expect(metrics.avg_ms).toBeCloseTo(20);
    expect(typeof metrics.p50_ms).toBe('number');
    expect(typeof metrics.p95_ms).toBe('number');
    expect(typeof metrics.p99_ms).toBe('number');
  });

  it('reset() clears history', () => {
    tracker.record(50);
    tracker.record(100);
    tracker.reset();
    expect(tracker.getCount()).toBe(0);
  });

  it('getMetrics() returns all zeros after reset', () => {
    tracker.record(100);
    tracker.reset();
    const metrics = tracker.getMetrics();
    expect(metrics.count).toBe(0);
    expect(metrics.avg_ms).toBe(0);
    expect(metrics.p50_ms).toBe(0);
  });

  it('handles single entry correctly', () => {
    tracker.record(42);
    const metrics = tracker.getMetrics();
    expect(metrics.count).toBe(1);
    expect(metrics.min_ms).toBe(42);
    expect(metrics.max_ms).toBe(42);
    expect(metrics.avg_ms).toBe(42);
    expect(metrics.p50_ms).toBe(42);
  });

  it('handles empty history gracefully (returns zeros)', () => {
    const metrics = tracker.getMetrics();
    expect(metrics.count).toBe(0);
    expect(metrics.min_ms).toBe(0);
    expect(metrics.max_ms).toBe(0);
    expect(metrics.avg_ms).toBe(0);
    expect(metrics.p50_ms).toBe(0);
    expect(metrics.p95_ms).toBe(0);
  });

  it('tracks multiple operations and enforces maxMeasurements window', () => {
    const small = new LatencyTracker(5);
    for (let i = 1; i <= 10; i++) small.record(i * 10);
    // Should only retain last 5: 60, 70, 80, 90, 100
    expect(small.getCount()).toBe(5);
    const metrics = small.getMetrics();
    expect(metrics.min_ms).toBe(60);
    expect(metrics.max_ms).toBe(100);
  });
});
