# GMirror API Overview

Regenerate browsable TypeScript docs:

```bash
npm run docs:api
```

Generated output is committed under `docs/api`.

## CLI API

| Command | Inputs | Output |
| --- | --- | --- |
| `gmirror score` | Diff/change payload, panel size, persona/scenario options | Verdict and receipt. |
| `gmirror calibrate` | Calibration corpus and thresholds | Updated calibration report. |
| `gmirror health` | Endpoint/environment config | Health rows and score. |
| `gmirror replay` | Previous receipt or run id | Replayed verdict. |
| `gmirror failure-modes` | Filters and limit | Failure-mode list. |
| `gmirror stats`, `trend`, `drift`, `regress` | Metric and time filters | Quality and drift reports. |
| `gmirror cost`, `sandbox-stats`, `metrics` | Detail/format options | Budget, sandbox, and observability output. |

## TypeScript API

Primary classes and modules:

- `GMirror` in `src/core/gmirror.ts`: scoring, health, receipts, drift, and observability.
- `SyntheticUserRunner` in `src/core/runner.ts`: executes scenarios against synthetic users.
- `PopulationManager` in `src/core/population.ts`: synthetic user population construction.
- `VerdictAggregator` in `src/core/verdict.ts`: aggregate outcomes into verdicts.
- `FailureModeLibrary` and analyzer modules: failure pattern storage and extraction.
- `VerdictPersistenceManager` in `src/core/verdict-persistence.ts`: SQLite state.
- `ReceiptRegistry` and `BudgetLedger`: evidence and cost accounting.

## Verdict Contract

Verdicts include:

- Overall verdict: `pass`, `pass_with_warnings`, `risky`, or `fail`.
- Correctness, user outcome, risk, cost, and confidence dimensions.
- Failure modes with severity and affected personas/scenarios.
- Cost, token usage, model usage, and latency metadata.
- Receipt hashes for reproducibility.

## Compatibility

Existing CLI flags, MCP names, and required input fields are stable within a major version. Minor
versions may add optional fields.
