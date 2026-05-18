# Troubleshooting Guide

This guide covers common issues and solutions for G-Stack tools.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [Runtime Issues](#runtime-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)
- [Docker Issues](#docker-issues)
- [FAQ](#faq)

## Installation Issues

### Node.js Version Incompatible

**Problem**: `Error: The module was compiled against a different Node.js version`

**Solution**:
```bash
# Install Node.js 18 or higher
nvm install 18
nvm use 18

# Reinstall dependencies
npm install
```

### Dependency Installation Fails

**Problem**: `npm install` fails with peer dependency errors

**Solution**:
```bash
# Install with legacy peer deps
npm install --legacy-peer-deps

# Or use pnpm
pnpm install
```

### Build Fails

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Clean build artifacts
npm run clean
npm run build

# Check TypeScript version
npm install -g typescript@latest
```

## Configuration Issues

### Environment Variables Not Loading

**Problem**: Configuration values are undefined

**Solution**:
1. Verify `.env` file exists in project root
2. Check variable names match exactly (case-sensitive)
3. Restart the application after changing `.env`
4. Check for trailing spaces in `.env` file

```bash
# List environment variables
env | grep GSTACK
```

### Invalid Configuration Schema

**Problem**: `Configuration validation failed` error on startup

**Solution**:
1. Check configuration file syntax (JSON must be valid)
2. Verify values match expected types
3. Check for typos in variable names
4. Use configuration validation script:

```bash
node shared/scripts/validate-config.ts
```

### Secret Not Found

**Problem**: `Secret not found: GORCHESTRATOR_MCP_TOKEN`

**Solution**:
```bash
# Generate a secure token
openssl rand -hex 32

# Set environment variable
export GORCHESTRATOR_MCP_TOKEN=your_token_here

# Or use secret file
echo "your_token_here" > ~/.gorchestrator/secrets/mcp_token
```

## Runtime Issues

### Service Won't Start

**Problem**: Service exits immediately on startup

**Solution**:
```bash
# Check logs
docker-compose logs <service-name>

# Or for local development
npm start 2>&1 | tee startup.log

# Common causes:
# - Port already in use
# - Missing dependencies
# - Invalid configuration
```

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use`

**Solution**:
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in configuration
export API_PORT=3001
```

### Sandbox Timeout

**Problem**: Sandbox operations timeout

**Solution**:
```bash
# Increase timeout
export SANDBOX_TIMEOUT_MS=300000

# Check Docker daemon is running
docker ps

# Verify Docker has enough resources
docker stats
```

### Memory Limit Exceeded

**Problem**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or for Docker
docker-compose up -d --memory=4g
```

## Performance Issues

### Slow Response Times

**Problem**: API responses are slow

**Solution**:
1. Check resource usage:
```bash
docker stats
```

2. Increase concurrency:
```bash
export SANDBOX_MAX_CONCURRENCY=10
export PIPELINE_MAX_PARALLEL=5
```

3. Enable caching where applicable

4. Check network latency to external services

### High CPU Usage

**Problem**: Service consuming excessive CPU

**Solution**:
1. Check for infinite loops in custom code
2. Reduce sandbox concurrency:
```bash
export SANDBOX_MAX_CONCURRENCY=2
```

3. Profile the application:
```bash
node --prof app.js
```

### Disk Space Issues

**Problem**: Disk filling up with logs

**Solution**:
```bash
# Configure log rotation
export LOG_RETENTION_DAYS=3

# Clean old audit logs
find ~/.gorchestrator/audit -name "*.log" -mtime +7 -delete

# Clean Docker volumes
docker volume prune
```

## Security Issues

### Authentication Failed

**Problem**: `Authentication failed: invalid token`

**Solution**:
1. Verify token is set correctly
2. Check token hasn't expired
3. Regenerate token:
```bash
openssl rand -hex 32
```

4. Verify token format (should be hex string)

### CORS Errors

**Problem**: CORS policy blocking requests

**Solution**:
1. Configure allowed origins in environment:
```bash
export ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

2. Use reverse proxy for production

### Secret Exposure

**Problem**: Secrets visible in logs

**Solution**:
1. Ensure secret redaction is enabled
2. Check log level (use WARN or ERROR in production)
3. Verify secrets are not in `.env` file committed to repo

## Docker Issues

### Docker Daemon Not Running

**Problem**: `Cannot connect to Docker daemon`

**Solution**:
```bash
# Start Docker daemon
sudo systemctl start docker  # Linux
open -a Docker                # macOS

# Verify Docker is running
docker ps
```

### Container Permission Denied

**Problem**: `Permission denied` when accessing volumes

**Solution**:
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ~/.gorchestrator

# Or run Docker with user namespace
docker run --user $(id -u):$(id -g) ...
```

### Image Pull Fails

**Problem**: `Error: image pull access denied`

**Solution**:
```bash
# Log in to Docker registry
docker login

# Or build locally
docker-compose build
```

## FAQ

### Q: How do I reset the configuration?

**A**: Delete the configuration file and restart:
```bash
rm .gstack/config.json
docker-compose restart
```

### Q: How do I check which version is running?

**A**: Check the health endpoint:
```bash
curl http://localhost:3000/health | jq .version
```

### Q: How do I enable debug logging?

**A**: Set log level to DEBUG:
```bash
export LOG_LEVEL=DEBUG
docker-compose restart
```

### Q: How do I migrate configuration between versions?

**A**: Use the migration script:
```bash
node shared/scripts/migrate-config.ts --from 0.1.0 --to 0.5.0
```

### Q: How do I backup my data?

**A**: Backup volumes and configuration:
```bash
# Backup configuration
cp .env .env.backup

# Backup volumes
docker run --rm -v gorchestrator-secrets:/data -v $(pwd):/backup alpine tar czf backup.tar.gz -C /data .
```

### Q: How do I update to the latest version?

**A**: Pull latest images and restart:
```bash
git pull
docker-compose pull
docker-compose up -d --build
```

### Q: How do I run in development mode?

**A**: Set NODE_ENV to development:
```bash
export NODE_ENV=development
npm run dev
```

### Q: How do I check service health?

**A**: Use health endpoints:
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

### Q: How do I enable hot-reload?

**A**: Enable in configuration:
```bash
export HOT_RELOAD=true
npm run dev
```

### Q: How do I troubleshoot sandbox issues?

**A**: Check Docker logs and status:
```bash
docker ps -a
docker logs <container-id>
docker inspect <container-id>
```

## Getting Help

If you encounter issues not covered here:

1. Check the logs: `docker-compose logs -f`
2. Enable debug logging: `export LOG_LEVEL=DEBUG`
3. Review configuration: `node shared/scripts/validate-config.ts`
4. Check GitHub Issues for similar problems
5. Create a new issue with:
   - Tool version
   - Environment details
   - Error messages
   - Steps to reproduce
