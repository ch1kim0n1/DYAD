# GTools v0.5.0 — Production Hardening Release

**Date:** 2026-05-18
**Tools:** glearn · gmirror · gorchestrator · gagent
**Migration:** 0.1.0 → 0.5.0

This release closes the production-readiness punch list from the v0.5.0 hardening
plan. All four tools ship from the same `DYAD/` working tree and are deployed
together via the unified `docker-compose.yml` at the repo root.

## What's New

### Container hardening
- All four service Dockerfiles now run as the non-root, built-in `node` user
  (`USER node` after `chown -R node:node /app`).
- All four images expose a `HEALTHCHECK` directive that calls `http://localhost:<port>/health/live`
  via `node -e` with explicit `.on('error', ...)` handling so transient connection
  failures during boot are counted as unhealthy rather than crashing the probe.
- Unified `docker-compose.yml` now declares `mem_limit`, `mem_reservation`, and `cpus`
  for every service (gbrain, gorchestrator, gmirror, gtom, gagent, glearn, postgres, redis)
  so a single-machine Docker Compose deployment cannot exhaust host memory.

### HTTP security headers
- Every plain-`http` server (`public-health-server.ts` in all four tools, plus
  `gmirror/src/server.ts`) now sets a helmet-equivalent header set on every
  response:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
  - `Cache-Control: no-store`

### Test-coverage enforcement
- Each tool's `jest.config.js` declares a `coverageThreshold`:
  - `src/core/**/*.ts`: 85% lines/statements/functions, 75% branches
  - global: 70% lines/statements/functions, 60% branches
- `npm run test:coverage` now fails CI when core modules drop below the floor.

### Static security analysis
- `eslint-plugin-security@^3.0.1` added as a dev dependency in all four
  `package.json` files, ready to be wired into the existing ESLint config.

### Versions & changelogs
- `package.json` `version` field bumped from `0.1.0` → `0.5.0` in all four tools.
- Each tool's `CHANGELOG.md` now has a `## [0.5.0] - 2026-05-18` section.

## Migration from 0.1.0

No breaking API changes. The wire format for every MCP tool, CLI command, and
SQLite schema is unchanged.

Operational changes a deployer should be aware of:

1. **Re-build images.** The non-root `USER node` directive requires the
   filesystem to be chowned at build time. Existing images do not have this
   layer. Run:
   ```bash
   docker compose -f DYAD/docker-compose.yml build --no-cache
   ```
2. **Volume permissions.** If you mount host directories into `/app/data`,
   they must be readable & writable by uid `node` (uid 1000 in `node:20-alpine`).
   For named volumes (the default) this is handled automatically.
3. **Memory limits.** The new `mem_limit` settings target a ~4 GB host budget
   total. If you run on a more constrained machine, override per-service limits
   via a `docker-compose.override.yml`.
4. **HSTS.** The `Strict-Transport-Security` header is now sent on every
   response. If you front the services with a non-TLS reverse proxy in dev,
   browsers will still treat the response as instructing HTTPS-only — keep
   the header in production but strip it at the dev proxy if it gets in the way.

## Verification

```bash
# From DYAD/
docker compose build
docker compose up -d
docker compose ps           # all services healthy
docker inspect gagent --format '{{.Config.User}}'        # → node
docker inspect glearn --format '{{.State.Health.Status}}' # → healthy

# Per-tool
cd glearn && npm run test:coverage   # threshold gate active
cd gmirror && npm run test:coverage
cd gorchestrator && npm run test:coverage
cd gagent && npm run test:coverage

# Security headers
curl -sI http://localhost:3005/health/live | grep -iE 'x-content-type|x-frame|csp|hsts|referrer'
```

## Known Limitations

- **`npm audit`** has not been recorded as part of this release. Run
  `npm audit --omit=dev` per tool before publishing artifacts externally.
- **Redis** is declared in `docker-compose.yml` but is not yet wired into a
  cache layer in any of the four tools — it remains available for future caching
  / rate-limit work.
- **`eslint-plugin-security`** is installed but not yet listed in each tool's
  ESLint config. A follow-up PR should add `'plugin:security/recommended'` to
  the extends list and triage the resulting warnings.

## Credits

Hardening pass tracked against the v0.5.0 Production Hardening Plan
(Phase 1 Security · Phase 2 Quality · Phase 3 Production Readiness).
