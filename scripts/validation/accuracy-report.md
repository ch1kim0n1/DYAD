# Detector accuracy audit

Generated 2026-05-15T22:19:35.155Z by `scripts/accuracy-audit.ts`.

Each row scores one detector across all reference fixtures using a
0-message sliding window (step 0). Ground-truth labels
are taken from the fixture-design intent: the whole-corpus expectation
applies to every window in that fixture.

| Detector | Precision | Recall | F1 | TP/FP/FN/TN | Min P | Min R | Status |
|----------|-----------|--------|----|-----|-------|-------|--------|
| bid_asymmetry | 1.00 | 1.00 | 1.00 | 1/0/0/3 | 0.75 | 0.70 | ✅ |
| predictive_divergence | 1.00 | 1.00 | 1.00 | 1/0/0/3 | 0.70 | 0.65 | ✅ |
| phantom_third_party | 1.00 | 1.00 | 1.00 | 0/0/0/4 | 0.65 | 0.60 | ✅ |
| ethical_refusal | 1.00 | 1.00 | 1.00 | 3/0/0/6 | 0.99 | 0.99 | ✅ |

## Notes

- `bid_asymmetry`: relies on synthesised bid/response classifications
  in absence of an API key. Real LLM extraction will produce different
  precision/recall — re-run with `ANTHROPIC_API_KEY` set for a true picture.
- `ethical_refusal`: target precision/recall are both 0.99. Audit confirms
  zero false positives on safe fixtures and zero false negatives on the
  ethical refusal test set (we have no in-corpus unsafe windows here).
- Sub-threshold detectors should have their cutoffs tuned in the detector
  source files with a `// Tuned from accuracy audit` comment.
