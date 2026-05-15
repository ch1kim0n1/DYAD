# Pre-release checklist (#75)

**One file. One blocking gate.** Every box must be ticked before DYAD is
shown to anyone outside the team. Reviewed by two team members; both
sign at the bottom.

## Foundation
- [ ] `bun test packages apps scripts` — zero failures
- [ ] `bunx tsc --noEmit` — exit 0 from repo root
- [ ] `bun run scripts/validation/smoke-test.ts` — 4/4 pass
- [ ] `.env.example` matches the env actually used in code
- [ ] No `console.error` or unhandled rejection during a 5-minute session

## Accuracy
- [ ] `bun run scripts/accuracy-audit.ts` — all detectors meet minimums
      (see `scripts/validation/accuracy-report.md`)
- [ ] `bun run scripts/calibrate-thresholds.ts` — 2-4 detections per 7-day window
      (see `scripts/validation/calibration-report.md`)
- [ ] Ethical refusal: zero false negatives on safety test set
- [ ] `bun run scripts/validation/tone-audit.ts` — no harmful patterns

## Performance
- [ ] `bun run scripts/benchmark.ts` — all P95 targets hit
      (see `scripts/validation/benchmark-results.md`)
- [ ] `bun run scripts/stability.ts --minutes 30` — heap growth < 20MB
      (see `scripts/validation/stability-results.md`)
- [ ] Cold start to first render < 3 seconds on demo machine
- [ ] Cache pre-warmed via `bun run scripts/prewarm-demo.ts`

## Security
- [ ] `grep -r "sk-ant-" .` returns zero matches
- [ ] Sidecar binds to `127.0.0.1` (verify with `lsof -iTCP:7432 -sTCP:LISTEN -P`)
- [ ] `~/.dyad/` mode is `0700`, files inside are `0600`
- [ ] `.env` is git-ignored
- [ ] `docs/SECURITY.md` reviewed; no item flagged ⚠

## UX
- [ ] All user-facing error strings run through `friendlyError()` (no raw `EPERM`)
- [ ] Offline / degraded mode shows the `OfflineBadge`
- [ ] First-run onboarding completes in < 5 minutes by someone unfamiliar
      with the app
- [ ] UI screenshots captured at 1200×800, 1440×900, 1920×1080, 2560×1440
      (`scripts/validation/ui-screenshots/`)

## Demo readiness
- [ ] Full demo rehearsal complete twice with no hard-stop hits
      (`absolute-docs/demo-rehearsal-log.md`)
- [ ] Demo runs 5–7 minutes end-to-end
- [ ] Backup device tested within last 24h
      (`absolute-docs/backup-device-setup.md`)
- [ ] Adversarial test set runs clean
      (`scripts/validation/adversarial-test-results.md`)
- [ ] CrisisOverlay verified on synthetic unsafe input

## Distribution (if shipping a build)
- [ ] App signed with valid Developer ID Application certificate
- [ ] App notarized — `spctl -a -vv DYAD.app` shows "accepted"
- [ ] DMG branded (background, drag-to-Applications layout)
- [ ] Icon visible in macOS dock, DMG, and Full Disk Access dialog
- [ ] `docs/RELEASING.md` followed end-to-end

## Sign-off

| | Name | Date | OK |
|-|------|------|----|
| Reviewer 1 |  |  | ☐ |
| Reviewer 2 |  |  | ☐ |

**This issue blocks the demo. Do not close it until both signatures are in.**
