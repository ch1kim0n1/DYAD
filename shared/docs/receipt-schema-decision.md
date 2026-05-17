# Receipt Schema Decision: Convergence vs Mapping

## Overview
This document analyzes the decision between converging all G-Stack tools to use a single receipt schema versus maintaining tool-specific schemas with mapping layers.

## Current State

### Tool-Specific Receipt Schemas

**GMirror**
```typescript
interface GMirrorReceipt {
  request_id: string;
  overall: 'pass' | 'fail';
  scores: {
    correctness: { score: number; reasoning: string };
    user_outcome: { score: number; reasoning: string };
    robustness: { score: number; reasoning: string };
    risk: { score: number; reasoning: string };
    confidence: { score: number; reasoning: string };
  };
  hard_gate_results: Record<string, boolean>;
  failure_modes_detected: string[];
  cost_breakdown: { total_cost_usd: number; by_model: Record<string, number> };
  latency_ms: number;
}
```

**GOrchestrator**
```typescript
interface GOrchestratorReceipt {
  task_id: string;
  attempts: Array<{
    attempt_id: string;
    status: 'success' | 'failed';
    result: any;
    cost_usd: number;
    latency_ms: number;
  }>;
  winner?: string;
  total_cost_usd: number;
  total_latency_ms: number;
}
```

**GLearn**
```typescript
interface GLearnReceipt {
  cycle_id: string;
  patterns_found: number;
  proposals_generated: number;
  pattern_details: Array<{
    pattern_id: string;
    support: number;
    confidence: number;
  }>;
  proposal_details: Array<{
    proposal_id: string;
    status: string;
    counterfactual_score?: number;
  }>;
  cost_usd: number;
}
```

**GToM**
```typescript
interface GToMReceipt {
  evaluation_id: string;
  authenticity_score: number;
  vulnerability_detected: boolean;
  vulnerability_details?: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  };
  cognitive_defense_score: number;
  cost_usd: number;
}
```

**GStack**
```typescript
interface GStackReceipt {
  review_id: string;
  files_reviewed: string[];
  findings: Array<{
    file: string;
    line: number;
    severity: 'info' | 'warning' | 'error';
    message: string;
  }>;
  total_issues: number;
  cost_usd: number;
  latency_ms: number;
}
```

## Analysis

### Option 1: Convergence (Single Schema)

**Pros:**
- Simpler integration between tools
- Unified storage and querying in GBrain
- Easier cross-tool analytics
- Consistent API for consumers
- Reduced mapping complexity

**Cons:**
- Loss of tool-specific granularity
- May require nullable fields for tool-specific data
- Tight coupling between tools
- Schema changes affect all tools
- May not represent all tool outputs accurately

**Suitability:**
- Good for: High-level metrics, cost tracking, latency tracking
- Poor for: Tool-specific details, complex nested structures

### Option 2: Mapping (Tool-Specific Schemas)

**Pros:**
- Each tool maintains optimal schema for its domain
- No loss of granularity
- Independent schema evolution
- Clear separation of concerns
- Each tool can represent its full output

**Cons:**
- Complex mapping layers for cross-tool operations
- Harder to query across tools
- More storage complexity in GBrain
- Integration complexity for consumers
- Potential for schema drift

**Suitability:**
- Good for: Tool-specific operations, detailed logging, independent evolution
- Poor for: Cross-tool analytics, unified reporting

## Recommendation

**Hybrid Approach: Unified Core + Tool-Specific Extensions**

We recommend a hybrid approach that balances the benefits of both options:

### Core Receipt Schema (Unified)

All tools emit a core receipt with standardized fields:

```typescript
interface BaseReceipt {
  receipt_id: string;
  tool: 'gmirror' | 'gorchestrator' | 'glearn' | 'gtom' | 'gstack';
  timestamp: string;
  status: 'success' | 'failed' | 'partial';
  
  // Standardized metrics (required)
  cost_usd: number;
  latency_ms: number;
  tokens_used: number;
  llm_calls: number;
  
  // Normalized quality scores (required)
  quality: {
    correctness: number;      // 0-1
    efficiency: number;       // 0-1
    robustness: number;       // 0-1
    clarity: number;          // 0-1
    authenticity: number;     // 0-1
  };
  
  // Tool-specific data (optional, tool-specific schema)
  tool_data?: any;
}
```

### Tool-Specific Extensions

Each tool maintains its detailed schema in the `tool_data` field:

**GMirror:**
```typescript
tool_data: {
  overall: 'pass' | 'fail';
  scores: { /* GMirror-specific scores */ };
  failure_modes: string[];
  // ... other GMirror-specific fields
}
```

**GOrchestrator:**
```typescript
tool_data: {
  attempts: Array<{ /* ... */ }>;
  winner: string;
  // ... other GOrchestrator-specific fields
}
```

### Mapping Layer

A shared mapping layer provides:
- Conversion from tool-specific schemas to normalized quality scores
- Extraction of core metrics (cost, latency, tokens)
- Validation of required fields

```typescript
class ReceiptMapper {
  static toBaseReceipt(tool: string, toolReceipt: any): BaseReceipt {
    // Extract core metrics
    // Calculate normalized quality scores
    // Return unified receipt
  }
  
  static getToolData(baseReceipt: BaseReceipt, tool: string): any {
    // Extract tool-specific data
  }
}
```

## Implementation Plan

### Phase 1: Define Core Schema
- [ ] Create `BaseReceipt` interface in shared/types
- [ ] Define quality score normalization rules
- [ ] Create validation schema

### Phase 2: Implement Mapping Layer
- [ ] Create `ReceiptMapper` class in shared/core
- [ ] Implement tool-specific mappers
- [ ] Add unit tests for mapping logic

### Phase 3: Update Tools
- [ ] Update GMirror to emit BaseReceipt format
- [ ] Update GOrchestrator to emit BaseReceipt format
- [ ] Update GLearn to emit BaseReceipt format
- [ ] Update GToM to emit BaseReceipt format
- [ ] Update GStack to emit BaseReceipt format

### Phase 4: Update GBrain
- [ ] Update receipt storage to handle BaseReceipt
- [ ] Add indexing on core fields
- [ ] Update query APIs

### Phase 5: Update Consumers
- [ ] Update CLI commands to use BaseReceipt
- [ ] Update MCP operations to use BaseReceipt
- [ ] Update integration tests

## Migration Strategy

### Backward Compatibility
- Maintain tool-specific receipt generation during migration
- Provide dual output (old + new format) during transition
- Deprecate old format after 2 major versions

### Rollout Plan
1. Implement mapping layer without changing tool output
2. Add new BaseReceipt generation alongside old format
3. Update consumers to use BaseReceipt
4. Deprecate old format
5. Remove old format generation

## Conclusion

**Decision:** Hybrid approach with unified core + tool-specific extensions

**Rationale:**
- Provides cross-tool consistency for analytics and integration
- Preserves tool-specific granularity for detailed operations
- Allows independent evolution of tool-specific schemas
- Balances simplicity with flexibility
- Enables unified storage and querying in GBrain

**Next Steps:**
1. Implement Phase 1-2 (core schema and mapping layer)
2. Update one tool as proof-of-concept
3. Validate approach with stakeholders
4. Roll out to remaining tools
