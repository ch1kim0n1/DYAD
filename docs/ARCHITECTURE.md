# Architecture and Design Documentation

This document describes the architecture and design principles of the G-Stack tools.

## System Overview

The G-Stack consists of four core tools that work together to provide an intelligent code execution and learning platform:

- **GOrchestrator**: Parallel execution manager with sandbox isolation
- **GAgent**: Pipeline orchestration for task execution
- **GLearn**: Meta-learning layer for pattern mining and proposal generation
- **GMirror**: Synthetic user testing and verdict layer

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  (CLI, MCP, HTTP API, IDE Extensions)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      GAgent (Pipeline)                        │
│  - Task decomposition                                        │
│  - Tool orchestration                                        │
│  - Progress tracking                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────┐
│ GOrchestrator│ │ GLearn   │ │  GMirror    │
│              │ │          │ │             │
│ - Sandbox    │ │ - Pattern│ │ - Synthetic │
│   Pool       │ │   Mining │ │   Testing   │
│ - Execution  │ │ - Propos│ │ - Verdict   │
│   Manager    │ │   als    │ │   Aggregatn │
└──────┬───────┘ └──┬───────┘ └──┬──────────┘
       │            │            │
       └────────────┼────────────┘
                    │
       ┌────────────▼────────────┐
       │      GBrain (Knowledge)  │
       │                          │
       │ - Vector Store           │
       │ - Semantic Search        │
       │ - Context Retrieval      │
       └──────────────────────────┘
