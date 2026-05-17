/**
 * Latency Tracker for P50/P95/P99 Metrics
 * 
 * Provides:
 * - Latency measurement with percentile calculation
 * - Rolling window of recent measurements
 * - P50, P95, P99 percentile calculation
 */

export interface LatencyMetrics {
  count: number;
  min_ms: number;
  max_ms: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export class LatencyTracker {
  private measurements: number[] = [];
  private maxMeasurements: number;

  constructor(maxMeasurements = 1000) {
    this.maxMeasurements = maxMeasurements;
  }

  /**
   * Record a latency measurement
   */
  record(latencyMs: number): void {
    this.measurements.push(latencyMs);
    
    // Keep only the most recent measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentile(percentile: number): number {
    if (this.measurements.length === 0) return 0;
    
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current metrics
   */
  getMetrics(): LatencyMetrics {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        min_ms: 0,
        max_ms: 0,
        avg_ms: 0,
        p50_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
      };
    }

    const min = Math.min(...this.measurements);
    const max = Math.max(...this.measurements);
    const avg = this.measurements.reduce((sum, val) => sum + val, 0) / this.measurements.length;

    return {
      count: this.measurements.length,
      min_ms: min,
      max_ms: max,
      avg_ms: avg,
      p50_ms: this.calculatePercentile(50),
      p95_ms: this.calculatePercentile(95),
      p99_ms: this.calculatePercentile(99),
    };
  }

  /**
   * Reset measurements
   */
  reset(): void {
    this.measurements = [];
  }

  /**
   * Get measurement count
   */
  getCount(): number {
    return this.measurements.length;
  }
}

/**
 * Decorator to track latency for async methods
 */
export function trackLatency(tracker: LatencyTracker) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const latency = Date.now() - start;
        tracker.record(latency);
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        tracker.record(latency);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to track latency for sync methods
 */
export function trackLatencySync(tracker: LatencyTracker) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const start = Date.now();
      try {
        const result = originalMethod.apply(this, args);
        const latency = Date.now() - start;
        tracker.record(latency);
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        tracker.record(latency);
        throw error;
      }
    };

    return descriptor;
  };
}
