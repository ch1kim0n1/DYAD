# GMirror Contract

## Service Contract
GMirror provides synthetic user testing capabilities through multiple interfaces: CLI, REST API, and MCP.

## Interface Definitions

### CLI Interface

#### score
**Command:** `gmirror score [options]`

**Input:**
```json
{
  "payload_file": "string (path)",
  "json": "boolean",
  "output": "string (path)"
}
```

**Output:**
```json
{
  "overall": "pass|fail",
  "scores": {
    "correctness": { "score": 0.0-1.0 },
    "user_outcome": { "score": 0.0-1.0 },
    "risk": { "score": 0.0-1.0 }
  },
  "cost_breakdown": {
    "total_cost_usd": "number"
  },
  "latency_ms": "number"
}
```

**Error Conditions:**
- Invalid payload file → Exit code 1, error message
- Missing required fields → Exit code 1, validation error
- GBrain connection failure → Exit code 1, connection error

#### calibrate
**Command:** `gmirror calibrate`

**Input:** None

**Output:** Calibration status message

**Error Conditions:**
- Insufficient analytics data → Warning message
- GBrain connection failure → Exit code 1

#### health
**Command:** `gmirror health [options]`

**Input:**
```json
{
  "gbrain": "string (url, default: http://localhost:3000)"
}
```

**Output:**
```
GMirror Health Check
Status: healthy|degraded
Components:
  Population Manager: ✓|✗
  Synthetic User Runner: ✓|✗
  GBrain: ✓|✗
```

**Exit Codes:** 0 (healthy), 1 (unhealthy)

### REST API Interface

#### POST /api/score
**Request:**
```json
{
  "request_id": "string",
  "mode": "change|pre_build|shadow",
  "payload": "object",
  "context": "object",
  "budget": {
    "max_cost_usd": "number",
    "max_latency_ms": "number",
    "max_panel_size": "number"
  },
  "caller": {
    "source": "string",
    "ref": "string"
  }
}
```

**Response:** 200 OK
```json
{
  "overall": "pass|fail",
  "scores": { /* as above */ },
  "cost_breakdown": { /* as above */ },
  "latency_ms": "number"
}
```

**Error Responses:**
- 400 Bad Request: Invalid input
- 500 Internal Server Error: Processing failure

#### GET /api/health
**Response:** 200 OK
```json
{
  "status": "healthy|degraded",
  "components": {
    "population_manager": "ok|error",
    "synthetic_user_runner": "ok|error",
    "gbrain": "ok|error"
  }
}
```

### MCP Interface

#### gmirror_score
**Input:**
```json
{
  "payload": "object",
  "panelSize": "number (default: 10)",
  "mode": "string (default: change)"
}
```

**Output:** Verdict object (same as REST API)

#### gmirror_health
**Input:** `{}`

**Output:** Health status object

#### gmirror_failure_modes
**Input:** `{}`

**Output:**
```json
{
  "failure_modes": [
    {
      "severity": "high|medium|low",
      "description": "string",
      "trigger_pattern": "string",
      "observation_count": "number"
    }
  ]
}
```

#### gmirror_calibrate
**Input:** `{}`

**Output:** Calibration status

## Data Contracts

### TestRequest
```typescript
interface TestRequest {
  request_id: string;
  mode: 'change' | 'pre_build' | 'shadow';
  payload: Record<string, any>;
  context: Record<string, any>;
  budget: {
    max_cost_usd: number;
    max_latency_ms: number;
    max_panel_size: number;
  };
  caller: {
    source: string;
    ref: string;
  };
  created_at: string;
}
```

### ScopeBundle
```typescript
interface ScopeBundle {
  request_id: string;
  population_filter: {
    persona_labels: string[];
    expertise_domains: string[];
    trust_range: [number, number];
  };
  scenario_set: string[];
  red_team_set: string[];
  scoring_profile: string;
  panel_size: number;
}
```

### Verdict
```typescript
interface Verdict {
  overall: 'pass' | 'fail';
  scores: {
    correctness: { score: number; reasoning: string };
    user_outcome: { score: number; reasoning: string };
    risk: { score: number; reasoning: string };
  };
  cost_breakdown: {
    total_cost_usd: number;
    by_model: Record<string, number>;
  };
  latency_ms: number;
}
```

## SLA Guarantees

### Performance
- **P50 Latency:** < 5s for panel size ≤ 10
- **P95 Latency:** < 15s for panel size ≤ 10
- **P99 Latency:** < 30s for panel size ≤ 10
- **Availability:** 99% uptime

### Accuracy
- **False Positive Rate:** < 10% (changes incorrectly marked as fail)
- **False Negative Rate:** < 5% (changes incorrectly marked as pass)
- **Population Coverage:** ≥ 90% of user segments represented

### Cost
- **Maximum Cost per Evaluation:** $0.10 (default panel size)
- **Cost Transparency:** Full cost breakdown provided

## Error Handling

### Retry Policy
- Transient errors: Up to 3 retries with exponential backoff
- GBrain connection failures: Immediate failure (no retry)
- LLM API failures: Retry with different model tier if available

### Fallback Behavior
- If population calibration fails: Use default population
- If scenario generation fails: Use pre-defined scenarios
- If scoring fails: Return conservative verdict (fail)

## Versioning

### API Versioning
- Current version: v1
- Path prefix: `/api/v1/`
- Backward compatibility: Guaranteed within major version

### Deprecation Policy
- 6 months notice before deprecation
- Deprecation warnings in response headers
- Migration guides provided

## Security

### Authentication
- CLI: No authentication (local execution)
- REST API: API key required (header: `X-API-Key`)
- MCP: Token-based authentication (Tier 4-5)

### Authorization
- Read operations: Any authenticated user
- Write operations (calibration): Admin role required
- Rate limiting: 100 requests/minute per API key

### Data Privacy
- Payload data not persisted beyond evaluation
- Synthetic user profiles anonymized
- Audit logs retained for 30 days
