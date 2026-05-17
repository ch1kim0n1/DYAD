# GMirror Data Flow

```mermaid
flowchart LR
  Client["CLI or MCP client"] --> Request["Score request validation"]
  Request --> Population["PopulationManager"]
  Request --> Scenarios["Scenario and failure-mode selection"]
  Population --> Runner["SyntheticUserRunner"]
  Scenarios --> Runner
  Runner --> Verdict["VerdictAggregator"]
  Verdict --> Failure["Failure-mode analyzer"]
  Verdict --> SQLite["VerdictPersistenceManager"]
  Verdict --> Receipts["ReceiptRegistry JSONL append"]
  Verdict --> GBrain["Optional GBrain receipt write"]
  Verdict --> Metrics["Metrics and drift snapshots"]
  Metrics --> Prometheus["Prometheus text"]
  Metrics --> OTel["OpenTelemetry JSON"]
  Verdict --> Audit["Decision and shell-job audit JSONL"]
```

## Data Classes

| Data | Source | Destination | Sensitivity |
| --- | --- | --- | --- |
| Diff/change payload | CLI/MCP caller | Runner, verdict, receipt metadata | Potentially sensitive. |
| Synthetic user results | Runner | Verdict, failure analyzer | Operational evidence. |
| Verdicts | Aggregator | SQLite, receipts, MCP/CLI output | Release evidence. |
| Failure modes | Analyzer | Library, clusters, receipts | Product-risk evidence. |
| Cost data | LLM client | Budget ledger, metrics | Operational. |
| Audit events | GMirror decisions | JSONL audit logs | Operational, possibly sensitive. |
