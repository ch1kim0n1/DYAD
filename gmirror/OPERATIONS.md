# GMirror Operations Guide

## Deployment

### Prerequisites
- Node.js >= 18
- LLM endpoint (Ollama or compatible)

### Installation
```bash
npm install
npm run build
npm link
```

### Deployment Methods

#### Docker Compose
```bash
# Build and start with Docker Compose
docker-compose up -d gmirror

# View logs
docker-compose logs -f gmirror

# Stop
docker-compose down
```

#### Kubernetes with Helm
```bash
# Install chart
helm install gmirror ./helm/gmirror --namespace gstack --create-namespace

# Upgrade
helm upgrade gmirror ./helm/gmirror --namespace gstack

# Rollback
helm rollback gmirror --namespace gstack

# Uninstall
helm uninstall gmirror --namespace gstack
```

#### Systemd (Bare Metal)
```bash
# Create user and directories
sudo useradd -r -s /bin/false gmirror
sudo mkdir -p /opt/gmirror /var/lib/gmirror /var/log/gmirror /etc/gmirror
sudo chown -R gmirror:gmirror /opt/gmirror /var/lib/gmirror /var/log/gmirror

# Copy files
sudo cp -r dist/* /opt/gmirror/
sudo cp deploy/systemd/gmirror.service /etc/systemd/system/
sudo cp .env.example /etc/gmirror/gmirror.env
# Edit /etc/gmirror/gmirror.env with actual values

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable gmirror
sudo systemctl start gmirror

# Check status
sudo systemctl status gmirror
sudo journalctl -u gmirror -f
```

### Rollback Procedures

#### Kubernetes
```bash
# View revision history
helm history gmirror --namespace gstack

# Rollback to previous version
helm rollback gmirror --namespace gstack

# Rollback to specific revision
helm rollback gmirror <revision> --namespace gstack
```

#### Docker Compose
```bash
# Rebuild with previous image tag
docker-compose down
docker-compose up -d --build gmirror
```

#### Systemd
```bash
# Stop service
sudo systemctl stop gmirror

# Restore previous build
sudo cp -r /opt/gmirror.backup/* /opt/gmirror/

# Restart
sudo systemctl start gmirror
```

### Configuration
Create `~/.gmirror/config.json`:

```json
{
  "model": {
    "endpoint": "http://localhost:11434"
  },
  "population": {
    "defaultPanelSize": 10
  },
  "scoring": {
    "correctnessThreshold": 0.8
  }
}
```

## Running

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
gmirror score-change --diff ./my-diff.patch
```

### MCP Server Mode
```bash
gmirror mcp
```

## Monitoring

### Health Checks
```bash
gmirror health
```

### Service Level Objectives (SLOs)

#### P95 Latency
- Score operation: 2s
- Health check: 100ms

#### Error Rate
- Score operation: < 2% (LLM provider errors)
- Health check: < 0.1%

#### Uptime
- Monthly: 99.5%
- Quarterly: 99.9%

#### Alert Thresholds
- P95 latency > 5s for 5 minutes
- Error rate > 10% for 5 minutes
- Health check failure for 1 minute

Checks:
- Model endpoint connectivity
- Population status
- Recent verdict distribution

### Metrics to Track
- Average verdict correctness
- Average user outcome
- Failure mode frequency
- Cost per test
- Panel utilization

## Troubleshooting

### Model Unavailable
- Check LLM endpoint status
- Verify endpoint URL in config
- Test with simple prompt

### High Failure Rates
- Review panel composition
- Check scenario generation
- Verify task descriptions are clear

### Slow Performance
- Reduce panel size
- Optimize scenario complexity
- Check model endpoint latency

## Maintenance

### Cleanup
```bash
# Archive old verdicts (via GBrain)
# Prune failure-mode library
```

### Updates
```bash
npm install
npm run build
```

## Backup

Test verdicts and failure modes are stored in GBrain. Backup GBrain according to its operational guide.
