/**
 * Prometheus Metrics Collection
 * 
 * Provides standardized metrics collection across all G-Stack tools.
 * Metrics include counters, gauges, and histograms for monitoring.
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// Custom registry for G-Stack metrics
const register = new Registry();

// GOrchestrator Metrics
export const orchestratorMetrics = {
  sandboxCount: new Gauge({
    name: 'gorchestrator_sandbox_count',
    help: 'Number of active sandboxes',
    registers: [register],
    labelNames: ['backend'],
  }),

  sandboxProvisionDuration: new Histogram({
    name: 'gorchestrator_sandbox_provision_duration_seconds',
    help: 'Time taken to provision a sandbox',
    registers: [register],
    labelNames: ['backend', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  taskExecutionDuration: new Histogram({
    name: 'gorchestrator_task_execution_duration_seconds',
    help: 'Time taken to execute a task',
    registers: [register],
    labelNames: ['status'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
  }),

  taskExecutionTotal: new Counter({
    name: 'gorchestrator_task_execution_total',
    help: 'Total number of task executions',
    registers: [register],
    labelNames: ['status'],
  }),

  totalCostUsd: new Counter({
    name: 'gorchestrator_total_cost_usd',
    help: 'Total cost incurred in USD',
    registers: [register],
  }),

  commandExecutionDuration: new Histogram({
    name: 'gorchestrator_command_execution_duration_seconds',
    help: 'Time taken to execute a command in sandbox',
    registers: [register],
    labelNames: ['exit_code'],
    buckets: [0.01, 0.1, 0.5, 1, 5, 10],
  }),
};

// GAgent Metrics
export const agentMetrics = {
  pipelineExecutionDuration: new Histogram({
    name: 'gagent_pipeline_execution_duration_seconds',
    help: 'Time taken to execute a pipeline',
    registers: [register],
    labelNames: ['status'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
  }),

  pipelineExecutionTotal: new Counter({
    name: 'gagent_pipeline_execution_total',
    help: 'Total number of pipeline executions',
    registers: [register],
    labelNames: ['status'],
  }),

  toolExecutionDuration: new Histogram({
    name: 'gagent_tool_execution_duration_seconds',
    help: 'Time taken to execute a tool',
    registers: [register],
    labelNames: ['tool', 'status'],
    buckets: [0.1, 0.5, 1, 5, 10, 30],
  }),

  brainSearchDuration: new Histogram({
    name: 'gagent_brain_search_duration_seconds',
    help: 'Time taken to search GBrain',
    registers: [register],
    labelNames: ['status'],
    buckets: [0.01, 0.1, 0.5, 1, 5],
  }),

  brainSearchTotal: new Counter({
    name: 'gagent_brain_search_total',
    help: 'Total number of GBrain searches',
    registers: [register],
    labelNames: ['status'],
  }),
};

// GLearn Metrics
export const learnMetrics = {
  patternMiningDuration: new Histogram({
    name: 'glearn_pattern_mining_duration_seconds',
    help: 'Time taken to mine patterns',
    registers: [register],
    labelNames: ['status'],
    buckets: [1, 5, 10, 30, 60, 120],
  }),

  patternsFound: new Gauge({
    name: 'glearn_patterns_found',
    help: 'Number of patterns found',
    registers: [register],
  }),

  proposalGenerationDuration: new Histogram({
    name: 'glearn_proposal_generation_duration_seconds',
    help: 'Time taken to generate proposals',
    registers: [register],
    labelNames: ['status'],
    buckets: [1, 5, 10, 30, 60],
  }),

  proposalsGenerated: new Counter({
    name: 'glearn_proposals_generated_total',
    help: 'Total number of proposals generated',
    registers: [register],
  }),

  proposalsApproved: new Counter({
    name: 'glearn_proposals_approved_total',
    help: 'Total number of proposals approved',
    registers: [register],
  }),

  proposalConfidence: new Histogram({
    name: 'glearn_proposal_confidence',
    help: 'Confidence score of proposals',
    registers: [register],
    buckets: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0],
  }),
};

// GMirror Metrics
export const mirrorMetrics = {
  evaluationDuration: new Histogram({
    name: 'gmirror_evaluation_duration_seconds',
    help: 'Time taken to evaluate code',
    registers: [register],
    labelNames: ['rubric', 'evaluation_mode'],
    buckets: [0.1, 0.5, 1, 5, 10, 30],
  }),

  evaluationTotal: new Counter({
    name: 'gmirror_evaluation_total',
    help: 'Total number of evaluations',
    registers: [register],
    labelNames: ['rubric', 'status'],
  }),

  verdictScore: new Histogram({
    name: 'gmirror_verdict_score',
    help: 'Score of verdicts',
    registers: [register],
    labelNames: ['rubric'],
    buckets: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  }),

  failureModesDetected: new Counter({
    name: 'gmirror_failure_modes_detected_total',
    help: 'Total number of failure modes detected',
    registers: [register],
    labelNames: ['severity'],
  }),

  calibrationAccuracy: new Gauge({
    name: 'gmirror_calibration_accuracy',
    help: 'Accuracy of calibration',
    registers: [register],
  }),
};

// Common Metrics
export const commonMetrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    registers: [register],
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),

  httpRequestTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    registers: [register],
    labelNames: ['method', 'route', 'status_code'],
  }),

  activeConnections: new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register],
  }),

  memoryUsageBytes: new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    registers: [register],
    labelNames: ['type'],
  }),

  cpuUsagePercent: new Gauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage',
    registers: [register],
  }),

  diskUsageBytes: new Gauge({
    name: 'disk_usage_bytes',
    help: 'Disk usage in bytes',
    registers: [register],
    labelNames: ['mount'],
  }),
};

// Metrics helper functions
export function setGauge<T extends Gauge<any>>(
  gauge: T,
  value: number,
  labels?: Record<string, string>
): void {
  if (labels) {
    gauge.set(labels, value);
  } else {
    gauge.set(value);
  }
}

export function incrementCounter<T extends Counter<any>>(
  counter: T,
  labels?: Record<string, string>
): void {
  if (labels) {
    counter.inc(labels);
  } else {
    counter.inc();
  }
}

export function observeHistogram<T extends Histogram<any>>(
  histogram: T,
  value: number,
  labels?: Record<string, string>
): void {
  if (labels) {
    histogram.observe(labels, value);
  } else {
    histogram.observe(value);
  }
}

export function startTimer<T extends Histogram<any>>(
  histogram: T,
  labels?: Record<string, string>
): () => void {
  const start = Date.now();
  return () => {
    const duration = (Date.now() - start) / 1000;
    observeHistogram(histogram, duration, labels);
  };
}

// Metrics middleware for Express
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
    };
    
    observeHistogram(commonMetrics.httpRequestDuration, duration, labels);
    incrementCounter(commonMetrics.httpRequestTotal, labels);
  });
  
  next();
}

// Get metrics for Prometheus scraping
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

// Reset all metrics (useful for testing)
export function resetMetrics(): void {
  register.resetMetrics();
}

// Get registry
export function getRegistry(): Registry {
  return register;
}
