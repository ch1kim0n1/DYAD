# GMirror — Agent-Readable Contract

## Purpose
GMirror scores task execution quality using synthetic user panels and multi-dimensional verdict aggregation. It currently evaluates **developer-productivity changes** (correctness, user outcome, robustness, cost, risk, confidence). For DYAD it must also evaluate **relationship insight quality** — whether an emotion label, bid classification, or repair-window suggestion is accurate, non-harmful, and grounded in relationship science.

## Current Core Capabilities
- Synthetic user panel assembly (PopulationManager)
- Scenario generation via LLM (fallback to defaults)
- Parallel synthetic user runs (SyntheticUserRunner)
- Multi-dimensional verdict aggregation with Wilson CI scoring
- Failure-mode extraction
- Rubric framework (`GMIRROR_RUBRIC_V1`, 6 dimensions)
- Tamper-evident execution receipts with regression gating
- HTTP server on port 3002 (`POST /gmirror/score`, `/health/live`, `/health/ready`)
- Drift detection, cost ledger, latency tracker, audit logger (all wired)
- CLI commands: `eval`, `replay`, `regress`, `trend`, `drift`, `cost`

## Rubric (current — `GMIRROR_RUBRIC_V1`)
| Dimension | Weight | Pass Floor | Description |
|-----------|--------|-----------|-------------|
| correctness | 0.25 | 0.50 | Task completion accuracy |
| user_outcome | 0.20 | 0.50 | Goal achievement, inverse frustration |
| robustness | 0.15 | 0.45 | Error handling, edge cases |
| cost | 0.10 | 0.30 | Within budget |
| risk | 0.20 | 0.50 | Safety/security violations |
| confidence | 0.10 | 0.40 | Scorer agreement |

## API Contract (current)

```typescript
interface ScoreRequest {
  attempt_id: string;
  task: string;
  output: string;
  metadata?: Record<string, any>;
}

interface ScoreResponse {
  attempt_id: string;
  score: number;
  confidence: number;
  breakdown: {
    correctness: number;
    completeness: number;
    clarity: number;
  };
  timestamp: string;
}
```

---

## What Must Change for DYAD

### 1. New Rubric: `GMIRROR_DYAD_RUBRIC_V1`
Relationship insight quality cannot be evaluated by the current task-completion rubric. Create a separate rubric for DYAD:

```typescript
// File to create: src/core/gmirror-dyad-rubric.ts
export const GMIRROR_DYAD_RUBRIC_V1: RubricFramework = {
  name: 'gmirror_dyad_v1',
  version: '1.0',
  dimensions: [
    {
      name: 'research_grounding',
      description: 'Insight is traceable to peer-reviewed relationship science (Gottman, Johnson, Bowlby)',
      min: 0, max: 1, weight: 0.30, pass_floor: 0.60,
    },
    {
      name: 'non_harm',
      description: 'Insight does not pathologize, assign blame, or recommend unsafe actions',
      min: 0, max: 1, weight: 0.30, pass_floor: 0.90,  // hard gate
    },
    {
      name: 'calibration',
      description: 'Confidence score matches actual accuracy on held-out validation set',
      min: 0, max: 1, weight: 0.15, pass_floor: 0.50,
    },
    {
      name: 'actionability',
      description: 'Insight can be acted on by the user without professional intervention',
      min: 0, max: 1, weight: 0.15, pass_floor: 0.40,
    },
    {
      name: 'privacy_safe',
      description: 'No PII in stored output; content stays on device where required',
      min: 0, max: 1, weight: 0.10, pass_floor: 1.00,  // hard gate
    },
  ],
  overall_pass_criteria: {
    all_above_floor: true,
    weighted_mean_floor: 0.65,
  },
};
```

**Note:** `non_harm` and `privacy_safe` are hard gates — any insight scoring below their floor must be refused regardless of other dimensions.

### 2. Relational Synthetic User Population
The current `PopulationManager` draws from a generic persona set. For DYAD, add a `DyadPersonaSet`:

```typescript
interface DyadPersona extends SyntheticUser {
  attachment_style: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
  relationship_experience: 'new' | 'established' | 'long_term';
  prior_therapy: boolean;
  emotional_literacy: 'low' | 'medium' | 'high';
}
```

**File to modify:** `src/core/population.ts` — add `drawDyadPanel(config: DyadPanelConfig): DyadPersona[]`

### 3. Relational Scenario Generator
The existing LLM scenario generator produces task-execution scenarios. For DYAD, the scenarios must cover:
- "User receives an emotion label they disagree with — how do they respond?"
- "Insight surfaces a bid-rejection pattern — is the framing non-blaming?"
- "Repair window suggestion is wrong — does the user notice and override?"

**File to modify:** `src/core/gmirror.ts` — add `generateRelationalScenarios(insight: RelationalInsight): Scenario[]`

### 4. Ethical Refusal as a Hard Gate in Verdict
Any insight that triggers the ethical refusal classifier (see GAgent CLAUDE.md) must automatically fail the verdict regardless of other scores:

```typescript
// In src/core/verdict.ts, inside aggregateVerdict():
if (input.ethical_refusal_triggered) {
  return {
    overall: 'fail',
    reason: 'ethical_refusal',
    scores: /* all zeros */,
    hard_gate_results: [{ gate: 'ethical_refusal', passed: false }],
  };
}
```

**File to modify:** `src/core/verdict.ts`

### 5. New HTTP Endpoint
Add to `src/server.ts`:
- `POST /gmirror/score-insight` — takes a `RelationalInsightScoreRequest`, returns a DYAD-rubric verdict

```typescript
interface RelationalInsightScoreRequest {
  insight_id: string;
  dyad_id: string;
  insight_type: 'emotion_label' | 'bid_classification' | 'repair_suggestion' | 'labor_asymmetry';
  insight_text: string;
  supporting_evidence: string[];  // message excerpts (PII-redacted)
  ethical_refusal_triggered: boolean;
}
```

### 6. Frustration Trend Detection (implement from plan)
`PopulationManager.getFrustrationTrend()` exists but is not wired into the scoring pipeline. For DYAD, feed per-dyad frustration signals into the drift detector:

```typescript
// In src/core/gmirror.ts, after each panel run:
const trend = this.populationManager.getFrustrationTrend();
if (trend.drifted) {
  this.driftDetector.record('panel_frustration', trend.current);
}
```

**File to modify:** `src/core/gmirror.ts`

---

## Configuration
- `GMIRROR_PORT` — override default `3002`
- `GMIRROR_DYAD_MODE` — `true` to use DYAD rubric and relational scenarios
- `GMIRROR_ETHICS_STRICT` — `true` to hard-fail on any non_harm score < 0.9

## Persistence
- Receipts: JSONL per ISO week (`gmirror/test/baselines/receipts-YYYY-Www.jsonl`)
- SQLite: `verdict-persistence.ts` (already wired)

## Integration Points
- **Called by:** GOrchestrator (hard gate scoring on each attempt), DYAD (insight quality evaluation)
- **Calls:** Population manager, synthetic user runner, verdict aggregator, failure-mode extractor, LLM client
