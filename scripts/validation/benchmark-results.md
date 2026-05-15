# Performance benchmark (#62)

Generated 2026-05-15T23:19:12.560Z by `scripts/benchmark.ts` on `win32 x64`.

Args: messages=100, runs=5, with-llm=false

| Operation | Runs | Mean (ms) | P50 (ms) | P95 (ms) | Target | Status |
|-----------|------|-----------|----------|----------|--------|--------|
| L1 extraction (100 messages) | 5 | 1.92 | 1.35 | 4.46 | < 500ms | ✅ |
| bid-asymmetry detector | 5 | 0.08 | 0.05 | 0.23 | < 100ms | ✅ |
| predictive-divergence detector | 5 | 0.12 | 0.08 | 0.31 | < 100ms | ✅ |
| phantom-third-party detector | 5 | 0.03 | 0.01 | 0.10 | < 100ms | ✅ |
| ethical refusal (fast path) | 5 | 0.11 | 0.02 | 0.47 | < 100ms | ✅ |
| full orchestrator (no LLM) | 5 | 1.80 | 1.45 | 3.42 | < 500ms | ✅ |
| L2 extraction | 0 | 0.00 | 0.00 | 0.00 | < 15000ms | ✅ |
| brief generation | 0 | 0.00 | 0.00 | 0.00 | — skipped (no ANTHROPIC_API_KEY) | ✅ |

## Notes

- L1 + detector benches use synthesised feature vectors so they run
  without an API key. Latency is dominated by lexicon lookups + array
  reductions, not network.
- L2 / brief benches run only when `--with-llm` is set and a real
  ANTHROPIC_API_KEY is present.
