# Demo rehearsal log (#71)

One row per rehearsal pass. Two runs minimum before the real demo.

## Pre-flight (T-48h)

- [ ] Pre-warm cache on demo machine (`bun run scripts/prewarm-demo.ts …`)
- [ ] `bun run --cwd apps/mac tauri:dev` launches without errors
- [ ] `bun run --cwd apps/mac tauri:build` produces a clean bundle
- [ ] WiFi failover plan (phone hotspot tested) ✅ / ⚠ / ✗
- [ ] Backup device tested per `absolute-docs/backup-device-setup.md` ✅ / ⚠ / ✗

## Narrative (target 5–7 minutes)

| Beat | Time | Notes |
|------|------|-------|
| Hook — "Most relationship advice is generic" | 0:00–0:30 |  |
| The Map — emotional terrain | 0:30–2:00 |  |
| Detection fires — read the brief aloud | 2:00–3:00 |  |
| The reframe — "this is the compassion layer" | 3:00–4:00 |  |
| The Atlas — Gottman status + bid rates | 4:00–5:00 |  |
| The Mirror — your patterns, not judgement | 5:00–6:00 |  |
| Close — "relational intelligence in your pocket" | 6:00–6:30 |  |

## Rehearsal table

| Date / time | Operator | Audience proxy | Duration | Crashes? | Loading >5s? | Tone issues? | Notes |
|-------------|----------|----------------|----------|----------|--------------|--------------|-------|
|             |          |                |          |          |              |              |       |
|             |          |                |          |          |              |              |       |

## Hard-stop criteria — abort the demo if any fail

- [ ] App crashes during narrative
- [ ] Any loading spinner > 5 seconds
- [ ] Brief / reframe contains clinical / blaming language
- [ ] Gottman status renders with wrong colour
- [ ] CrisisOverlay does not block the UI when triggered

## Sign-off

Two rehearsals complete, no hard-stop hits:

- Rehearsal #1 — ____________________ (date / signoff)
- Rehearsal #2 — ____________________ (date / signoff)

Demo go / no-go: ___ (filled at T-2h)