```

## Component Design

### GOrchestrator

**Purpose**: Manage parallel task execution in isolated sandbox environments.

**Key Components**:
- **SandboxPoolManager**: Manages sandbox lifecycle, concurrency limits, and resource allocation
- **Selector**: Determines optimal execution strategy based on task characteristics
- **Sampler**: Manages sampling strategies for diverse test generation
- **Orchestrator**: Coordinates parallel execution across multiple sandboxes

**Design Principles**:
- Isolation: Each task runs in a separate sandbox
- Determinism: Mock mode provides consistent results
- Observability: All operations are logged and traced
- Resource bounds: CPU, memory, and time limits enforced

**Data Flow**:
```
Task Input → Selector → Sampler → Orchestrator → Sandbox Pool → Results
```

### GAgent

**Purpose**: Orchestrate complex pipelines across multiple tools.

**Key Components**:
- **Pipeline Orchestrator**: Manages multi-step pipeline execution
- **Tool Registry**: Maintains available tools and their capabilities
- **Receipt Registry**: Tracks execution receipts for audit and replay
- **Health Checker**: Monitors system health and tool availability

**Design Principles**:
- Composition: Pipelines compose multiple tools
- Verification: Optional verification step for quality assurance
- Budget awareness: Tracks and enforces budget limits
- Progress streaming: Real-time progress updates

**Data Flow**:
```
Task → Pipeline Orchestrator → Tool Registry → Tool Execution → Receipt → Results
```

### GLearn

**Purpose**: Learn from execution patterns to generate improvement proposals.

**Key Components**:
- **Pattern Miner**: Identifies recurring patterns in code and execution
- **Proposal Generator**: Creates actionable improvement proposals
- **Counterfactual Evaluator**: Evaluates potential changes before application
- **Receipt Registry**: Stores learning receipts for traceability

**Design Principles**:
- Advisory: Proposals are suggestions, not automatic changes
- Evidence-based: All proposals grounded in execution data
- Reversible: Changes can be rolled back
- Confidence scoring: Proposals include confidence levels

**Data Flow**:
```
Execution Data → Pattern Miner → Proposal Generator → Counterfactual Evaluator → Proposals
```

### GMirror

**Purpose**: Provide synthetic user testing and quality verdicts.

**Key Components**:
- **Population**: Manages synthetic user personas and test cases
- **Runner**: Executes synthetic tests in sandbox environments
- **Verdict Aggregator**: Aggregates test results into quality scores
- **Failure Mode Analyzer**: Identifies and categorizes failure patterns

**Design Principles**:
- Calibrated: Synthetic users calibrated against real behavior
- Explainable: Verdicts include reasoning
- Deterministic: Tests produce consistent results
- Multi-dimensional: Evaluates across multiple rubrics

**Data Flow**:
```
Code Change → Population → Runner → Verdict Aggregator → Quality Score
```

## Shared Infrastructure

### Configuration Management

**Location**: `shared/src/config/config-manager.ts`

**Features**:
- Environment variable validation using Zod schemas
- Tool-specific configuration schemas
- Startup validation with production checks
- Hot-reload support for configuration changes
- Configuration migration between versions

### Resilience Patterns

**Location**: `shared/src/core/resilience.ts`

**Features**:
- Retry logic with exponential backoff
- Circuit breaker for external service calls
- Timeout wrappers for all network operations
- Graceful degradation with fallback values

### Observability

**Location**: `shared/src/core/observability.ts` (per-tool implementations)

**Features**:
- Structured JSON logging
- PII redaction patterns
- Audit trail for state-changing operations
- Request ID tracking for distributed tracing
- Log rotation with retention policies

### Error Handling

**Location**: `src/core/errors.ts` (per-tool implementations)

**Features**:
- Standardized error responses with HTTP status codes
- Error classification (recoverable, fatal, transient)
- Structured error output with toJSON method
- Tool-specific error types

## Data Models

### Sandbox

```typescript
interface Sandbox {
  sandbox_id: string;
  config: SandboxConfig;
  state: SandboxState;
  attempt_id: string;
  created_at: string;
  started_at?: string;
  error_message?: string;
}
```

### Receipt

```typescript
interface Receipt {
  receipt_id: string;
  attempt_id: string;
  task: string;
  result: any;
  cost_usd: number;
  timestamp: string;
}
```

### Proposal

```typescript
interface Proposal {
  proposal_id: string;
  pattern_id: string;
  description: string;
  confidence: number;
  evidence: any[];
  status: 'pending' | 'approved' | 'rejected';
}
```

### Verdict

```typescript
interface Verdict {
  verdict_id: string;
  rubric: string;
  score: number;
  reasoning: string;
  failure_modes: string[];
}
```

## Security Architecture

### Authentication

- MCP authentication with bearer tokens
- Per-token rate limiting
- Permission hash file support for callers
- Scope-based access control (read/write)

### Authorization

- Tool-level scope enforcement
- Operation-level permission checks
- Audit logging of all authorization decisions

### Input Validation

- Zod schema validation for all MCP tool inputs
- Shell argument sanitization for Docker commands
- Path traversal protection in file operations
- Request size limits and payload validation

### Secret Management

- File-based secret storage
- Environment variable support
- Secret rotation commands
- Secret redaction in logs

## Performance Considerations

### Concurrency

- Configurable concurrency limits per tool
- Queue management for resource contention
- Backpressure handling under load

### Caching

- TTL cache for frequently accessed data
- LRU eviction policy
- Configurable cache sizes

### Resource Limits

- CPU cores per sandbox
- Memory limits per operation
- Disk space quotas
- Network bandwidth controls

### Monitoring

- Prometheus metrics for all tools
- Health check endpoints
- Performance regression tests
- Resource usage tracking

## Deployment Architecture

### Docker Compose Deployment

```
┌─────────────────────────────────────────┐
│            Docker Network               │
├──────────────┬──────────────┬───────────┤
│              │              │           │
│  GOrchestrator│    GAgent   │   GLearn  │
│  (Port 3000) │ (Port 3001) │(Port 3002)│
│              │              │           │
├──────────────┼──────────────┼───────────┤
│              │              │           │
│   GMirror    │   GBrain    │  Grafana  │
│  (Port 3003) │ (Port 8000) │(Port 3004)│
│              │              │           │
├──────────────┴──────────────┴───────────┤
│            Prometheus (9090)            │
└─────────────────────────────────────────┘
```

### Volume Management

- Secrets volumes: Encrypted storage for sensitive data
- Audit volumes: Audit log persistence
- Data volumes: Persistent storage for databases
- Configuration volumes: Shared configuration files

## Communication Patterns

### MCP (Model Context Protocol)

All tools expose MCP servers for standardized communication:
- Tool discovery and invocation
- Request/response pattern
- Error handling with structured responses
- Streaming support for long-running operations

### HTTP API

RESTful APIs for direct integration:
- Health check endpoints
- Configuration endpoints
- Metrics endpoints
- Administrative endpoints

### Event Streaming

Progress updates for long-running operations:
- Real-time status updates
- Partial result streaming
- Cancellation support

## Extension Points

### Custom Backends

Sandbox backends can be extended:
- Docker (default)
- E2B
- Modal
- Daytona
- Firecracker
- In-process (for testing)

### Custom Rubrics

GMirror supports custom evaluation rubrics:
- Security rubrics
- Performance rubrics
- Maintainability rubrics
- Custom domain-specific rubrics

### Custom Patterns

GLearn can learn custom patterns:
- Code patterns
- Execution patterns
- Error patterns
- Success patterns

## Testing Architecture

### Unit Tests

- Core logic testing
- Validation logic testing
- Configuration testing
- Error handling testing

### Integration Tests

- MCP contract testing
- Sandbox lifecycle testing
- Tool integration testing
- End-to-end pipeline testing

### Performance Tests

- Benchmarking
- Regression testing
- Load testing
- Resource usage testing

### Chaos Tests

- Failure injection
- Network partition simulation
- Resource exhaustion testing
- Timeout handling validation

## Future Enhancements

### Planned Features

- Distributed execution across multiple nodes
- Advanced scheduling algorithms
- Machine learning-based optimization
- Enhanced observability with tracing
- Multi-region deployment support

### Scalability Considerations

- Horizontal scaling of stateless components
- Database sharding for receipt storage
- Caching layer for frequently accessed data
- Load balancing for high availability

## Design Principles Summary

1. **Modularity**: Each tool is independently deployable
2. **Observability**: All operations are logged and traceable
3. **Security**: Defense-in-depth with multiple layers
4. **Resilience**: Graceful degradation under failure
5. **Extensibility**: Plugin architecture for custom backends
6. **Determinism**: Consistent behavior in production
7. **Auditability**: Complete audit trail of all operations
8. **Performance**: Efficient resource utilization
