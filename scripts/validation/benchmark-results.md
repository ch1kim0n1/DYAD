# Performance benchmark (#62)

Generated 2026-05-16T20:44:51.271Z by `scripts/benchmark.ts` on `darwin arm64`.

Args: messages=100, runs=5, with-llm=false

| Operation | Runs | Mean (ms) | P50 (ms) | P95 (ms) | Target | Status |
|-----------|------|-----------|----------|----------|--------|--------|
| L1 extraction (100 messages) | 5 | 9.56 | 5.66 | 16.26 | < 500ms | ✅ |
| bid-asymmetry detector | 5 | 0.10 | 0.06 | 0.28 | < 100ms | ✅ |
| predictive-divergence detector | 5 | 0.14 | 0.11 | 0.28 | < 100ms | ✅ |
| phantom-third-party detector | 5 | 0.04 | 0.02 | 0.12 | < 100ms | ✅ |
| ethical refusal (fast path) | 5 | 0.09 | 0.01 | 0.40 | < 100ms | ✅ |
| full orchestrator (no LLM) | 5 | 1.06 | 0.49 | 3.24 | < 500ms | ✅ |
| L2 extraction | 0 | 0.00 | 0.00 | 0.00 | < 15000ms | ✅ |
| brief generation | 0 | 0.00 | 0.00 | 0.00 | — skipped (no ANTHROPIC_API_KEY) | ✅ |

## Notes

- L1 + detector benches use synthesised feature vectors so they run
  without an API key. Latency is dominated by lexicon lookups + array
  reductions, not network.
- L2 / brief benches run only when `--with-llm` is set and a real
  ANTHROPIC_API_KEY is present.
