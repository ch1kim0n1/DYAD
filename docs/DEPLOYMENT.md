# Deployment Guide

This guide covers deploying the G-Stack tools (gorchestrator, gagent, glearn, gmirror) using Docker Compose.

## Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- 4GB RAM minimum (8GB recommended)
- 10GB disk space

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/your-org/gstack.git
cd gstack
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Configure environment variables:
```bash
# Edit .env with your settings
nano .env
```

4. Start all services:
```bash
docker-compose up -d
```

5. Verify deployment:
```bash
docker-compose ps
```

## Environment Configuration

### Required Variables

```bash
# Environment
NODE_ENV=production

# LLM API Keys (at least one required)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# GBrain Configuration
GBRAIN_ENDPOINT=http://gbrain:8000
GBRAIN_TIMEOUT_MS=30000
```

### Tool-Specific Variables

```bash
# GOrchestrator
GORCHESTRATOR_MCP_TOKEN=your_secure_token
SANDBOX_BACKEND=docker
SANDBOX_MAX_CONCURRENCY=5

# GAgent
GAGENT_MCP_TOKEN=your_secure_token
PIPELINE_MAX_PARALLEL=3

# GLearn
GLEARN_MCP_TOKEN=your_secure_token
LEARNING_ENABLED=true

# GMirror
GMIRROR_MCP_TOKEN=your_secure_token
EVALUATION_MODE=balanced
```

## Docker Compose Deployment

### Production Compose File

```yaml
version: '3.8'

services:
  gorchestrator:
    build: ./DYAD/gorchestrator
    container_name: gorchestrator
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GORCHESTRATOR_MCP_TOKEN=${GORCHESTRATOR_MCP_TOKEN}
      - SANDBOX_BACKEND=docker
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - gorchestrator-secrets:/app/secrets
      - gorchestrator-audit:/app/audit
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
    networks:
      - gstack-network
    depends_on:
      - gbrain

  gagent:
    build: ./DYAD/gagent
    container_name: gagent
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - GAGENT_MCP_TOKEN=${GAGENT_MCP_TOKEN}
      - PIPELINE_MAX_PARALLEL=3
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - gagent-secrets:/app/secrets
      - gagent-audit:/app/audit
    restart: unless-stopped
    networks:
      - gstack-network
    depends_on:
      - gbrain

  glearn:
    build: ./DYAD/glearn
    container_name: glearn
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
      - GLEARN_MCP_TOKEN=${GLEARN_MCP_TOKEN}
      - LEARNING_ENABLED=true
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - glearn-secrets:/app/secrets
      - glearn-audit:/app/audit
    restart: unless-stopped
    networks:
      - gstack-network
    depends_on:
      - gbrain

  gmirror:
    build: ./DYAD/gmirror
    container_name: gmirror
    ports:
      - "3003:3000"
    environment:
      - NODE_ENV=production
      - GMIRROR_MCP_TOKEN=${GMIRROR_MCP_TOKEN}
      - EVALUATION_MODE=balanced
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - gmirror-secrets:/app/secrets
      - gmirror-audit:/app/audit
    restart: unless-stopped
    networks:
      - gstack-network
    depends_on:
      - gbrain

  gbrain:
    build: ./DYAD/gbrain
    container_name: gbrain
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=INFO
      - LOG_FORMAT=json
    volumes:
      - gbrain-data:/app/data
    restart: unless-stopped
    networks:
      - gstack-network

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped
    networks:
      - gstack-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3004:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped
    networks:
      - gstack-network

networks:
  gstack-network:
    driver: bridge

volumes:
  gorchestrator-secrets:
  gorchestrator-audit:
  gagent-secrets:
  gagent-audit:
  glearn-secrets:
  glearn-audit:
  gmirror-secrets:
  gmirror-audit:
  gbrain-data:
  prometheus-data:
  grafana-data:
```

## Service Management

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d gorchestrator

# Start with build
docker-compose up -d --build
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop specific service
docker-compose stop gorchestrator
```

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f gorchestrator

# View last 100 lines
docker-compose logs --tail=100 gorchestrator
```

### Scaling Services

```bash
# Scale orchestrator to 3 instances
docker-compose up -d --scale gorchestrator=3
```

## Health Checks

### Check Service Health

```bash
# GOrchestrator
curl http://localhost:3000/health

# GAgent
curl http://localhost:3001/health

# GLearn
curl http://localhost:3002/health

# GMirror
curl http://localhost:3003/health

# GBrain
curl http://localhost:8000/health
```

### Check Docker Container Status

```bash
docker-compose ps
```

## Backup and Restore

### Backup Configuration

```bash
# Backup environment variables
cp .env .env.backup

# Backup volumes
docker run --rm -v gorchestrator-secrets:/data -v $(pwd):/backup alpine tar czf /backup/gorchestrator-secrets.tar.gz -C /data .
docker run --rm -v gorchestrator-audit:/data -v $(pwd):/backup alpine tar czf /backup/gorchestrator-audit.tar.gz -C /data .
```

### Restore Configuration

```bash
# Restore environment variables
cp .env.backup .env

# Restore volumes
docker run --rm -v gorchestrator-secrets:/data -v $(pwd):/backup alpine tar xzf /backup/gorchestrator-secrets.tar.gz -C /data
docker run --rm -v gorchestrator-audit:/data -v $(pwd):/backup alpine tar xzf /backup/gorchestrator-audit.tar.gz -C /data
```

## Monitoring

### Prometheus Metrics

Access Prometheus at `http://localhost:9090`

Key metrics to monitor:
- `gorchestrator_sandbox_count`
- `gagent_pipeline_duration`
- `glearn_proposal_count`
- `gmirror_evaluation_score`

### Grafana Dashboards

Access Grafana at `http://localhost:3004`

Default credentials:
- Username: `admin`
- Password: Set via `GRAFANA_PASSWORD` environment variable

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Check resource usage
docker stats

# Check disk space
df -h
```

### Permission Issues

```bash
# Fix volume permissions
docker-compose down
docker volume rm <volume-name>
docker-compose up -d
```

### Network Issues

```bash
# Recreate network
docker-compose down
docker network rm gstack-network
docker-compose up -d
```

## Security Considerations

1. **Change default passwords**: Set strong passwords for all services
2. **Use secrets management**: Don't commit `.env` files
3. **Enable TLS**: Use reverse proxy with SSL in production
4. **Network isolation**: Keep services on internal network
5. **Regular updates**: Keep Docker images updated

## Production Checklist

- [ ] Set strong passwords for all services
- [ ] Configure TLS/SSL certificates
- [ ] Set up backup strategy
- [ ] Configure log retention
- [ ] Set up monitoring alerts
- [ ] Configure resource limits
- [ ] Enable audit logging
- [ ] Test disaster recovery
- [ ] Document runbooks
- [ ] Set up log aggregation
