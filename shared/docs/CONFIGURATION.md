# Configuration Management

This document describes the centralized configuration management system for G-Stack tools.

## Overview

The configuration manager provides:
- Environment variable validation using Zod schemas
- Tool-specific configuration schemas
- Startup validation with production checks
- Secret redaction for debugging
- File-based configuration with environment variable overrides

## Common Configuration Options

### Environment

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | enum | `development` | Environment: `development`, `production`, `test` |

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `log_level` | enum | `INFO` | Log level: `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `log_format` | enum | `json` | Log format: `json`, `text` |

### API

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_PORT` | number | - | API server port (1-65535) |
| `API_HOST` | string | - | API server host |

### Timeouts

| Variable | Type | Default | Range | Description |
|----------|------|---------|-------|-------------|
| `gbrain_timeout_ms` | number | - | 100-300000 | GBrain API timeout in milliseconds |
| `sandbox_timeout_ms` | number | - | 1000-600000 | Sandbox operation timeout in milliseconds |

### Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `secret_backend` | enum | `env` | Secret backend: `env`, `file`, `keyring` |

## GOrchestrator Configuration

### Tool-Specific Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SANDBOX_BACKEND` | enum | `docker` | Sandbox backend: `docker`, `e2b`, `modal`, `daytona`, `firecracker`, `inprocess` |
| `SANDBOX_MAX_CONCURRENCY` | number | `5` | Maximum concurrent sandboxes (1-50) |
| `MOCK_SANDBOX` | boolean | `false` | Enable mock sandbox mode for testing |
| `GORCHESTRATOR_MCP_TOKEN` | string | - | MCP authentication token (required in production) |
| `GORCHESTRATOR_SECRET_DIR` | string | `~/.gorchestrator/secrets` | Directory for secret storage |
| `GORCHESTRATOR_AUDIT_DIR` | string | `~/.gorchestrator/audit` | Directory for audit logs |

### Example Configuration

```bash
# Environment
export NODE_ENV=production

# Logging
export log_level=INFO
export log_format=json

# Sandbox
export SANDBOX_BACKEND=docker
export SANDBOX_MAX_CONCURRENCY=10

# Security (required in production)
export GORCHESTRATOR_MCP_TOKEN=your-secure-token-here
```

## GAgent Configuration

### Tool-Specific Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PIPELINE_MAX_PARALLEL` | number | `3` | Maximum parallel pipeline executions (1-20) |
| `GAGENT_MCP_TOKEN` | string | - | MCP authentication token (required in production) |
| `GAGENT_SECRET_DIR` | string | `~/.gagent/secrets` | Directory for secret storage |
| `GAGENT_AUDIT_DIR` | string | `~/.gagent/audit` | Directory for audit logs |

### Example Configuration

```bash
export NODE_ENV=production
export PIPELINE_MAX_PARALLEL=5
export GAGENT_MCP_TOKEN=your-secure-token-here
```

## GLearn Configuration

### Tool-Specific Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LEARNING_ENABLED` | boolean | `true` | Enable automatic learning |
| `GLEARN_MCP_TOKEN` | string | - | MCP authentication token (required in production) |
| `GLEARN_SECRET_DIR` | string | `~/.glearn/secrets` | Directory for secret storage |
| `GLEARN_AUDIT_DIR` | string | `~/.glearn/audit` | Directory for audit logs |

### Example Configuration

```bash
export NODE_ENV=production
export LEARNING_ENABLED=true
export GLEARN_MCP_TOKEN=your-secure-token-here
```

## GMirror Configuration

### Tool-Specific Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `EVALUATION_MODE` | enum | `balanced` | Evaluation mode: `strict`, `lenient`, `balanced` |
| `GMIRROR_MCP_TOKEN` | string | - | MCP authentication token (required in production) |
| `GMIRROR_SECRET_DIR` | string | `~/.gmirror/secrets` | Directory for secret storage |
| `GMIRROR_AUDIT_DIR` | string | `~/.gmirror/audit` | Directory for audit logs |

### Example Configuration

```bash
export NODE_ENV=production
export EVALUATION_MODE=balanced
export GMIRROR_MCP_TOKEN=your-secure-token-here
```

## Startup Validation

The configuration manager validates configuration on startup:

### Production Requirements

In production mode (`NODE_ENV=production`), the following are required:
- Tool-specific MCP tokens (`GORCHESTRATOR_MCP_TOKEN`, `GAGENT_MCP_TOKEN`, etc.)

### Validation Warnings

The following warnings are issued but don't prevent startup:
- No LLM API keys configured (LLM features won't work)
- Cost tracking enabled but no budget set

### Using Startup Validation

```typescript
import { getConfigManager } from '@shared/config/config-manager';

const config = getConfigManager();
await config.load();

const validation = config.validateStartup('gorchestrator');
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}
```

## Configuration File Support

Configuration can be loaded from a JSON file at `.gstack/config.json`:

```json
{
  "log_level": "INFO",
  "log_format": "json",
  "gbrain_timeout_ms": 30000,
  "sandbox_timeout_ms": 120000,
  "secret_backend": "env"
}
```

Environment variables override file-based configuration.

## Debugging Configuration

To export configuration with secrets redacted:

```typescript
import { getConfigManager } from '@shared/config/config-manager';

const config = getConfigManager();
await config.load();

console.log('Current configuration:', config.exportSafe());
```

## Migration

Configuration migration scripts are available for version upgrades. See the migration guide for details.
