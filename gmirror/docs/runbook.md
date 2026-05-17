# GMirror Runbook

## Daily Checks

```bash
npm run verify
node dist/cli.js health
node dist/cli.js metrics --format prometheus
node dist/cli.js cost
```

Review health score, recent risky/fail verdicts, budget state, and GBrain circuit-breaker events.

## Score A Change

```bash
node dist/cli.js score --diff ./change.patch --panel-size 10
```

Expected result:

- Synthetic population is selected.
- Scenarios run or degrade with structured errors.
- Verdict is aggregated.
- Failure modes are extracted.
- Receipt and SQLite state are written.
- Metrics and audit logs are emitted.

## Review Failure Modes

```bash
node dist/cli.js failure-modes
node dist/cli.js clusters
node dist/cli.js trend
```

Use clustered failure modes to decide whether a change needs product work, prompt work, or test
coverage expansion.

## Backup And Restore

```bash
node dist/cli.js backup ./backups/gmirror-$(date +%Y%m%d)
node dist/cli.js restore ./backups/gmirror-20260515
```

After restore, run `health`, `receipts`, and `failure-modes`.

## Release Checklist

1. `npm run verify`
2. `npm run build`
3. `npm run docs:api`
4. `git diff --check`
5. Confirm README, changelog, and generated API docs match behavior.
6. Push to `master`.

## Incident Response

| Symptom | Action |
| --- | --- |
| False passes | Inspect panel composition, risk thresholds, and seeded risky corpus. |
| False fails | Inspect scenario realism and failure-mode severity mapping. |
| High cost | Reduce panel size or adversarial ratio, then inspect `gmirror cost`. |
| Sandbox failures | Check sandbox diagnostics and `sandbox-stats`. |
| GBrain write failures | Check `GBRAIN_ENDPOINT` and circuit-breaker logs. |
| Receipts missing | Check receipt directory permissions and disk space. |
