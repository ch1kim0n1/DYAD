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
