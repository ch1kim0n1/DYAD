import { DriftDetector, createDriftDetector, MetricSnapshot } from '../src/core/drift-detector';

/**
 * The DriftDetector splits snapshots into baseline (older than baseline_period_ms)
 * and current (within baseline_period_ms). We inject snapshots with synthetic
 * timestamps to test all code paths deterministically.
 */

function pastMs(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EIGHT_DAYS_MS = 8 * ONE_DAY_MS; // outside the 7-day baseline window

describe('DriftDetector', () => {
  let detector: DriftDetector;

  beforeEach(() => {
    detector = createDriftDetector({
      window_size: 200,
      drift_threshold: 0.2,
      alert_threshold: 0.3,
      baseline_period_ms: 7 * ONE_DAY_MS,
    });
  });

  describe('recordSnapshot', () => {
    it('stores recorded values and reflects them in getMetricStats', () => {
      detector.recordSnapshot('latency', 100);
      detector.recordSnapshot('latency', 200);
      detector.recordSnapshot('latency', 300);

      const stats = detector.getMetricStats('latency');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(3);
      expect(stats!.mean).toBeCloseTo(200);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(300);
    });

    it('returns null stats for unknown metric', () => {
      expect(detector.getMetricStats('unknown')).toBeNull();
    });
  });

  describe('drift detection with backdated timestamps', () => {
    /**
     * Inject baseline snapshots (>7 days ago) with high values, then current
     * snapshots with a very different mean to trigger drift detection.
     */
    function injectSnapshots(metricName: string): void {
      // 10 baseline points ~8 days ago, mean ~0.8
      for (let i = 0; i < 10; i++) {
        const snapshot: MetricSnapshot = {
          timestamp: pastMs(EIGHT_DAYS_MS + i * 1000),
          metric_name: metricName,
          value: 0.8 + (i % 3) * 0.01,
        };
        // Access internal map via recordSnapshot, but we need to set timestamps.
        // DriftDetector has no API to inject timestamps, so we call recordSnapshot
        // and then overwrite the timestamp on the stored object via getMetricNames
        // + internal access — instead, we extend via a thin subclass approach.
        // Simpler: record now and mutate the snapshot array via getMetricStats
        // reflection. But the class stores private snapshots. Use a workaround:
        // cast to any to reach the private field.
        (detector as any).snapshots.get(metricName)?.push(snapshot) ??
          (() => {
            (detector as any).snapshots.set(metricName, [snapshot]);
          })();
      }

      // 10 current points (within last day), mean ~0.1 — big drop
      for (let i = 0; i < 10; i++) {
        const snapshot: MetricSnapshot = {
          timestamp: pastMs(ONE_DAY_MS - i * 1000),
          metric_name: metricName,
          value: 0.1 + (i % 3) * 0.01,
        };
        (detector as any).snapshots.get(metricName)!.push(snapshot);
      }
    }

    it('detects drift when baseline and current means diverge significantly', () => {
      injectSnapshots('quality_score');

      const result = detector.detectDrift('quality_score');
      expect(result).not.toBeNull();
      expect(result!.drift_detected).toBe(true);
      expect(result!.drift_magnitude).toBeGreaterThan(0.2);
      expect(result!.trend).toBe('degrading'); // current mean < baseline mean
    });

    it('no drift when all values are in the current window and mean is stable', () => {
      // Only current snapshots, no baseline older than 7 days → detectDrift returns null
      // (needs baseline.length >= 5)
      for (let i = 0; i < 20; i++) {
        detector.recordSnapshot('stable_metric', 0.9 + (i % 2) * 0.01);
      }
      // Without old-enough baseline points, result is null (not enough data)
      const result = detector.detectDrift('stable_metric');
      expect(result).toBeNull();
    });

    it('returns degrading trend when current mean is lower than baseline', () => {
      injectSnapshots('throughput');
      const result = detector.detectDrift('throughput');
      expect(result!.trend).toBe('degrading');
    });

    it('returns improving trend when current mean is higher than baseline', () => {
      const metricName = 'error_rate';
      // 10 baseline points ~8 days ago, mean ~0.8 (high errors)
      for (let i = 0; i < 10; i++) {
        (detector as any).snapshots.set(metricName, [
          ...((detector as any).snapshots.get(metricName) ?? []),
          {
            timestamp: pastMs(EIGHT_DAYS_MS + i * 1000),
            metric_name: metricName,
            value: 0.1 + (i % 3) * 0.01,
          },
        ]);
      }
      // 10 current points, mean ~0.8 (improved)
      for (let i = 0; i < 10; i++) {
        (detector as any).snapshots.get(metricName)!.push({
          timestamp: pastMs(ONE_DAY_MS - i * 1000),
          metric_name: metricName,
          value: 0.9 + (i % 3) * 0.01,
        });
      }
      const result = detector.detectDrift(metricName);
      expect(result!.trend).toBe('improving');
    });
  });

  describe('window behavior', () => {
    it('enforces window_size by discarding oldest snapshots', () => {
      const small = createDriftDetector({ window_size: 5 });
      for (let i = 0; i < 10; i++) {
        small.recordSnapshot('metric', i);
      }
      const stats = small.getMetricStats('metric');
      expect(stats!.count).toBe(5);
      // Should contain only the last 5 values (5–9)
      expect(stats!.min).toBe(5);
      expect(stats!.max).toBe(9);
    });
  });

  describe('detectAllDrift and getAlerts', () => {
    it('returns empty array when no metrics are recorded', () => {
      expect(detector.detectAllDrift()).toEqual([]);
      expect(detector.getAlerts()).toEqual([]);
    });

    it('returns null for a metric with fewer than 10 snapshots', () => {
      for (let i = 0; i < 9; i++) {
        detector.recordSnapshot('sparse', i);
      }
      expect(detector.detectDrift('sparse')).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears all stored snapshots', () => {
      detector.recordSnapshot('m', 1);
      detector.reset();
      expect(detector.getMetricNames()).toHaveLength(0);
      expect(detector.getMetricStats('m')).toBeNull();
    });
  });
});
