# GMirror Security Model

GMirror evaluates potentially risky changes and may process sensitive diffs, prompts, and product
flows. Its security goal is to keep verdict evidence auditable while preventing unauthorized
scoring, calibration, or evidence disclosure.

## Trust Boundaries

| Boundary | Risk | Control |
| --- | --- | --- |
| CLI user to local process | Unauthorized scoring, calibration, or unsafe flag values | OS permissions, deployment policy, and validation for endpoint, path, ID, budget, and window flags. |
| MCP client to GMirror | Write-tool abuse | Token authentication, read/write scope checks, token-hash permission grants, and per-token rate limits. |
| GMirror to model providers | Sensitive prompt/diff leakage | Redaction, scoped credentials, minimal payloads. |
| GMirror to persistence | Tampered verdict evidence | SQLite transactions and append-only receipts. |
| GMirror to logs/metrics | Sensitive data leakage | Structured logging and PII redaction. |
| Public health endpoint | Shutdown abuse or endpoint flooding | Bearer-protected shutdown and per-client rate limits. |

## Secrets And Rotation

Secrets must come from the local file-backed secret manager or a deployment secret source. The file
secret manager reads `GMIRROR_SECRET_DIR` or defaults to `~/.gmirror/secrets`; legacy environment
variables are accepted only as a migration fallback. Never commit API keys, database passwords,
webhook URLs, or signing keys.

Use `gmirror secrets rotate <name>` to generate a new value, or pass `--value` when a deployment
system has already generated it. `gmirror secrets list` prints only names, versions, timestamps, and
sources. It never prints secret values.

## MCP Authorization

`gmirror_score` and `gmirror_calibrate` are write tools. Calibration can change release-gate
behavior, so it should require stronger authorization than read-only inspection tools.

Configure MCP auth with `gmirror_mcp_token` in the secret manager. For multi-user deployments, set
`GMIRROR_PERMISSIONS_FILE` to a JSON file containing SHA-256 token hashes:

```json
{
  "tokens": {
    "sha256-token-hex": ["read"],
    "sha256-admin-token-hex": ["read", "write", "admin"]
  }
}
```

The permission file narrows granted scopes; it does not expand bootstrap or issued-token scopes.
Requests that fail authentication, scope checks, or rate limits fail closed.

## Verdict Evidence

Verdicts and receipts can reveal product weaknesses. Store them in access-controlled locations and
ship audit logs to centralized monitoring with retention appropriate for release evidence.

Security-relevant MCP denials and rate-limit events are written to the local JSONL audit stream with
redaction applied before persistence. Receipts are redacted before signing and writing.

## Network Posture

Prefer local or private-service networking. Do not expose GMirror MCP publicly without TLS,
authentication, authorization, rate limits, and request logging.

The health server exposes `/health/live`, `/health/ready`, and `/health/shutdown`. Shutdown requires
the `health_shutdown_token` secret and all health routes share the `GMIRROR_HEALTH_RATE_LIMIT_RPM`
per-client limit.
