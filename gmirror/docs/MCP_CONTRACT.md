# GMirror MCP Contract

GMirror exposes synthetic-user scoring and verdict inspection to MCP clients. The server name is
`gmirror`, version `0.1.0`.

## Scopes

| Scope | Tools |
| --- | --- |
| Read | `gmirror_health`, `gmirror_failure_modes`, `gmirror_get_failure_modes`, `gmirror_get_receipts`, `gmirror_get_trend`, `gmirror_get_drift`, `gmirror_get_cost_stats` |
| Write | `gmirror_score`, `gmirror_calibrate` |

## Tools

### `gmirror_score`

Scores a change against a synthetic user panel. Input should include a diff or artifact reference,
panel size, and optional scenario/persona filters.

### `gmirror_health`

Returns local, stack, and persistence health diagnostics.

### `gmirror_failure_modes` and `gmirror_get_failure_modes`

Return known failure modes, optionally filtered by severity, tool, persona, or scenario.

### `gmirror_calibrate`

Runs calibration against a known corpus and updates scoring thresholds when explicitly requested.

### `gmirror_get_receipts`

Returns recent or date-filtered verdict receipts.

### `gmirror_get_trend` and `gmirror_get_drift`

Return trend and drift analyses for verdict metrics.

### `gmirror_get_cost_stats`

Returns budget reservations, committed spend, expired reservations, and remaining budget.

## Error Contract

Validation and authorization errors are not retryable. Upstream network, sandbox, or model-provider
failures may be retryable when marked by the underlying client. Every error should include a
readable message and stable code when possible.

## Contract Checks

```bash
npm run check:mcp-contract
npm test -- test/mcp.test.ts
```
