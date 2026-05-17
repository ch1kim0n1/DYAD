# @gstack/shared

Shared utilities and core modules for the G-Stack. This package provides common infrastructure utilities for all G-Tools (gagent, gmirror, glearn, gbrain, gorchestrator, GToM, etc.).

## Overview

The shared utilities include:
- **Security**: Input sanitization, secret management, rate limiting, authentication
- **Cost Tracking**: Budget management, cost calculation, cost rollups
- **Persistence**: SQLite-based data storage
- **Observability**: Structured logging with context
- **Health Checks**: Service health monitoring
- **Configuration**: Centralized configuration management
- **Performance**: Connection pooling, LLM caching, request batching
- **LLM**: Streaming client abstractions
- **Workflow**: Workflow orchestration primitives

## Installation

```bash
npm install @gstack/shared
```

## Security

### Input Sanitizer
Sanitizes user input to prevent shell injection and path traversal attacks.

```typescript
import { sanitizeInput, sanitizeCLIArgument, sanitizeFilePath } from './src/security/input-sanitizer';

const safe = sanitizeInput('user input');
const safeArg = sanitizeCLIArgument('--config', 'file.json');
const safePath = sanitizeFilePath('./relative/path');
```

### Secret Manager
Securely stores and retrieves API keys and other secrets.

```typescript
import { getSecretManager } from '@gstack/shared/security';

const secretManager = getSecretManager();
await secretManager.setSecret('anthropic_api_key', 'sk-ant-...');
const key = await secretManager.getApiKey('anthropic');
```

Supported backends:
- `env`: Environment variables (default)
- `file`: Encrypted file storage
- `keyring`: System keyring

### Rate Limiter
Prevents abuse with sliding window or token bucket algorithms.

```typescript
import { RateLimiter, RateLimitPresets } from '@gstack/shared/security';

const limiter = RateLimitPresets.moderate;
const result = limiter.check('user-identifier');
if (!result.allowed) {
  console.log('Rate limited');
}
```

### Authentication
Token-based authentication with scope-based access control.

```typescript
import { TokenAuthenticator, AccessScope } from '@gstack/shared/security/auth';

const authenticator = new TokenAuthenticator();
const token = authenticator.generateToken([AccessScope.READ, AccessScope.WRITE]);
const result = authenticator.validateToken(token);
```

## Cost Tracking

### Budget Ledger
Manages budget with reserve/commit pattern for accurate cost tracking.

```typescript
import { BudgetLedger } from '@gstack/shared/core';

const ledger = new BudgetLedger({ max_budget_usd: 100 });
const reservation = ledger.reserve('operation', 10);
ledger.commit(reservation.id, 5);
```

### Cost Calculator
Converts token counts to USD costs.

```typescript
import { CostCalculator } from '@gstack/shared/cost/cost-calculator';

const cost = CostCalculator.calculateCost('claude-sonnet-4-6', {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500,
});
```

### Cost Rollup Manager
Aggregates costs by day/week for reporting.

```typescript
import { CostRollupManager } from '@gstack/shared/cost';

const rollup = new CostRollupManager();
await rollup.addCostRecord({
  timestamp: new Date().toISOString(),
  tool: 'gagent',
  cost_usd: 0.05,
  tokens: 1500,
});
const dailyCost = await rollup.getDailyCost('2026-05-13');
```

## Persistence

### SQLite Manager
Provides SQLite-based persistence for metrics and costs.

```typescript
import { SQLiteManager } from '@gstack/shared/persistence';

const db = new SQLiteManager('.gstack/data.db');
await db.initialize();
await db.insertMetric({
  timestamp: new Date().toISOString(),
  tool: 'gagent',
  metric_name: 'latency_ms',
  metric_value: 1500,
});
const metrics = await db.queryMetrics('gagent', 'latency_ms', '2026-05-13');
```

## Observability

### Structured Logger
Provides contextual logging with log levels.

```typescript
import { StructuredLogger, LogLevel } from '@gstack/shared/core';

const logger = new StructuredLogger('gagent', { minLevel: LogLevel.INFO });
logger.info('Task started', { task_id: '123', user: 'alice' });
logger.error('Task failed', new Error('API timeout'), { task_id: '123' });
```

Log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`

## Health Checks

### Health Checker
Monitors service health with configurable checks.

```typescript
import { HealthChecker } from '@gstack/shared/health';

const healthChecker = new HealthChecker();
const result = await healthChecker.checkHTTP('https://api.example.com/health');
const llmHealth = await healthChecker.checkLLMAPI('anthropic');
```

## gbrain Integration

### GBrain Client
Typed HTTP client for gbrain with timeout and retry logic.

```typescript
import { GBrainClient } from '@gstack/shared/core';

const client = new GBrainClient({
  endpoint: 'http://localhost:3000',
  apiKey: 'your-api-key',
});
await client.createMemory({
  content: 'Important information',
  tags: ['important', 'project'],
});
const memories = await client.queryMemories('project setup');
```

## Configuration

### Config Manager
Centralized configuration from files and environment variables.

```typescript
import { getConfigManager } from '@gstack/shared/config';

const config = getConfigManager();
await config.load();
const model = config.get('default_model');
const apiKey = config.get('anthropic_api_key');
```

Configuration file: `.gstack/config.json`

Environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GBRAIN_ENDPOINT`
- `GSTACK_BUDGET_USD`
- `GSTACK_LOG_LEVEL`
- And more...

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GBRAIN_ENDPOINT` | gbrain service URL | - |
| `GSTACK_BUDGET_USD` | Budget limit in USD | - |
| `GSTACK_LOG_LEVEL` | Log level | INFO |
| `GSTACK_LOG_FORMAT` | Log format (json/text) | text |
| `GSTACK_SQLITE_PATH` | SQLite database path | .gstack/data.db |
| `GSTACK_SECRET_BACKEND` | Secret backend (env/file/keyring) | env |
| `GSTACK_DOCKER_HOST` | Docker host address | - |
| `GSTACK_SANDBOX_TIMEOUT_MS` | Sandbox timeout | 60000 |

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Publishing

```bash
npm run prepublishOnly  # Runs build automatically
npm publish
```

## License

MIT
