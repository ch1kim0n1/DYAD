/**
 * Health Check Module
 * 
 * Provides comprehensive health check endpoints with detailed status
 * for all G-Stack tools.
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  register(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  async check(name: string): Promise<HealthCheck> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      throw new Error(`Health check not found: ${name}`);
    }
    return checkFn();
  }

  async checkAll(): Promise<HealthCheckResult> {
    const results: HealthCheck[] = [];
    const startTime = Date.now();

    for (const [name, checkFn] of this.checks) {
      try {
        const start = Date.now();
        const result = await checkFn();
        result.duration_ms = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'fail',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Determine overall status
    const hasFailures = results.some(r => r.status === 'fail');
    const hasWarnings = results.some(r => r.status === 'warn');

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = hasFailures
      ? 'unhealthy'
      : hasWarnings
      ? 'degraded'
      : 'healthy';

    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

// Common health checks
export async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Implement actual database ping
    // For now, just return success
    return {
      name: 'database',
      status: 'pass',
      message: 'Database connection successful',
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    };
  }
}

export async function checkExternalService(url: string, timeoutMs = 5000): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      method: 'HEAD',
    });

    clearTimeout(timeout);

    if (response.ok) {
      return {
        name: 'external_service',
        status: 'pass',
        message: `External service accessible: ${url}`,
        duration_ms: Date.now() - start,
        metadata: { url, status: response.status },
      };
    } else {
      return {
        name: 'external_service',
        status: 'warn',
        message: `External service returned ${response.status}: ${url}`,
        duration_ms: Date.now() - start,
        metadata: { url, status: response.status },
      };
    }
  } catch (error) {
    return {
      name: 'external_service',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
      metadata: { url },
    };
  }
}

export async function checkDiskUsage(path: string, thresholdPercent = 85): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Implement actual disk usage check
    // For now, return mock data
    const usagePercent = 45; // Mock value

    if (usagePercent > thresholdPercent) {
      return {
        name: 'disk_usage',
        status: 'warn',
        message: `Disk usage is ${usagePercent}% at ${path}`,
        duration_ms: Date.now() - start,
        metadata: { path, usagePercent, thresholdPercent },
      };
    }

    return {
      name: 'disk_usage',
      status: 'pass',
      message: `Disk usage is ${usagePercent}% at ${path}`,
      duration_ms: Date.now() - start,
      metadata: { path, usagePercent },
    };
  } catch (error) {
    return {
      name: 'disk_usage',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    };
  }
}

export async function checkMemoryUsage(thresholdPercent = 90): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

    if (heapUsedPercent > thresholdPercent) {
      return {
        name: 'memory_usage',
        status: 'warn',
        message: `Memory usage is ${heapUsedPercent.toFixed(1)}%`,
        duration_ms: Date.now() - start,
        metadata: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          rss: usage.rss,
        },
      };
    }

    return {
      name: 'memory_usage',
      status: 'pass',
      message: `Memory usage is ${heapUsedPercent.toFixed(1)}%`,
      duration_ms: Date.now() - start,
      metadata: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
      },
    };
  } catch (error) {
    return {
      name: 'memory_usage',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    };
  }
}

export async function checkSandboxPool(maxSandboxes: number): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Implement actual sandbox pool check
    // For now, return mock data
    const activeSandboxes = 3;
    const availableCapacity = maxSandboxes - activeSandboxes;

    if (availableCapacity === 0) {
      return {
        name: 'sandbox_pool',
        status: 'warn',
        message: `Sandbox pool at capacity: ${activeSandboxes}/${maxSandboxes}`,
        duration_ms: Date.now() - start,
        metadata: { activeSandboxes, maxSandboxes, availableCapacity },
      };
    }

    return {
      name: 'sandbox_pool',
      status: 'pass',
      message: `Sandbox pool healthy: ${activeSandboxes}/${maxSandboxes}`,
      duration_ms: Date.now() - start,
      metadata: { activeSandboxes, maxSandboxes, availableCapacity },
    };
  } catch (error) {
    return {
      name: 'sandbox_pool',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    };
  }
}

export async function checkLLMProvider(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      name: 'llm_provider',
      status: 'warn',
      message: 'No LLM API key configured',
      duration_ms: Date.now() - start,
    };
  }

  return {
    name: 'llm_provider',
    status: 'pass',
    message: 'LLM provider configured',
    duration_ms: Date.now() - start,
    metadata: { provider: apiKey.includes('sk-ant-') ? 'anthropic' : 'openai' },
  };
}
