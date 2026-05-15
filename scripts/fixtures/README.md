# Fixture corpora

Three synthetic conversations used by the engine test suite, the ingest
script, and the demo flow.

| File | Messages | Span | Designed signal |
|------|----------|------|-----------------|
| `healthy-couple.json` | 44 | 3 days | Gottman `stable` — high bid response, 5:1 positive:negative, warm tone |
| `bid-asymmetry.json` | 82 | 7 days | Bid asymmetry detected — self bids constantly, partner answers ~30% with task-focused / dismissive replies |
| `predictive-divergence.json` | 26 | 2 days | Predictive divergence — self's affect trends positive (excitement, planning), partner's trends negative (deflection, "I can't") |

All three are generated deterministically by `build-fixtures.mjs`:

```
node scripts/fixtures/build-fixtures.mjs
```

The script seeds counters, timestamps, and content templates so output is
reproducible across machines. Tweaking the arcs and rerunning is the easy
way to evolve the corpus.

## Format

Each file is a `NormalizedMessage[]` array — the same shape the rest of
the engine consumes after the ingestion layer normalises `chat.db`.

## Running through the engine

```
bun run scripts/ingest-corpus.ts --fixture scripts/fixtures/healthy-couple.json
```

Results land in `scripts/output/<fixture>-results.json`.

## Authorship

Hand-authored synthetic dialogue, no real conversations were used. Tone and
patterns are modelled on published examples from Gottman ("Why Marriages
Succeed or Fail", 1994), Sue Johnson ("Hold Me Tight"), and the public
training transcripts in the EFT clinical practice literature.
