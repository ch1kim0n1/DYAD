# G-Stack Tools Setup Guide

This guide will help you set up and configure the g-stack tools (gagent, gmirror, glearn, gbrain, gorchestrator, etc.).

## Prerequisites

- Node.js 18+ or Bun
- Docker (for sandbox execution)
- Anthropic API key (for Claude models)
- OpenAI API key (optional, for GPT models)

## Installation

### Clone the Repository

```bash
git clone https://github.com/your-org/yc-hackathon.git
cd yc-hackathon
```

### Install Dependencies

```bash
# Using npm
npm install

# Using Bun
bun install
```

### Build the Project

```bash
npm run build
# or
bun run build
```

## Configuration

### Environment Variables

Create a `.env` file in the project root or set environment variables:

```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# gbrain Configuration
GBRAIN_ENDPOINT=http://localhost:3000
GBRAIN_TIMEOUT_MS=30000

# Cost Tracking
GSTACK_BUDGET_USD=100
GSTACK_COST_TRACKING=true

# Logging
GSTACK_LOG_LEVEL=INFO
GSTACK_LOG_FORMAT=json

# Persistence
GSTACK_SQLITE_PATH=.gstack/data.db
GSTACK_PERSISTENCE=true

# Security
GSTACK_SECRET_BACKEND=env
GSTACK_SECRET_FILE=.gstack/secrets.enc

# Docker/Sandbox
GSTACK_DOCKER_HOST=unix:///var/run/docker.sock
GSTACK_SANDBOX_TIMEOUT_MS=60000
```

### Configuration File

Create `.gstack/config.json`:

```json
{
  "anthropic_api_key": "${ANTHROPIC_API_KEY}",
  "openai_api_key": "${OPENAI_API_KEY}",
  "default_model": "claude-sonnet-4-6",
  "max_tokens": 4096,
  "temperature": 0.7,
  "gbrain_endpoint": "http://localhost:3000",
  "gbrain_timeout_ms": 30000,
  "budget_usd": 100,
  "cost_tracking_enabled": true,
  "log_level": "INFO",
  "log_format": "json",
  "sqlite_path": ".gstack/data.db",
  "persistence_enabled": true,
  "secret_backend": "env",
  "docker_host": "unix:///var/run/docker.sock",
  "sandbox_timeout_ms": 60000
}
```

## Tool-Specific Setup

### gagent

gagent is the AI agent that executes tasks using available tools.

```bash
cd gagent
npm run build
npm link  # or use npm install -g .
```

**Usage:**
```bash
gagent run "Write a Python function to sort an array"
gagent eval --suite test_suite.json
gagent replay receipt-id-123
gagent regress --baseline receipts-2026-W20.jsonl
gagent stats
```

### gmirror

gmirror mirrors code changes across multiple repositories.

```bash
cd gmirror
npm run build
npm link
```

**Usage:**
```bash
gmirror mirror source-repo target-repo
gmirror sync --dry-run
```

### glearn

glearn learns from execution results to improve future performance.

```bash
cd glearn
npm run build
npm link
```

**Usage:**
```bash
glearn train --data .gstack/receipts
glearn query "how to handle rate limiting"
```

### gbrain

gbrain provides persistent memory and knowledge management.

```bash
cd gbrain
npm run build
npm link
```

**Start the gbrain server:**
```bash
gbrain server --port 3000
```

**Usage:**
```bash
gbrain store "Important information about project X"
gbrain query "project X"
gbrain health
```

### gorchestrator

gorchestrator coordinates multiple g-stack tools for complex workflows.

```bash
cd gorchestrator
npm run build
npm link
```

**Usage:**
```bash
gorchestrator run workflow.yaml
```

## Docker Setup (Optional)

For sandbox execution, ensure Docker is running:

```bash
# On Linux/Mac
sudo systemctl start docker
sudo systemctl enable docker

# On Windows
# Start Docker Desktop
```

Verify Docker is accessible:
```bash
docker ps
```

## Secret Management

### Using Environment Variables (Default)

Set secrets in your environment:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

### Using Encrypted File Storage

