/**
 * Performance Profiling and Optimization Tools
 * 
 * Provides performance profiling, bottleneck detection,
 * and optimization recommendations.
 */

export interface ProfilerConfig {
  sampleIntervalMs: number;
  maxSamples: number;
  includeStackTrace: boolean;
}

export interface ProfileSample {
  timestamp: number;
  durationMs: number;
  functionName: string;
  stackTrace?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProfileReport {
  totalDurationMs: number;
  sampleCount: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  functionStats: Map<string, FunctionStats>;
  bottlenecks: Array<{ functionName: string; impact: number }>;
}

export interface FunctionStats {
  count: number;
  totalDurationMs: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  percentage: number;
}

export class Profiler {
  private samples: ProfileSample[] = [];
  private config: ProfilerConfig;
  private startTime: number | null = null;

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      sampleIntervalMs: config.sampleIntervalMs || 10,
      maxSamples: config.maxSamples || 10000,
      includeStackTrace: config.includeStackTrace || false,
    };
  }

  start(): void {
    this.startTime = Date.now();
    this.samples = [];
  }

  record(functionName: string, durationMs: number, metadata?: Record<string, unknown>): void {
    const sample: ProfileSample = {
      timestamp: Date.now(),
      durationMs,
      functionName,
      metadata,
    };

    if (this.config.includeStackTrace) {
      sample.stackTrace = this.captureStackTrace();
    }

    this.samples.push(sample);

    // Evict old samples if over limit
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }
  }

  async profile<T>(functionName: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.record(functionName, duration, metadata);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.record(functionName, duration, metadata);
      throw error;
    }
  }

  profileSync<T>(functionName: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.record(functionName, duration, metadata);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.record(functionName, duration, metadata);
      throw error;
    }
  }

  generateReport(): ProfileReport {
    if (this.samples.length === 0) {
      return {
        totalDurationMs: 0,
        sampleCount: 0,
        averageDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        functionStats: new Map(),
        bottlenecks: [],
      };
    }

    const functionStats = new Map<string, FunctionStats>();
    let totalDuration = 0;

    for (const sample of this.samples) {
      totalDuration += sample.durationMs;

      const stats = functionStats.get(sample.functionName) || {
        count: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        percentage: 0,
      };

      stats.count++;
      stats.totalDurationMs += sample.durationMs;
      stats.minDurationMs = Math.min(stats.minDurationMs, sample.durationMs);
      stats.maxDurationMs = Math.max(stats.maxDurationMs, sample.durationMs);

      functionStats.set(sample.functionName, stats);
    }

    // Calculate averages and percentages
    for (const stats of functionStats.values()) {
      stats.averageDurationMs = stats.totalDurationMs / stats.count;
      stats.percentage = (stats.totalDurationMs / totalDuration) * 100;
    }

    // Identify bottlenecks (functions with highest impact)
    const bottlenecks = Array.from(functionStats.entries())
      .map(([name, stats]) => ({ functionName: name, impact: stats.percentage }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);

    const durations = this.samples.map(s => s.durationMs);

    return {
      totalDurationMs: totalDuration,
      sampleCount: this.samples.length,
      averageDurationMs: totalDuration / this.samples.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      functionStats,
      bottlenecks,
    };
  }

  getSamples(): ProfileSample[] {
    return [...this.samples];
  }

  clear(): void {
    this.samples = [];
    this.startTime = null;
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];
    return stack.split('\n').slice(3); // Skip captureStackTrace, record, and caller
  }
}

// Memory profiler
export class MemoryProfiler {
  private samples: Array<{ timestamp: number; heapUsed: number; heapTotal: number; external: number; rss: number }> = [];
  private interval: NodeJS.Timeout | null = null;

  start(sampleIntervalMs: number = 1000): void {
    this.interval = setInterval(() => {
      this.sample();
    }, sampleIntervalMs);
  }

  sample(): void {
    const usage = process.memoryUsage();
    this.samples.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStats(): {
    peakHeapUsed: number;
    averageHeapUsed: number;
    currentHeapUsed: number;
    samples: number;
  } {
    if (this.samples.length === 0) {
      return {
        peakHeapUsed: 0,
        averageHeapUsed: 0,
        currentHeapUsed: 0,
        samples: 0,
      };
    }

    const heapUsages = this.samples.map(s => s.heapUsed);
    const peakHeapUsed = Math.max(...heapUsages);
    const averageHeapUsed = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length;
    const currentHeapUsed = this.samples[this.samples.length - 1].heapUsed;

    return {
      peakHeapUsed,
      averageHeapUsed,
      currentHeapUsed,
      samples: this.samples.length,
    };
  }

  clear(): void {
    this.samples = [];
  }
}

// Performance optimizer recommendations
export interface OptimizationRecommendation {
  type: 'caching' | 'batching' | 'lazy_loading' | 'query_optimization' | 'code_refactor';
  severity: 'low' | 'medium' | 'high';
  description: string;
  functionName: string;
  estimatedImpact: string;
}

export class PerformanceOptimizer {
  analyzeProfile(report: ProfileReport): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for slow functions
    for (const [name, stats] of report.functionStats.entries()) {
      if (stats.averageDurationMs > 1000) {
        recommendations.push({
          type: 'code_refactor',
          severity: 'high',
          description: `Function ${name} is slow (>1s average)`,
          functionName: name,
          estimatedImpact: 'High',
        });
      } else if (stats.averageDurationMs > 100) {
        recommendations.push({
          type: 'code_refactor',
          severity: 'medium',
          description: `Function ${name} is moderately slow (>100ms average)`,
          functionName: name,
          estimatedImpact: 'Medium',
        });
      }

      // Check for frequently called functions
      if (stats.count > 1000 && stats.averageDurationMs > 10) {
        recommendations.push({
          type: 'caching',
          severity: 'high',
          description: `Function ${name} is called frequently and could benefit from caching`,
          functionName: name,
          estimatedImpact: 'High',
        });
      }
    }

    // Check for bottlenecks
    for (const bottleneck of report.bottlenecks) {
      if (bottleneck.impact > 20) {
        recommendations.push({
          type: 'code_refactor',
          severity: 'high',
          description: `Function ${bottleneck.functionName} accounts for ${bottleneck.impact.toFixed(1)}% of execution time`,
          functionName: bottleneck.functionName,
          estimatedImpact: 'High',
        });
      }
    }

    return recommendations;
  }

  analyzeMemory(memoryStats: { peakHeapUsed: number; averageHeapUsed: number }): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (memoryStats.peakHeapUsed > 500 * 1024 * 1024) {
      recommendations.push({
        type: 'lazy_loading',
        severity: 'high',
        description: 'High memory usage detected. Consider lazy loading large datasets',
        functionName: 'global',
        estimatedImpact: 'High',
      });
    }

    if (memoryStats.peakHeapUsed > memoryStats.averageHeapUsed * 2) {
      recommendations.push({
        type: 'code_refactor',
        severity: 'medium',
        description: 'Memory spikes detected. Check for memory leaks or large allocations',
        functionName: 'global',
        estimatedImpact: 'Medium',
      });
    }

    return recommendations;
  }
}

// Utility function to profile a block of code
export async function profileCode<T>(
  profiler: Profiler,
  functionName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  return profiler.profile(functionName, fn, metadata);
}

// Decorator for automatic profiling
export function profile(functionName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = functionName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        // In a real implementation, this would use a global profiler
        console.log(`[PROFILE] ${name} took ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.log(`[PROFILE] ${name} failed after ${duration}ms`);
        throw error;
      }
    };

    return descriptor;
  };
}
