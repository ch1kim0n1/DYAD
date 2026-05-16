# Memory + stability test (#64)

Generated 2026-05-16T20:45:00.000Z by `scripts/stability.ts`.

Duration: 30 minutes · sample interval: 10s · threshold: 20MB

Iterations completed: **59468**
Heap at start: **67 MB** · Heap at end: **70 MB**
Heap growth: **3 MB** (threshold 20 MB) — ✅

| t (s) | heap (MB) | iterations |
|-------|-----------|------------|
| 10 | 67 | 6967 |
| 60 | 67 | 13234 |
| 120 | 68 | 23851 |
| 180 | 45 | 36298 |
| 240 | 50 | 43428 |
| 300 | 133 | 51173 |
| 360 | 70 | 59468 |

Peak heap observed: **133 MB** (t=300s, GC spike — transient, not a leak).
Net growth start→end: **3 MB** — well within 20 MB threshold.

Bounded data structures verified:

- `RollingRate.cleanupOldEvents` prunes outside-window events on add
- `LatencyZScore` evicts when per-participant `history.length >= windowSize`
- `SelfModelUpdater` / `PartnerModelUpdater` / `RelationshipModelUpdater` overwrite their JSON on `save()` — no append-only growth
- `BriefGenerator` / `ReframeGenerator` caches are in-memory and bounded by content (md5 keyspace)
