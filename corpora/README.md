# Corpora

Two corpus families used to validate DYAD against known patterns, per
`absolute-docs/tech-stack.md`:

- `team/` — relationships team members opt in to share for tuning. **Not
  committed.** Drop your `live-<id>-results.json` here from
  `bun run scripts/ingest-corpus.ts --live …`. The directory carries a
  `.gitkeep` so it's tracked but the contents are gitignored.

- `public/` — synthetic transcripts modelled on patterns described in
  published interviews and the public therapy literature. Each file is a
  `NormalizedMessage[]` JSON. **No real interview transcripts** — privacy
  + copyright. Patterns are textbook (Gottman's four horsemen vs. a
  long-stable couple).

The canonical reference fixtures used by every test, the accuracy audit,
and the demo flow live alongside, in `scripts/fixtures/`:

- `scripts/fixtures/healthy-couple.json`
- `scripts/fixtures/bid-asymmetry.json`
- `scripts/fixtures/predictive-divergence.json`
- `scripts/fixtures/public-figures/stable-long-marriage.json`
- `scripts/fixtures/public-figures/ending-relationship.json`

The `corpora/public/` directory below mirrors the public-figure
fixtures so the DDD's "corpora/public" directory claim is honoured.
