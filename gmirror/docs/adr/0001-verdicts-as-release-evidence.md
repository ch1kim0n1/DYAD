# ADR 0001: GMirror Verdicts Are Release Evidence

## Status

Accepted

## Context

GMirror evaluates changes with synthetic users and adversarial scenarios. The output is most useful
when it can be traced, replayed, and compared over time instead of treated as a transient console
message.

## Decision

GMirror persists verdicts, receipts, failure modes, cost data, and drift metrics as release
evidence. CLI and MCP outputs are views over that evidence.

## Consequences

- Release gates can compare current verdicts against historical baselines.
- Operators can inspect failure-mode clusters after the scoring run.
- Storage, migrations, and privacy controls are part of the product surface.
- Generated verdicts must include enough metadata for replay and audit.

## Alternatives Considered

- Console-only verdicts. Rejected because they cannot support regression gates or audit trails.
- Storing only aggregate pass/fail. Rejected because failure-mode debugging requires structured
  persona and scenario evidence.
