# Examples and Usage Patterns

This document provides practical examples and common usage patterns for G-Stack tools.

## Table of Contents

- [GOrchestrator Examples](#gorchestrator-examples)
- [GAgent Examples](#gagent-examples)
- [GLearn Examples](#glearn-examples)
- [GMirror Examples](#gmirror-examples)
- [Integration Examples](#integration-examples)
- [Common Patterns](#common-patterns)

## GOrchestrator Examples

### Running a Single Task

```bash
# CLI usage
gorch run "Write a function to sort an array"

# With options
gorch run "Write a function to sort an array" \
  --parallel 3 \
  --verify true \
  --budget-usd 1.0
```

### Running Multiple Tasks in Parallel

```bash
# Run multiple tasks from a file
cat tasks.txt | while read task; do
  gorch run "$task" --parallel 5 &
done
wait
```

### Using MCP Interface

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'example-client',
  version: '1.0.0',
}, {
  capabilities: {},
});

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./node_modules/@gstack/gorchestrator/dist/mcp/server.js'],
  env: {
    GORCHESTRATOR_MCP_TOKEN: 'your-token',
  },
});

await client.connect(transport);

const result = await client.callTool({
  name: 'gorch_run',
  arguments: {
    task: 'Write a function to sort an array',
    parallel: 3,
    verify: true,
  },
});
```

### Sandbox Configuration

```typescript
import { SandboxPoolManager } from '@gstack/gorchestrator';

const poolManager = new SandboxPoolManager({
  maxConcurrency: 5,
  backend: 'docker',
});

const sandbox = await poolManager.provisionSandbox('attempt-1', {
  image: 'python:3.11-slim',
  resource_limits: {
    cpu_cores: 2,
    memory_mb: 4096,
    disk_gb: 10,
    max_wall_time_ms: 300000,
  },
  network_isolation: true,
  allowlisted_domains: ['api.example.com'],
});

const result = await poolManager.executeCommand(
  sandbox.sandbox_id,
  'python -c "print(1 + 1)"'
);

await poolManager.destroySandbox(sandbox.sandbox_id);
```

## GAgent Examples

### Running a Pipeline Task

```bash
# CLI usage
gagent run "Analyze this code for bugs" \
  --parallel 3 \
  --verify true \
  --cognitive-check false
```

### GBrain Search Integration

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'gagent-client',
  version: '1.0.0',
}, { capabilities: {} });

await client.connect(transport);

// Search GBrain for context
const searchResult = await client.callTool({
  name: 'gagent_brain_search',
  arguments: {
    query: 'best practices for error handling',
  },
});

// Use context in pipeline task
const taskResult = await client.callTool({
  name: 'gagent_run',
  arguments: {
    task: 'Implement error handling based on best practices',
    brain_context: searchResult.content,
  },
});
```

### Configuration Management

```bash
# Get current configuration
gagent config get

# Set configuration value
gagent config set pipeline_max_parallel 5

# List all configuration options
gagent config list
```

## GLearn Examples

### Pattern Mining

```bash
# Mine patterns from codebase
glearn patterns --directory ./src --output patterns.json

# Get existing patterns
glearn get-patterns
```

### Proposal Generation

```bash
# Generate improvement proposals
glearn proposals --directory ./src --threshold 0.8

# Get existing proposals
glearn get-proposals

# Approve a proposal
glearn approve --proposal-id proposal-123
```

### Learning Pipeline

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'glearn-client',
  version: '1.0.0',
}, { capabilities: {} });

await client.connect(transport);

// Run learning pipeline
const result = await client.callTool({
  name: 'glearn_run',
  arguments: {
    directory: './src',
    auto_apply: false,
    min_confidence: 0.8,
  },
});

// Review proposals
const proposals = await client.callTool({
  name: 'glearn_get_proposals',
  arguments: {},
});

// Approve specific proposal
await client.callTool({
  name: 'glearn_approve',
  arguments: {
    proposal_id: proposals.content[0].id,
  },
});
```

## GMirror Examples

### Code Scoring

```bash
# Score a code diff
gmirror score --diff-file changes.patch --rubric security

# Score with custom rubric
gmirror score --diff-file changes.patch --rubric-file custom-rubric.json
```

### Failure Mode Analysis

```bash
# Analyze failure modes
gmirror failure-modes --directory ./test

# Get existing failure modes
gmirror get-failure-modes

# Calibrate evaluation
gmirror calibrate --reference-dataset ./reference-data.json
```

### Evaluation Mode

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'gmirror-client',
  version: '1.0.0',
}, { capabilities: {} });

await client.connect(transport);

// Score with strict mode
const strictResult = await client.callTool({
  name: 'gmirror_score',
  arguments: {
    payload: {
      before: 'function old() {}',
      after: 'function new() {}',
    },
    rubric: 'security',
    evaluation_mode: 'strict',
  },
});

// Score with lenient mode
const lenientResult = await client.callTool({
  name: 'gmirror_score',
  arguments: {
    payload: {
      before: 'function old() {}',
      after: 'function new() {}',
    },
    rubric: 'security',
    evaluation_mode: 'lenient',
  },
});
```

## Integration Examples

### Full Pipeline Integration

