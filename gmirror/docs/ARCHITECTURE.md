# GMirror Architecture

## System Overview

GMirror is a quality evaluation and assessment system that uses rubrics to evaluate outputs and provide verdicts.

## Core Components

### RubricRegistry
- Manages evaluation rubrics
- Supports weighted criteria
- Enables rubric versioning

### EvaluationRegistry
- Executes evaluations against rubrics
- Scores outputs based on criteria
- Tracks evaluation history

### VerdictRegistry
- Manages evaluation verdicts
- Records approvals/rejections
- Tracks reviewer decisions

### CalibrationManager
- Monitors evaluation accuracy
- Tracks precision/recall metrics
- Ensures consistent scoring

### FailureAnalyzer
- Analyzes failure patterns
- Identifies common failure modes
- Provides improvement recommendations

## Database Architecture

Engine abstraction supporting:
- SQLite (default)
- PostgreSQL (production)
- In-memory (testing)

### Schema
- rubrics: Evaluation criteria
- evaluations: Evaluation results
- verdicts: Approval decisions
- failure_modes: Pattern library

## Data Flow

```
Rubric Selection → Evaluation Execution → Scoring → Verdict Generation → Calibration
```

## Security

- OAuth 2.0 authentication
- Role-based access control
- Audit trails for evaluations
- Verdict approval workflows

## Performance

- Batch evaluation support
- Caching of rubric metadata
- Parallel evaluation execution
- Optimized scoring algorithms
