# GMirror Evaluation Baseline

GMirror evaluation measures whether synthetic-user verdicts identify real product risks, avoid
false confidence, and produce reproducible evidence.

## Corpus Dimensions

| Dimension | Examples |
| --- | --- |
| Happy path | Correct implementation with expected user success. |
| Usability failure | Change compiles but causes user confusion or abandonment. |
| Security/adversarial | Prompt injection, unsafe handling, or policy failure. |
| Regression | Known bad change from historical receipts. |
| Cost/latency | Large panel or scenario set under budget limits. |

## Running Evaluations

```bash
node dist/cli.js eval --corpus ./test/baselines/gmirror-corpus.json --cycles 10 --output ./tmp/eval.json
npm run eval:summary -- --input ./tmp/eval.json
npm run eval:compare -- --baseline ./test/baselines/regression-baselines.jsonl --input ./tmp/eval.json
```

## Acceptance Thresholds

| Metric | Target |
| --- | --- |
| Risk recall | `>= 0.85` on seeded risky changes. |
| False fail rate | `<= 0.10` on known-good changes. |
| Verdict reproducibility | `>= 0.80` same verdict class across cycles. |
| P95 scoring latency | `< 120s` for default panel. |
| Cost per default score | `<= $1.00` unless corpus raises budget. |
| Receipt completeness | `100%` of non-dry-run scores. |

## Baseline Updates

Move baselines only for intentional scoring changes. Include corpus, sample count, confidence
intervals, and changelog context.
