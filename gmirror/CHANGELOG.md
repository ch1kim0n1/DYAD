# Changelog

All notable changes to GMirror will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Token-based authentication infrastructure for MCP endpoints
- Eval command with --cycles N support for statistical comparison
- Stats and drift CLI commands
- Comprehensive documentation (runbook, contract, eval)
- Production documentation set covering API usage, MCP contracts, migrations, eval baseline,
  troubleshooting, security model, data flow, integration, ADRs, and generated TypeDoc API output.
- `docs:api` script and TypeDoc configuration for regenerating `docs/api`.
- Typed GBrain integration client with HTTP/MCP transports, auth tokens, timeouts, retry backoff,
  circuit breaker behavior, Zod validation, context lookup, scenario corpus loading, replay, analytics,
  and drift QC writes.

### Changed
- Improved error handling and validation
- Enhanced CLI output formatting

## [0.1.0] - 2026-05-13

### Added
- Synthetic user runner, population manager, verdict aggregator, and failure-mode library foundations
- Jest-based unit, CLI, MCP, and behavioral tests
- Quality gates for package contracts, documentation, privacy scanning, test isolation, MCP contracts, and CLI smoke checks
- Eval scripts for local audit history, summary, comparison, and test-tier selection
- MCP server with 4 operations (score, health, failure_modes, calibrate)
- CLI commands: score, calibrate, health, failure-modes, clusters, replay
- Replay functionality for previous scoring runs
- Latency tracking with P50/P95/P99 metrics
- Integration with GBrain for receipt storage and retrieval
