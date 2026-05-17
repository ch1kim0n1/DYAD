# Orchestrator Architecture

## System Overview

Orchestrator is a workflow and pipeline management system that coordinates execution across multiple G-Stack tools.

## Core Components

### WorkflowRegistry
- Manages workflow definitions
- Supports workflow versioning
- Enables workflow discovery

### PipelineRegistry
- Manages pipeline configurations
- Links workflows into pipelines
- Supports pipeline templates

### JobRegistry
- Tracks job execution status
- Manages job lifecycle
- Provides job history

### ToolClient
- Manages connections to G-Stack tools
- Handles tool health checks
- Routes requests to appropriate tools

### WorkflowExecutor
- Executes workflows across tools
- Handles step-by-step execution
- Manages error recovery

### Scheduler
- Schedules recurring workflows
- Manages task priorities
- Supports cron-like scheduling

## Database Architecture

Engine abstraction supporting:
- SQLite (default)
- PostgreSQL (production)
- In-memory (testing)

### Schema
- workflows: Workflow definitions
- pipelines: Pipeline configurations
- jobs: Execution records
- schedules: Scheduled tasks

## Data Flow

```
Workflow Definition → Pipeline Creation → Scheduling → Tool Coordination → Job Execution → Result Collection
```

## Security

- OAuth 2.0 authentication
- Tool-level authorization
- Encrypted job data
- Audit trails for all executions

## Performance

- Parallel job execution
- Connection pooling to tools
- Caching of workflow metadata
- Optimized scheduling algorithms

## Tool Integration

Orchestrator integrates with:
- GBrain: Knowledge management
- GLearn: Pattern detection
- GAgent: Autonomous agents
- GMirror: Quality evaluation
- GToM: Security assessment
