# GMirror Architecture

## System Overview

GMirror is an autonomous change tester that runs diffs against synthetic users with cognitive models, producing multi-dimensional verdicts on correctness, user outcome, and failure modes.

## Core Components

### 1. PopulationManager
**Location**: `src/core/population.ts`

Manages synthetic user populations:
- Creates populations with diverse cognitive profiles
- Draws panels of users for testing
- Filters by persona labels, expertise domains, trust ranges
- Manages population lifecycle and versions

### 2. ScenarioGenerator
**Location**: Integrated in GMirror class

Generates test scenarios:
- Creates realistic use cases based on task context
- Generates adversarial scenarios for red-team testing
- Balances happy path, edge cases, and adversarial scenarios
- Supports scenario templates and customization

### 3. SyntheticUserRunner
**Location**: `src/core/runner.ts`

Executes scenarios for synthetic users:
- Simulates user behavior based on cognitive profile
- Tracks behavior trace (actions, states, trust, frustration)
- Handles abandonment, errors, and harmful outcomes
- Measures cost and duration

### 4. VerdictAggregator
**Location**: `src/core/verdict.ts`

Aggregates run records into verdicts:
- Calculates correctness score from success rates
- Calculates user outcome score from satisfaction metrics
- Calculates risk score from harmful outcomes and failures
- Calculates cost score from computational cost
- Applies safety gates for harmful outcomes
- Groups results by persona and scenario

### 5. FailureModeLibrary
**Location**: `src/core/failure-mode.ts`

Manages failure patterns:
- Predefined failure modes with severity levels
- Extracts failure modes from run records using clustering
- Tracks observation counts and affected personas/scenarios
- Provides scenarios that catch each failure mode

## Synthetic User Model

### Cognitive Profile
```typescript
interface SyntheticUser {
  user_id: string;
  persona_label: string;
  big_five: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  cognitive_load_baseline: number;
  dual_process_bias: number;
  trust_baseline: number;
  frustration_threshold: number;
  expertise: Record<string, number>;
  goals: Goal[];
  constraints: Constraint[];
}
```

### Behavior Simulation
- **Trust evolution**: Increases/decreases based on interactions
- **Frustration accumulation**: Builds with errors and unexpected states
- **Cognitive load**: Varies with task complexity
- **Decision making**: Influenced by personality and current state

## Data Flow

```
Test Request (diff, scope)
    ↓
PopulationManager (draw panel of users)
    ↓
ScenarioGenerator (generate scenarios)
    ↓
SyntheticUserRunner (execute each user × scenario)
    ↓
Run Records (behavior traces, outcomes)
    ↓
FailureModeLibrary (extract failure patterns)
    ↓
VerdictAggregator (aggregate into verdict)
    ↓
Verdict (scores, failure modes, breakdowns)
```

## Verdict Structure

```typescript
interface Verdict {
  verdict_id: string;
  request_id: string;
  overall: 'pass' | 'pass_with_warnings' | 'risky' | 'fail';
  scores: {
    correctness: ScoreBundle;
    user_outcome: ScoreBundle;
    risk: ScoreBundle;
    cost: ScoreBundle;
  };
  failure_modes: FailureMode[];
  breakdown: {
    by_persona: Record<string, number>;
    by_scenario: Record<string, number>;
  };
  latency_ms: number;
  gates: Gate[];
}
```

## Key Design Decisions

### Cognitive Model Depth
- Synthetic users have rich cognitive profiles
- Behavior emerges from personality + current state
- Not just random variation - psychologically grounded

### Multi-Dimensional Scoring
- Correctness: Did the task succeed?
- User outcome: Was the user satisfied?
- Risk: Were there harmful outcomes?
- Cost: Was it efficient?
- All dimensions matter for production readiness

### Failure Mode Extraction
- Clusters failed runs by last-3-action patterns
- Identifies recurring failure patterns
- Feeds back into future testing

### Safety Gates
- Harmful outcomes trigger automatic failure
- Critical failure modes have thresholds
- Abandonment rates have limits

## Configuration Schema

```typescript
interface GMirrorConfig {
  population: {
    defaultPanelSize: number;
    personaDomains: string[];
    trustBaseline: number;
    cognitiveLoadBaseline: number;
  };
  scenarios: {
    adversarialRatio: number;
    coverageTargets: {
      happyPath: number;
      edgeCases: number;
      adversarial: number;
    };
  };
  scoring: {
    correctnessThreshold: number;
    userOutcomeThreshold: number;
    riskGates: {
      harmful: 'fail' | 'warn';
      criticalFailureModes: number;
    };
  };
  model: {
    endpoint: string;
  };
}
```

## Error Handling Strategy

- **Model unavailable**: Use fallback behavior simulation
- **User abandonment**: Record as abandonment, don't fail test
- **Sandbox failure**: Mark run as errored, continue with others
- **Extraction failure**: Use known failure modes only

## Extension Points

- **Custom cognitive models**: Implement alternative personality frameworks
- **Custom scenario generators**: Domain-specific scenario templates
- **Alternative scoring**: Custom scoring functions and thresholds
- **Custom failure detection**: Pattern recognition algorithms

## Testing Strategy

- Unit tests for each core module
- Behavioral tests for synthetic user interactions
- Scenario generation tests with various configurations
- Verdict aggregation tests with different outcome distributions
- Failure mode extraction tests with clustering validation
