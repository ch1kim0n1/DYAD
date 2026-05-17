/**
 * Persistence-Backed Drift Detection
 * 
 * Provides:
 * - Performance drift detection using historical data
 * - Statistical analysis of metric changes over time
 * - Alerting when drift exceeds thresholds
 * - Persistence of historical metrics for analysis
 */

export interface MetricSnapshot {
  timestamp: string;
  metric_name: string;
  value: number;
  context?: Record<string, any>;
}

export interface DriftDetectionConfig {
  window_size?: number;
  drift_threshold?: number;
  alert_threshold?: number;
  baseline_period_ms?: number;
}

export interface DriftResult {
  metric_name: string;
  drift_detected: boolean;
  drift_magnitude: number;
  baseline_mean: number;
  current_mean: number;
  baseline_stddev: number;
  current_stddev: number;
  trend: 'improving' | 'degrading' | 'stable';
  confidence: number;
}

export class DriftDetector {
  private config: DriftDetectionConfig;
  private snapshots: Map<string, MetricSnapshot[]>; // metric_name -> snapshots

  constructor(config: DriftDetectionConfig) {
    this.config = {
      window_size: 100,
      drift_threshold: 0.2,
      alert_threshold: 0.3,
      baseline_period_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config,
    };
    this.snapshots = new Map();
  }

  /**
   * Record a metric snapshot
   */
  recordSnapshot(metric_name: string, value: number, context?: Record<string, any>): void {
    const snapshot: MetricSnapshot = {
      timestamp: new Date().toISOString(),
      metric_name,
      value,
      context,
    };

    if (!this.snapshots.has(metric_name)) {
      this.snapshots.set(metric_name, []);
    }

    const snapshots = this.snapshots.get(metric_name)!;
    snapshots.push(snapshot);

    // Keep only the most recent snapshots within window size
    const windowSize = this.config.window_size ?? 100;
    if (snapshots.length > windowSize) {
      snapshots.splice(0, snapshots.length - windowSize);
    }
  }

  /**
   * Detect drift for a metric
   */
  detectDrift(metric_name: string): DriftResult | null {
    const snapshots = this.snapshots.get(metric_name);
    if (!snapshots || snapshots.length < 10) {
      return null; // Not enough data
    }

    const now = new Date();
    const baselinePeriodMs = this.config.baseline_period_ms ?? 7 * 24 * 60 * 60 * 1000;
    const baselineCutoff = new Date(now.getTime() - baselinePeriodMs);

    // Split into baseline and current
    const baseline = snapshots.filter(s => new Date(s.timestamp) < baselineCutoff);
    const current = snapshots.filter(s => new Date(s.timestamp) >= baselineCutoff);

    if (baseline.length < 5 || current.length < 5) {
      return null; // Not enough data in either period
    }

    // Calculate statistics
    const baselineMean = this.calculateMean(baseline.map(s => s.value));
    const currentMean = this.calculateMean(current.map(s => s.value));
    const baselineStdDev = this.calculateStdDev(baseline.map(s => s.value), baselineMean);
    const currentStdDev = this.calculateStdDev(current.map(s => s.value), currentMean);

    // Calculate drift magnitude (normalized difference)
    const driftMagnitude = Math.abs(currentMean - baselineMean) / (baselineStdDev || 1);

    // Determine trend
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (currentMean > baselineMean) {
      trend = 'improving';
    } else if (currentMean < baselineMean) {
      trend = 'degrading';
    }

    // Determine confidence based on sample size
    const confidence = Math.min(1, (baseline.length + current.length) / 50);

    return {
      metric_name,
      drift_detected: driftMagnitude > (this.config.drift_threshold ?? 0.2),
      drift_magnitude: driftMagnitude,
      baseline_mean: baselineMean,
      current_mean: currentMean,
      baseline_stddev: baselineStdDev,
      current_stddev: currentStdDev,
      trend,
      confidence,
    };
  }

  /**
   * Detect drift for all metrics
   */
  detectAllDrift(): DriftResult[] {
    const results: DriftResult[] = [];
    
    for (const metric_name of this.snapshots.keys()) {
      const result = this.detectDrift(metric_name);
      if (result) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.drift_magnitude - a.drift_magnitude);
  }

  /**
   * Get metrics that need alerts
   */
  getAlerts(): DriftResult[] {
    const allDrift = this.detectAllDrift();
    const alertThreshold = this.config.alert_threshold ?? 0.3;
    return allDrift.filter(d => d.drift_magnitude > alertThreshold);
  }

  /**
   * Calculate mean of values
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate standard deviation of values
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Get statistics for a metric
   */
  getMetricStats(metric_name: string): {
    count: number;
    mean: number;
    min: number;
    max: number;
    stddev: number;
  } | null {
    const snapshots = this.snapshots.get(metric_name);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    const values = snapshots.map(s => s.value);
    const mean = this.calculateMean(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const stddev = this.calculateStdDev(values, mean);

    return {
      count: snapshots.length,
      mean,
      min,
      max,
      stddev,
    };
  }

  /**
   * Load snapshots from persistence (for MVP, returns empty)
   */
  async loadFromPersistence(): Promise<void> {
    // In a real implementation, this would load from file/database
    // For MVP, we assume in-memory only
  }

  /**
   * Save snapshots to persistence (for MVP, no-op)
   */
  async saveToPersistence(): Promise<void> {
    // In a real implementation, this would save to file/database
    // For MVP, we assume in-memory only
  }

  /**
   * Reset all snapshots
   */
  reset(): void {
    this.snapshots.clear();
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.snapshots.keys());
  }
}

/**
 * Create a DriftDetector instance
 */
export function createDriftDetector(config?: DriftDetectionConfig): DriftDetector {
  return new DriftDetector(config || {});
}
