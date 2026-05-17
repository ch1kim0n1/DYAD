# GMirror Evaluation Documentation

## Evaluation Framework
GMirror uses synthetic user testing to evaluate changes before deployment. This document describes the evaluation methodology, metrics, and benchmarking approach.

## Evaluation Methodology

### Synthetic User Testing
GMirror evaluates changes by simulating diverse user personas interacting with the proposed changes. Each synthetic user:
- Has specific expertise domains (finance, healthcare, e-commerce, etc.)
- Possesses a personality profile (openness, conscientiousness, extraversion, agreeableness, neuroticism)
- Follows realistic user journey scenarios
- Provides feedback on correctness, user outcome, and risk

### Scoring Dimensions

#### Correctness (0-1)
Measures whether the change achieves its intended technical goal.
- **1.0:** Change fully implements intended functionality
- **0.5:** Change partially implements functionality with workarounds
- **0.0:** Change fails to implement functionality or introduces bugs

**Evaluation criteria:**
- Does the change solve the stated problem?
- Are there edge cases where functionality fails?
- Is the implementation technically sound?

#### User Outcome (0-1)
Measures the impact on end-user experience and goal achievement.
- **1.0:** Change significantly improves user experience or outcomes
- **0.5:** Change has neutral or mixed impact on users
- **0.0:** Change degrades user experience or blocks user goals

**Evaluation criteria:**
- Does the change help users achieve their goals?
- Is the change intuitive and easy to use?
- Does it introduce friction or confusion?

#### Risk (0-1)
Measures potential negative consequences including security, privacy, and manipulation risks.
- **1.0:** No significant risks identified
- **0.5:** Moderate risks present but acceptable
- **0.0:** High-risk change with potential for harm

**Evaluation criteria:**
- Are there security vulnerabilities introduced?
- Does the change manipulate user behavior unethically?
- Are there privacy concerns?

### Overall Verdict
- **Pass:** All dimensions ≥ 0.6 OR weighted average ≥ 0.7
- **Fail:** Any dimension < 0.4 OR weighted average < 0.6

## Benchmarking

### Benchmark Corpus
Location: `shared/benchmark-corpus/comparison-v1/`

**Current Benchmarks:**
- `code-generation.json`: Code generation tasks
- `refactor.json`: Code refactoring tasks

**Benchmark Format:**
```json
{
  "name": "benchmark-name",
  "description": "Description",
  "tasks": [
    {
      "id": "task-001",
      "task": "Task description",
      "type": "task-type",
      "expected_output": "Expected result",
      "metadata": {
        "complexity": "easy|medium|hard",
        "estimated_tokens": 500
      }
    }
  ]
}
```

### Running Benchmarks
```bash
# Single run
gmirror eval -c corpus.json -o results.json

# Multi-run for statistical significance
gmirror eval -c corpus.json --cycles 10 -o results.json
```

### Statistical Analysis
Multi-run evaluation provides:
- Mean scores across dimensions
- Standard deviation for reliability assessment
- Confidence intervals for score estimates

**Interpretation:**
- **Std dev < 0.05:** Highly consistent evaluation
- **Std dev 0.05-0.10:** Acceptable consistency
- **Std dev > 0.10:** High variance, investigate population diversity

## Performance Metrics

### Latency
- **Target:** P50 < 5s, P95 < 15s, P99 < 30s (panel size ≤ 10)
- **Measurement:** End-to-end scoring time
- **Optimization:** Reduce panel size, cache scenarios, use faster models

### Cost
- **Target:** < $0.10 per evaluation (default panel size)
- **Components:**
  - LLM API costs (primary)
  - Scenario generation (minor)
  - Verdict aggregation (minor)

### Accuracy
- **False Positive Rate:** < 10% (changes incorrectly marked as fail)
- **False Negative Rate:** < 5% (changes incorrectly marked as pass)
- **Population Coverage:** ≥ 90% of user segments represented

## Evaluation Scenarios

### Pre-Build Evaluation
**Use case:** Evaluate changes before committing to codebase
**Mode:** `pre_build`
**Panel size:** 5-10 users
**Focus:** Correctness and risk

### Shadow Testing
**Use case:** Evaluate changes in production environment without affecting users
**Mode:** `shadow`
**Panel size:** 20-50 users
**Focus:** User outcome and real-world validation

### Change Evaluation
**Use case:** Standard evaluation for pull requests and deployments
**Mode:** `change`
**Panel size:** 10-20 users
**Focus:** All dimensions (correctness, outcome, risk)

## Failure Mode Analysis

### Common Failure Patterns

#### Cognitive Friction
**Symptoms:** Low user outcome scores
**Triggers:** Complex workflows, confusing UI, hidden features
**Mitigation:** Simplify flows, improve discoverability

#### Manipulation Risks
**Symptoms:** Low risk scores
**Triggers:** Dark patterns, forced actions, unclear opt-outs
**Mitigation:** Transparent design, explicit consent

#### Technical Issues
**Symptoms:** Low correctness scores
**Triggers:** Bugs, edge cases, incomplete implementation
**Mitigation:** Better testing, code review

### Viewing Failure Modes
```bash
gmirror failure-modes
```

**Output:**
```
Known Failure Modes:
  HIGH: Dark pattern detected in checkout flow
    Pattern: forced_action
    Observations: 15

  MEDIUM: Cognitive friction in settings page
    Pattern: complex_workflow
    Observations: 8
```

## Cross-Tool Comparison

### Normalized Output
GMirror outputs conform to the normalized output schema defined in `shared/src/core/normalized-axes.ts`:

```typescript
{
  success: boolean,
  score: number (0-1),
  cost_usd: number,
  tokens_used: number,
  llm_calls: number,
  latency_ms: number,
  p50_ms: number,
  p95_ms: number,
  p99_ms: number,
  quality: {
    correctness: number,
    efficiency: number,
    robustness: number,
    clarity: number,
    authenticity: number
  }
}
```

### Comparison with Other Tools
- **GStack:** Code review vs. UX testing (complementary)
- **GOrchestrator:** Execution vs. evaluation (sequential)
- **GToM:** Vulnerability vs. manipulation detection (overlap)
- **GLearn:** Pattern mining vs. failure detection (input)

## Continuous Evaluation

### Automated Evaluation Pipeline
1. **Trigger:** On code push or pull request
2. **Evaluation:** Run GMirror with appropriate mode
3. **Threshold:** Block merge if score below threshold
4. **Feedback:** Provide detailed scoring to developers

### Monitoring
- Track evaluation trends over time
- Alert on degradation in pass rates
- Review high-cost evaluations for optimization

### Improvement
- Regularly calibrate population to real user data
- Expand scenario library for new use cases
- Update failure mode patterns based on production issues
