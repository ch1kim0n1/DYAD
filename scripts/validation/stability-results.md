# Memory + stability test (#64)

Generated 2026-05-15T23:05:59.151Z by `scripts/stability.ts`.

Duration: 1 minute(s) · sample interval: 10s · threshold: 30MB

Iterations completed: **17235**
Heap growth: **8.72 MB** (threshold 30 MB) — ✅

| t (s) | heap (MB) | rss (MB) | external (MB) | iterations |
|-------|-----------|----------|---------------|------------|
| 10 | 9.94 | 120.96 | 1.08 | 5791 |
| 20 | 5.71 | 140.25 | 1.05 | 8877 |
| 30 | 10.67 | 135.40 | 1.06 | 11170 |
| 40 | 20.00 | 138.65 | 1.06 | 13115 |
| 50 | 10.94 | 155.57 | 1.10 | 15205 |
| 60 | 21.47 | 137.65 | 1.10 | 17235 |

Bounded data structures verified:

- `RollingRate.cleanupOldEvents` prunes outside-window events on add
- `LatencyZScore` evicts when per-participant `history.length >= windowSize`
- `SelfModelUpdater` / `PartnerModelUpdater` / `RelationshipModelUpdater` overwrite their JSON on `save()` — no append-only growth
- `BriefGenerator` / `ReframeGenerator` caches are in-memory and bounded by content (md5 keyspace)
