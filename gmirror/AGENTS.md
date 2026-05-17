# Agent Guidance for GMirror

GMirror is the synthetic user testing and verdict layer for the G-Stack. Agents should keep verdict logic calibrated, explainable, and deterministic in tests.

## Rules

- Preserve MCP tool names and schemas unless intentionally changing public contracts.
- Update tests and docs for all public behavior changes.
- Keep synthetic user tests side-effect free.
- Run `npm run verify` after edits.
- Run `npm run ci:local` before release-level changes.

## Contract Surfaces

- CLI: `src/cli.ts`
- MCP: `src/mcp/server.ts`
- Synthetic runner: `src/core/runner.ts`
- Verdict aggregation: `src/core/verdict.ts`
- Failure modes: `src/core/failure-mode.ts`
