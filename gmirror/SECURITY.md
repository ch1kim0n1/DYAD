# GMirror Security

GMirror simulates user behavior and scores product or code changes. It must avoid leaking sensitive payloads and must not treat synthetic verdicts as authorization decisions.

## Principles

- Do not hardcode model credentials, tokens, private endpoints, or secrets.
- Treat test payloads and run records as sensitive product data.
- Keep synthetic user outputs deterministic where possible and clearly marked as simulated.
- Fail closed on malformed verdict, failure-mode, or MCP contracts.
- Do not allow synthetic users to trigger real external side effects during tests.

## Checks

Run:

```bash
npm run check:privacy
npm run check:mcp-contract
npm run verify
```

Before release, run `npm run ci:local` to include build and CLI smoke checks.

## Secret Rotation

Rotate secrets regularly using the CLI:

```bash
# Rotate auth secret used for JWT token signing
gmirror secrets rotate gmirror_auth_secret

# Rotate MCP bootstrap token
gmirror secrets rotate gmirror_mcp_token

# Rotate health shutdown token
gmirror secrets rotate health_shutdown_token

# List all secrets
gmirror secrets list
```

Secrets are stored in `GMIRROR_SECRET_DIR` (default: `~/.gmirror/secrets/`). Each rotation increments the version and records the timestamp. Rotate auth secrets:
- Immediately if compromised or suspected compromise
- On a regular schedule (e.g., quarterly) for production deployments
- Before deploying to new environments

After rotating `gmirror_auth_secret`, restart the MCP server to use the new signing key. After rotating `gmirror_mcp_token`, update any clients using the bootstrap token.