```typescript
import { SandboxPoolManager } from '@gstack/gorchestrator';
import { withRetry, CircuitBreaker } from '@shared/core/resilience';

// Setup
const poolManager = new SandboxPoolManager({
  maxConcurrency: 5,
  backend: 'docker',
});

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeoutMs: 60000,
});

// Execute task with resilience
async function executeTaskWithResilience(task: string) {
  return withRetry(async () => {
    return circuitBreaker.execute(async () => {
      const sandbox = await poolManager.provisionSandbox('task-1', {
        image: 'python:3.11-slim',
        resource_limits: {
          cpu_cores: 2,
          memory_mb: 4096,
          disk_gb: 10,
          max_wall_time_ms: 300000,
        },
      });

      try {
        const result = await poolManager.executeCommand(
          sandbox.sandbox_id,
          `python -c "${task}"`
        );
        return result;
      } finally {
        await poolManager.destroySandbox(sandbox.sandbox_id);
      }
    });
  }, {
    maxAttempts: 3,
    initialDelayMs: 1000,
  });
}

// Usage
const result = await executeTaskWithResilience('print("Hello, World!")');
```

### MCP Tool Chain

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Connect to all tools
const orchestratorClient = new Client({ name: 'orchestrator', version: '1.0.0' }, { capabilities: {} });
const gagentClient = new Client({ name: 'gagent', version: '1.0.0' }, { capabilities: {} });
const glearnClient = new Client({ name: 'glearn', version: '1.0.0' }, { capabilities: {} });
const gmirrorClient = new Client({ name: 'gmirror', version: '1.0.0' }, { capabilities: {} });

// Tool chain: Execute task → Learn from results → Evaluate quality
async function toolChain(task: string) {
  // 1. Execute task
  const executionResult = await orchestratorClient.callTool({
    name: 'gorch_run',
    arguments: { task, parallel: 3 },
  });

  // 2. Learn from execution
  const learningResult = await glearnClient.callTool({
    name: 'glearn_run',
    arguments: {
      directory: './src',
      auto_apply: false,
    },
  });

  // 3. Evaluate quality
  const evaluationResult = await gmirrorClient.callTool({
    name: 'gmirror_score',
    arguments: {
      payload: executionResult.content,
      rubric: 'quality',
    },
  });

  return {
    execution: executionResult,
    learning: learningResult,
    evaluation: evaluationResult,
  };
}
```

## Common Patterns

### Error Handling Pattern

```typescript
import { ValidationError, TimeoutError } from '@gstack/gorchestrator/errors';

async function safeExecute(fn: () => Promise<any>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation failed:', error.message);
      return { success: false, error: error.toJSON() };
    } else if (error instanceof TimeoutError) {
      console.error('Operation timed out:', error.message);
      return { success: false, error: error.toJSON() };
    } else {
      console.error('Unexpected error:', error);
      throw error;
    }
  }
}
```

### Configuration Loading Pattern

```typescript
import { getConfigManager } from '@shared/config/config-manager';

async function initializeApp(toolName: string) {
  const config = getConfigManager();
  await config.load();

  const validation = config.validateStartup(toolName);
  if (!validation.valid) {
    console.error('Configuration errors:', validation.errors);
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings);
  }

  return config;
}
```

### Logging Pattern

```typescript
import { LocalLogger, LocalAuditLogger, Tracer } from '@gstack/gorchestrator/observability';

const logger = new LocalLogger('my-tool');
const auditLogger = new LocalAuditLogger('my-tool');
const tracer = new Tracer();

async function withLogging<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const traceId = tracer.startTrace();
  
  logger.info({ operation, traceId, message: 'Starting operation' });
  
  try {
    const result = await fn();
    logger.info({ operation, traceId, message: 'Operation completed' });
    auditLogger.logDecision({
      decision: operation,
      outcome: 'success',
      trace_id: traceId,
      timestamp: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    logger.error({ operation, traceId, error: error instanceof Error ? error.message : String(error) });
    auditLogger.logSecurityEvent({
      event: 'operation_failed',
      operation,
      trace_id: traceId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
```

### Budget Management Pattern

```typescript
import { BudgetExceededError } from '@gstack/gorchestrator/errors';

async function executeWithBudget(
  operation: () => Promise<any>,
  budgetUsd: number
) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      console.error('Budget exceeded:', error.message);
      // Implement fallback or graceful degradation
      return { success: false, reason: 'budget_exceeded' };
    }
    throw error;
  }
}
```

### Retry Pattern

```typescript
import { withRetry } from '@shared/core/resilience';

async function resilientOperation() {
  return withRetry(async () => {
    // Your operation here
    return await fetchExternalAPI();
  }, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '429', '503'],
  });
}
```

### Circuit Breaker Pattern

```typescript
import { CircuitBreaker } from '@shared/core/resilience';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeoutMs: 60000,
  onStateChange: (state) => {
    console.log(`Circuit breaker state changed to: ${state}`);
  },
});

async function protectedOperation() {
  return circuitBreaker.execute(async () => {
    // Your operation here
    return await callExternalService();
  });
}
```

## Best Practices

1. **Always use structured logging** with trace IDs for debugging
2. **Validate all inputs** before processing
3. **Use circuit breakers** for external service calls
4. **Implement retries** with exponential backoff
5. **Set appropriate timeouts** for all operations
6. **Handle errors gracefully** with proper error classification
7. **Audit all state-changing operations**
8. **Redact PII** from logs and error messages
9. **Use configuration management** with validation
10. **Monitor resource usage** and set appropriate limits
