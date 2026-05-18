# API Documentation

This document provides comprehensive API documentation for all G-Stack tools.

## Table of Contents

- [GOrchestrator API](#gorchestrator-api)
- [GAgent API](#gagent-api)
- [GLearn API](#glearn-api)
- [GMirror API](#gmirror-api)
- [Shared APIs](#shared-apis)
- [Error Responses](#error-responses)

## GOrchestrator API

### MCP Tools

#### `gorch_run`

Executes a task through the orchestration engine with parallel sampling.

**Arguments**:
```typescript
{
  task: string;              // The task to execute
  parallel?: number;        // Number of parallel attempts (default: 3)
  verify?: boolean;         // Enable verification (default: true)
  cognitive_check?: boolean; // Enable cognitive checks (default: false)
  learn?: boolean;          // Enable learning (default: false)
  full?: boolean;           // Return full execution details (default: false)
  dry_run?: boolean;        // Dry run without execution (default: false)
  budget_usd?: number;      // Budget limit in USD (default: 1.0)
}
```

**Response**:
```typescript
{
  attempt_id: string;
  task: string;
  results: Array<{
    attempt_number: number;
    result: any;
    success: boolean;
    cost_usd: number;
    duration_ms: number;
  }>;
  total_cost_usd: number;
  total_duration_ms: number;
  timestamp: string;
}
```

**Scopes**: `write`

**Example**:
```typescript
const result = await client.callTool({
  name: 'gorch_run',
  arguments: {
    task: 'Write a function to sort an array',
    parallel: 3,
    verify: true,
    budget_usd:1.0,
  },
});
```

#### `gorch_health`

Returns health status and internal metrics.

**Arguments**: `{}`

**Response**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_ms: number;
  metrics: {
    active_sandboxes: number;
    total_attempts: number;
    success_rate: number;
    avg_duration_ms: number;
    total_cost_usd: number;
  };
  timestamp: string;
}
```

**Scopes**: `read`

#### `gorch_config_sample`

Returns the current configuration sample.

**Arguments**: `{}`

**Response**:
```typescript
{
  sandbox_backend: string;
  max_concurrency: number;
  resource_limits: {
    cpu_cores: number;
    memory_mb: number;
    disk_gb: number;
  };
  timeouts: {
    sandbox_timeout_ms: number;
    operation_timeout_ms: number;
  };
}
```

**Scopes**: `read`

#### `gorch_get_receipts`

Retrieves execution receipts with optional filtering.

**Arguments**:
```typescript
{
  limit?: number;           // Maximum receipts to return (default: 25)
  offset?: number;          // Offset for pagination (default: 0)
  start_date?: string;      // ISO 8601 start date
  end_date?: string;        // ISO 8601 end date
}
```

**Response**:
```typescript
{
  receipts: Array<{
    receipt_id: string;
    attempt_id: string;
    task: string;
    result: any;
    cost_usd: number;
    timestamp: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}
```

**Scopes**: `read`

#### `gorch_get_drift`

Returns drift analysis for tracked metrics.

**Arguments**:
```typescript
{
  metric_name?: string;     // Specific metric name, or all if omitted
}
```

**Response**:
```typescript
{
  metrics: Array<{
    name: string;
    current_value: number;
    baseline_value: number;
    drift_percent: number;
    status: 'stable' | 'drifting' | 'critical';
  }>;
  timestamp: string;
}
```

**Scopes**: `read`

#### `gorch_sandbox_stats`

Returns sandbox pool statistics.

**Arguments**: `{}`

**Response**:
```typescript
{
  total_sandboxes: number;
  active_sandboxes: number;
  available_capacity: number;
  queue_depth: number;
  backend_status: string;
  resource_usage: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
}
```

**Scopes**: `read`

### HTTP Endpoints

#### `GET /health`

Health check endpoint.

**Response**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
}
```

#### `GET /metrics`

Prometheus metrics endpoint.

**Response**: Prometheus text format metrics

## GAgent API

### MCP Tools

#### `gagent_run`

Runs a task through the pipeline.

**Arguments**:
```typescript
{
  task: string;
  parallel?: number;
  verify?: boolean;
  cognitive_check?: boolean;
  learn?: boolean;
  full?: boolean;
  dry_run?: boolean;
  budget_usd?: number;
}
```

**Response**:
```typescript
{
  pipeline_id: string;
  task: string;
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    duration_ms?: number;
  }>;
  final_result: any;
  total_cost_usd: number;
  total_duration_ms: number;
  timestamp: string;
}
```

**Scopes**: `write`

#### `gagent_health`

Returns health and internal metrics.

**Arguments**: `{}`

**Response**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  metrics: {
    active_pipelines: number;
    total_executions: number;
    success_rate: number;
    avg_pipeline_duration_ms: number;
  };
}
```

**Scopes**: `read`

#### `gagent_brain_search`

Queries GBrain for context.

**Arguments**:
```typescript
{
  query: string;
  limit?: number;  // Default: 10
}
```

**Response**:
```typescript
{
  results: Array<{
    id: string;
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>;
  query: string;
  timestamp: string;
}
```

**Scopes**: `read`

#### `gagent_config_get` / `gagent_config_set`

Read/write configuration values.

**Arguments (set)**:
```typescript
{
  key: string;
  value: unknown;
}
```

**Response (get)**:
```typescript
{
  key: string;
  value: unknown;
}
```

**Scopes**: `read` (get), `write` (set)

#### `gagent_get_receipts`

Retrieves pipeline receipts.

**Arguments**:
```typescript
{
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
}
```

**Response**: Same structure as `gorch_get_receipts`

**Scopes**: `read`

#### `gagent_get_drift`

Returns drift analysis.

**Arguments**: Same as `gorch_get_drift`

**Scopes**: `read`

## GLearn API

### MCP Tools

#### `glearn_run`

Runs the learning pipeline.

**Arguments**:
```typescript
{
  directory?: string;       // Directory to analyze
  auto_apply?: boolean;     // Automatically apply proposals
  min_confidence?: number;  // Minimum confidence threshold (0-1)
}
```

**Response**:
```typescript
{
  pipeline_id: string;
  patterns_found: number;
  proposals_generated: number;
  proposals_applied: number;
  duration_ms: number;
  timestamp: string;
}
```

**Scopes**: `write`

#### `glearn_patterns`

Mine patterns from codebase.

**Arguments**:
```typescript
{
  directory?: string;
  output?: string;          // Output file path
}
```

**Response**:
```typescript
{
  patterns: Array<{
    pattern_id: string;
    description: string;
    frequency: number;
    locations: Array<{
      file: string;
      line: number;
    }>;
  }>;
  timestamp: string;
}
```

**Scopes**: `read`

#### `glearn_get_patterns`

Retrieve existing patterns.

**Arguments**: `{}`

**Response**: Same structure as `glearn_patterns`

**Scopes**: `read`

#### `glearn_proposals`

Generate improvement proposals.

**Arguments**:
```typescript
{
  directory?: string;
  threshold?: number;       // Confidence threshold
}
```

**Response**:
```typescript
{
  proposals: Array<{
    proposal_id: string;
    pattern_id: string;
    description: string;
    confidence: number;
    evidence: Array<{
      file: string;
      line: number;
      context: string;
    }>;
    status: 'pending' | 'approved' | 'rejected';
  }>;
  timestamp: string;
}
```

**Scopes**: `read`

#### `glearn_get_proposals`

Retrieve existing proposals.

**Arguments**: `{}`

**Response**: Same structure as `glearn_proposals`

**Scopes**: `read`

#### `glearn_approve`

Approve a proposal.

**Arguments**:
```typescript
{
  proposal_id: string;
}
```

**Response**:
```typescript
{
  proposal_id: string;
  status: 'approved';
  timestamp: string;
}
```

**Scopes**: `write`

#### `glearn_health`

Health check endpoint.

**Arguments**: `{}`

**Response**: Standard health response

**Scopes**: `read`

## GMirror API

### MCP Tools

#### `gmirror_score`

Score a code change using a rubric.

**Arguments**:
```typescript
{
  payload: {
    before: string;         // Original code
    after: string;          // Modified code
    file_path?: string;     // File path for context
  };
  rubric?: string;          // Rubric name (default: 'quality')
  evaluation_mode?: 'strict' | 'lenient' | 'balanced';
}
```

**Response**:
```typescript
{
  verdict_id: string;
  rubric: string;
  evaluation_mode: string;
  score: number;            // 0-1
  reasoning: string;
  failure_modes: Array<{
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  timestamp: string;
}
```

**Scopes**: `write`

#### `gmirror_health`

Health check endpoint.

**Arguments**: `{}`

**Response**: Standard health response

**Scopes**: `read`

#### `gmirror_failure_modes`

Analyze failure modes.

**Arguments**:
```typescript
{
  directory?: string;
}
```

**Response**:
```typescript
{
  failure_modes: Array<{
    name: string;
    description: string;
    frequency: number;
    examples: Array<{
      file: string;
      line: number;
      context: string;
    }>;
  }>;
  timestamp: string;
}
```

**Scopes**: `read`

#### `gmirror_get_failure_modes`

Retrieve existing failure modes.

**Arguments**: `{}`

**Response**: Same structure as `gmirror_failure_modes`

**Scopes**: `read`

#### `gmirror_calibrate`

Calibrate evaluation with reference data.

**Arguments**:
```typescript
{
  reference_dataset?: string;  // Path to reference dataset
}
```

**Response**:
```typescript
{
  calibration_id: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
  };
  timestamp: string;
}
```

**Scopes**: `write`

#### `gmirror_get_receipts`

Retrieve evaluation receipts.

**Arguments**: Same as `gorch_get_receipts`

**Scopes**: `read`

#### `gmirror_get_trend`

Get quality trend over time.

**Arguments**:
```typescript
{
  period?: string;  // 'day' | 'week' | 'month' (default: 'week')
}
```

**Response**:
```typescript
{
  trend: Array<{
    timestamp: string;
    score: number;
    count: number;
  }>;
  summary: {
    avg_score: number;
    trend_direction: 'improving' | 'declining' | 'stable';
  };
}
```

**Scopes**: `read`

## Shared APIs

### Configuration Manager

```typescript
import { getConfigManager } from '@shared/config/config-manager';

const config = getConfigManager();
await config.load();

// Get a value
const logLevel = config.get('log_level');

// Get all config
const allConfig = config.getAll();

// Validate on startup
const validation = config.validateStartup('gorchestrator');
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

// Export with secrets redacted
const safeConfig = config.exportSafe();

// Enable hot-reload
config.enableHotReload();
config.onReload((newConfig) => {
  console.log('Config reloaded:', newConfig);
});
```

### Resilience Utilities

```typescript
import { withRetry, CircuitBreaker, withTimeout, withFallback } from '@shared/core/resilience';

// Retry with exponential backoff
const result = await withRetry(async () => {
  return await fetchExternalAPI();
}, {
  maxAttempts: 3,
  initialDelayMs: 1000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
});

// Circuit breaker
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeoutMs: 60000,
});

const result = await circuitBreaker.execute(async () => {
  return await callService();
});

// Timeout wrapper
const result = await withTimeout(async () => {
  return await longRunningOperation();
}, 30000, 'Operation timed out');

// Graceful degradation
const result = await withFallback(
  async () => await primaryService(),
  { fallback: 'cached_value' }
);
```

### Observability

```typescript
import { LocalLogger, LocalAuditLogger, Tracer } from '@gstack/gorchestrator/observability';

const logger = new LocalLogger('my-tool');
const auditLogger = new LocalAuditLogger('my-tool');
const tracer = new Tracer();

// Structured logging
logger.info({ 
  operation: 'task_execution',
  trace_id: tracer.getTraceId(),
  message: 'Starting task' 
});

// Audit logging
auditLogger.logDecision({
  decision: 'approve_proposal',
  outcome: 'success',
  trace_id: tracer.getTraceId(),
  timestamp: new Date().toISOString(),
});

// Security event logging
auditLogger.logSecurityEvent({
  event: 'auth_failure',
  user_id: 'user-123',
  trace_id: tracer.getTraceId(),
  timestamp: new Date().toISOString(),
});

// Distributed tracing
tracer.startTrace();
const traceId = tracer.getTraceId();
tracer.endTrace();
```

## Error Responses

All errors follow a standardized format:

```typescript
{
  error: string;           // Error class name
  code: string;            // Machine-readable error code
  message: string;         // Human-readable error message
  severity: 'recoverable' | 'fatal' | 'transient';
  requestId?: string;      // Request ID for tracing
  timestamp: string;       // ISO 8601 timestamp
}
```

### Common Error Codes

| Code | Severity | Description |
|------|----------|-------------|
| `VALIDATION_ERROR` | recoverable | Input validation failed |
| `AUTHENTICATION_ERROR` | recoverable | Authentication failed |
| `AUTHORIZATION_ERROR` | fatal | Permission denied |
| `NOT_FOUND` | recoverable | Resource not found |
| `CONFLICT` | recoverable | Resource conflict |
| `BUDGET_EXCEEDED` | fatal | Budget limit exceeded |
| `RATE_LIMIT` | transient | Rate limit exceeded |
| `TIMEOUT` | transient | Operation timed out |
| `DATABASE_ERROR` | fatal | Database operation failed |
| `SERVICE_UNAVAILABLE` | transient | External service unavailable |

## Authentication

All MCP tools require authentication via bearer token:

```bash
export GORCHESTRATOR_MCP_TOKEN=your_token
export GAGENT_MCP_TOKEN=your_token
export GLEARN_MCP_TOKEN=your_token
export GMIRROR_MCP_TOKEN=your_token
```

Tokens can be generated using:
```bash
openssl rand -hex 32
```

## Rate Limiting

Default rate limits per token:
- Read operations: 100 requests/minute
- Write operations: 10 requests/minute

Rate limits can be configured via environment variables.
