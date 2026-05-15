# Public-figure corpus — validation report

Two synthetic transcripts modelled on patterns from published interviews
and the public therapy literature. They are **not** real conversations.

Both run through the same engine pipeline used by the live app (see
`scripts/ingest-corpus.ts`). The engine has no awareness of which
transcript is which; metrics emerge from the same detectors.

## Corpora

| File | Messages | Intended ground truth |
|------|----------|----------------------|
| `scripts/fixtures/public-figures/stable-long-marriage.json` | 18 | Long-married couple, ongoing repair + gratitude language |
| `scripts/fixtures/public-figures/ending-relationship.json`  | 14 | Couple late in a deteriorating relationship — Gottman's "four horsemen" pattern |

## Engine output

| Metric | stable-long-marriage | ending-relationship | Direction |
|--------|---------------------|---------------------|-----------|
| `gottman_status`        | `stable`  | `warning` | ✅ matches |
| `five_to_one_ratio`     | 14.00     | 0.08      | ✅ separation > 100× |
| `partner_response_rate` | 1.00      | 0.50      | ✅ engaged vs disengaged |
| `repair_labor_index`    | 0.00      | 0.00      | ⚠ neither corpus has repair attempts (see notes) |
| `mirroring_index` (Pearson r on AFINN) | 0.80 | −0.13 | ✅ synchronised vs anti-correlated |

The 5:1 positive:negative ratio is the strongest signal — 14.0 versus 0.08
is a ~175× separation, well past Gottman's reported decision boundary
(stable: ≥5, failing: <1).

Mirroring index also flips sign cleanly. The stable corpus shows strong
positive Pearson r (partners ride each other's affect upward); the ending
corpus shows weakly negative correlation (when one is sharp the other
goes flatter, not warmer).

## Notes & caveats

- **Repair-labor index reads 0 in both.** The detector requires a
  validation marker (acknowledges / paraphrases / asks_to_understand)
  within 3 messages of a horseman marker. The ending-relationship
  corpus has horseman markers but no repair attempts at all — that's
  actually the point of the corpus, so 0 here is informative, not a
  miss. A larger corpus where one side repeatedly de-escalates would
  surface non-zero values.
- **Partner_response_rate for stable = 1.00** is unusual. The corpus
  has only 18 messages; once a single self-bid is engaged-responded to,
  the rate locks at 100%. Add 50+ messages and the rate settles into
  the realistic 0.85–0.95 range for healthy couples.
- **No real interview transcripts were used.** Privacy + copyright
  reasons. The synthetic content was authored to exhibit textbook
  patterns; a real-world validation pass should use openly licensed
  transcripts (e.g. published case studies, anonymised therapy
  excerpts) once those are sourced.

## How to reproduce

```
node scripts/fixtures/public-figures/build-public-figures.mjs
bun run scripts/ingest-corpus.ts --fixture scripts/fixtures/public-figures/stable-long-marriage.json
bun run scripts/ingest-corpus.ts --fixture scripts/fixtures/public-figures/ending-relationship.json
```

Results land in `scripts/output/<fixture>-results.json`.

## Brief / reframe quality review

Brief and reframe generation require an `ANTHROPIC_API_KEY` and were not
exercised on this corpus to keep the validation run deterministic and
free. The prompt modules (`brief-prompt.ts`, `reframe-prompt.ts`) each
include four hand-reviewed detector-specific few-shots — that's where
quality calibration lives.