1. Set the secret backend:
```bash
export GSTACK_SECRET_BACKEND=file
export GSTACK_SECRET_FILE=.gstack/secrets.enc
```

2. Set an encryption key:
```bash
export GSTACK_SECRET_KEY=your-encryption-key
```

3. Use the secret manager in your code:
```typescript
import { getSecretManager } from '@gstack/shared/security/secret-manager';

const secretManager = getSecretManager();
await secretManager.setSecret('anthropic_api_key', 'sk-ant-...');
const key = await secretManager.getApiKey('anthropic');
```

## Cost Tracking Setup

### Enable Cost Tracking

Cost tracking is enabled by default. To configure:

1. Set a budget:
```bash
export GSTACK_BUDGET_USD=100
```

2. Run with budget enforcement:
```bash
gagent run "task description" --budget-usd 10
```

### View Cost Reports

```bash
# Daily costs
gagent cost --day 2026-05-13

# Weekly costs
gagent cost --week 2026-W20

# Date range
gagent cost --range 2026-05-01 2026-05-13
```

Cost data is stored in `.gstack/costs/`:
- Daily rollups: `costs-YYYY-MM-DD.jsonl`
- Weekly rollups: `costs-YYYY-Www.jsonl`

## Logging Setup

### Configure Log Level

```bash
export GSTACK_LOG_LEVEL=DEBUG  # DEBUG, INFO, WARN, ERROR
```

### Structured Logging

Use the structured logger in your code:

```typescript
import { StructuredLogger } from '@gstack/shared/observability/structured-logger';

const logger = new StructuredLogger('my-tool');
logger.info('Processing task', { task_id: '123' });
logger.error('Task failed', { task_id: '123', error: 'timeout' });
```

## Health Checks

### Check Service Health

```typescript
import { HealthChecker } from '@gstack/shared/health/health-checker';

const healthChecker = new HealthChecker();

// Check HTTP endpoint
const httpHealth = await healthChecker.checkHTTP('https://api.example.com/health');

// Check LLM API
const llmHealth = await healthChecker.checkLLMAPI('anthropic');

// Check gbrain
const gbrainHealth = await healthChecker.checkGBrain('http://localhost:3000');
```

## Troubleshooting

### API Key Issues

**Problem:** API key not found
**Solution:** Ensure `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set in your environment or config file

### Docker Issues

**Problem:** Docker not accessible
**Solution:** 
- Verify Docker is running: `docker ps`
- Check `GSTACK_DOCKER_HOST` is set correctly
- Ensure your user has Docker permissions

### Permission Issues

**Problem:** Cannot write to `.gstack/` directory
**Solution:**
```bash
mkdir -p .gstack
chmod 755 .gstack
```

### Cost Tracking Not Working

**Problem:** Costs not being tracked
**Solution:**
- Ensure `GSTACK_COST_TRACKING=true`
- Check that `.gstack/costs/` directory is writable
- Verify cost rollup manager is initialized

### gbrain Connection Issues

**Problem:** Cannot connect to gbrain
**Solution:**
- Ensure gbrain server is running: `gbrain server`
- Check `GBRAIN_ENDPOINT` is set correctly
- Verify network connectivity

## Development Setup

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- security
npm test -- cost
```

### Building for Production

```bash
npm run build
npm run package
```

### Code Style

The project uses TypeScript with strict type checking. Ensure:
- All code is typed
- No `any` types (use `unknown` instead)
- Proper error handling
- Input sanitization for all user inputs

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive configuration
3. **Enable audit logging** for production deployments
4. **Set rate limits** on public-facing endpoints
5. **Use budget enforcement** for cost control
6. **Regularly review audit logs** for suspicious activity
7. **Rotate secrets** regularly
8. **Keep dependencies updated**

## Next Steps

- Read the [Shared Utilities README](../README.md) for detailed API documentation
- Check [Security API](./SECURITY_API.md) for security utilities
- Check [Cost Tracking API](./COST_TRACKING_API.md) for cost management
- Review tool-specific documentation in each tool's directory

## Support

For issues or questions:
- Check existing GitHub issues
- Review documentation in the `docs/` directory
- Contact the development team
