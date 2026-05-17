# GMirror Migrations

GMirror persists verdicts, receipts, exports, model metrics, and budget state. Migrations must be
forward-only, deterministic, and safe to run before CLI or MCP commands serve requests.

## State Stores

| Store | Default location | Contents |
| --- | --- | --- |
| SQLite | `~/.gmirror/gmirror.db` or `GMIRROR_DB_PATH` | Verdicts, exports, LLM calls, cost entries, budget reservations, schema version. |
| Receipts | Runtime receipt directory or test baselines | Verdict receipts and regression evidence. |
| Audit logs | `~/.gmirror/audit/*.jsonl` unless overridden | Decisions, shell jobs, health events. |

## Migration Rules

1. Add SQL migrations under `src/core/migrations/NNN_description.sql`.
2. Do not edit shipped migrations; add corrective migrations.
3. Use idempotent DDL where possible.
4. Add tests that open a temporary database and verify the new schema.
5. Document operator-facing effects in `CHANGELOG.md`.

## Current Migrations

| Version | File | Purpose |
| --- | --- | --- |
| 1 | `001_verdict_persistence.sql` | Persistent verdict and receipt state. |
| 2 | `002_verdict_exports.sql` | Verdict export metadata and related state. |

## Applying Migrations

```bash
npm run build
node dist/cli.js health
npm run verify
```

Take a backup before production schema changes:

```bash
gmirror backup ./backups/gmirror-before-migration
```
