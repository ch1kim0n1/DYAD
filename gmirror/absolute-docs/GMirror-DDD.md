# GMirror — Design & Development Document

**Version:** 0.1 (Pre-Hackathon Draft)
**Owner:** Vlad
**Last Updated:** May 2026
**Status:** Architecture lock-in phase
**Related Documents:** GOrchestrator-DDD.md, GToM-DDD.md, GBrain (external), GStack (external)

---

## 0. Reading Guide

This document is the architectural and build-plan reference for **GMirror**, the autonomous change tester with cognitive synthetic users in the five-tool agent stack.

GMirror is positioned as an **autonomous change tester** for the market; internally and architecturally it is a **synthetic-mind simulation engine** that runs change-testing as its primary mode and supports two additional modes (pre-build simulation and production shadow).

Sections 1–3 are the *what* and *why*.
Sections 4–8 are the *how*.
Sections 9–11 are project planning.
Section 12 is open questions.

The hackathon MVP is **Section 9.1**.

---

## 1. Executive Summary

GMirror is an autonomous change tester. Every diff produced by an agent — every PR, every refactor, every spec change, every deployment — is automatically tested against a population of synthetic users and adversarial scenarios before it can be trusted, merged, or shipped.

The differentiator from existing autonomous testers (mutation testing, visual regression, AI test generators) is that **GMirror does not assert against test cases. It asserts against simulated minds**. Each synthetic user is a cognitive model — personality, cognitive load, trust level, frustration threshold, expertise — and the test is whether that synthetic mind succeeds with the change, abandons it, or breaks it.

In the broader stack, GMirror is the *braindance*. You record synthetic minds running through the change. You play back where they broke. You grade the change on what kinds of minds it serves and what kinds it fails.

### 1.1 What it is

- An autonomous trigger-based change tester (diff-in → verdict-out).
- A synthetic user population with cognitive-model depth.
- A scenario generator for realistic and adversarial use cases.
- A scoring engine producing multi-dimensional verdicts.
- A red-team agent harness that probes for security, prompt injection, and edge cases.
- A failure-mode library that grows over time and feeds back into future tests.

### 1.2 What it is not

- It is not a unit test framework. It uses unit tests as one input among many; it does not replace them.
- It is not a real-user analytics tool. It models users; the real-world feedback loop is GBrain's responsibility.
- It is not an LLM-as-judge. Synthetic users perform tasks; outcomes are observed; judgment is grounded.
- It is not a verification-only system. It also generates evidence, traces, and failure-mode entries.
- It is not coupled to GOrchestrator. Its primary integration is with GOrchestrator but it can be invoked standalone.

### 1.3 Headline metrics (targets, hedged)

- **Failure catch rate (pre-deployment):** target 40–60% of UX/agent failures caught before production. Source basis: analogous numbers from chaos engineering and game playtest literature.
- **Iteration speed multiplier:** 5–20× compared to real-user feedback loops, depending on how slow the existing loop is.
- **False positive rate (target):** <15% for "blocking" verdicts. Below this, blocking is operationally too noisy and gets routed around.
- **Coverage:** synthetic user population should cover ≥80% of the top-10 user personas for a given product family, validated against real user analytics from GBrain.
- **Latency:** verification should complete within 30% of attempt wall time for the hackathon MVP, falling to 10% by V2.

These are targets, not commitments. Numbers depend heavily on synthetic-user quality and scenario coverage.

---

## 2. Problem Statement

### 2.1 The gap

The agent stack has an output trust problem. GStack generates code, documents, deployments, messages. GBrain stores context. GOrchestrator runs many attempts in parallel. None of them answer the question: **is this output actually correct, safe, and useful for the people who will use it?**

Existing answers to this question are inadequate for agent-scale work:

- **Unit tests** assert against the developer's prior beliefs about correctness. They cannot catch what the developer didn't anticipate. Agents generate code at a volume where anticipation does not scale.
- **Mutation testing** mutates code to check test coverage. It improves tests, not outputs.
- **Visual regression** catches pixel diffs. It cannot tell you whether a user *understood* the new UI.
- **LLM-as-judge** has known biases (self-preference, length, style) and is uncalibrated against real outcomes.
- **Real user testing** is slow, expensive, and produces feedback weeks after the change. By the time you know, the next 50 changes are already in flight.

GMirror's bet is that **cognitive-model synthetic users**, run at scale, against every change, produce a signal that is (a) faster than real users, (b) more grounded than LLM judges, and (c) richer than unit tests.

### 2.2 Why now

Three things make this viable in 2026 that weren't viable earlier:

- **Sufficient model capability to roleplay cognitive states.** A model can now be conditioned on a cognitive profile (personality, cognitive load, trust, expertise) and produce behavior that varies measurably along those dimensions. Five years ago this was research; now it's a prompt with structure.
- **Sandboxed parallel execution is cheap.** Running 100 synthetic users against one change in parallel is now within the cost envelope of a single CI run.
- **The agent stack creates the demand.** Pre-agent, change rate was bounded by human throughput. With agents, change rate is bounded by *verification* throughput. Whoever solves verification owns a critical bottleneck.

### 2.3 Why GMirror specifically

The category — autonomous change testing — is crowded. Codium, Meticulous, mutation testing, visual regression, every AI test-generator startup of the last 18 months. To avoid being pattern-matched into that category and discounted, the pitch must surface the differentiator immediately:

> "It's an autonomous change tester — but instead of asserting against test cases, it asserts against simulated minds."

The defensibility comes from three places:

- **Cognitive-model synthetic users.** Not generic personas. Structured cognitive states (Big Five vectors, dual-process states, cognitive load curves, trust/frustration thresholds). This is a moat because it requires real social/cognitive-science grounding to build well.
- **Failure-mode library accretion.** Every failure caught is structured and stored. The library grows. Future tests apply known failure modes by default. This is a flywheel.
- **Three-mode flexibility.** Change-testing is the primary mode but pre-build simulation and production shadow share the same engine. One system, three triggers, three markets.

---

## 3. System Overview

### 3.1 Conceptual model

A GMirror run has six phases:

1. **Trigger.** A diff, spec, or production signal arrives.
2. **Scope.** GMirror determines what kind of test (change / pre-build / shadow), which synthetic user population is relevant, and which scenarios apply.
3. **Population assembly.** A panel of synthetic users is drawn from the population. Each synthetic user is a cognitive profile + a goal.
4. **Execution.** Synthetic users (and red-team agents) run scenarios against the change in isolated environments. Their behavior is observed and recorded.
5. **Scoring.** Outcomes are aggregated into a verdict bundle (per-dimension scores + evidence + failure modes detected).
6. **Persistence & feedback.** Verdicts go back to the caller (GOrchestrator, CI, deployment pipeline). Failure modes accrete into the library. Calibration data feeds GBrain.

### 3.2 One-line mental model

> **Run the change through many minds. Score on what they do. Remember what broke them.**

### 3.3 Three modes, one engine

| Mode | Trigger | Use case | Primary consumer |
|---|---|---|---|
| Change-testing | Diff arrives | Verify agent/human change before merge/deploy | GOrchestrator, CI/CD |
| Pre-build simulation | Spec / proposal arrives | Predict outcomes before building | Product, PMs |
| Production shadow | Live traffic, periodic | Detect drift, regression, emergent failures | Ops, SRE |

The hackathon MVP ships change-testing only. The DDD documents all three so the architecture extends cleanly.

### 3.4 Cyberpunk framing (for pitch)

GMirror is the *braindance*. You record a mind walking through the experience. You watch it from the inside. You see where it stumbles, where it gives up, where the corp ICE catches it. You play it back at 4× speed. You play back the failed runs to see what killed them. One change ships through a thousand minds before it ships through one real user.

---

## 4. Architecture

### 4.1 Component diagram

```
                ┌─────────────────────────────────────────────┐
                │                  GMirror                    │
                │                                             │
   Diff /       │  ┌────────────┐    ┌───────────────────┐    │
   Spec /     ──┼─►│  Trigger   │───►│ Scope Resolver    │    │
   Signal       │  │ Receiver   │    │ (mode, profile,   │    │
                │  └────────────┘    │  scenarios)       │    │
                │                    └─────────┬─────────┘    │
                │                              │              │
                │                              ▼              │
                │  ┌────────────────────────────────────────┐ │
                │  │  Synthetic User Population Assembler   │ │
                │  │  (draws panel from population)         │ │
                │  └─────────────────┬──────────────────────┘ │
                │                    │                        │
                │  ┌─────────────────┼─────────────────────┐  │
                │  │                 ▼                     │  │
                │  │  ┌──────────┐  ┌──────────┐  ┌─────┐  │  │
                │  │  │Synth U 1 │  │Synth U 2 │  │ ... │  │  │
                │  │  │ + Goal   │  │ + Goal   │  │     │  │  │
                │  │  └────┬─────┘  └────┬─────┘  └──┬──┘  │  │
                │  │       │             │           │     │  │
                │  └───────┼─────────────┼───────────┼─────┘  │
                │          ▼             ▼           ▼        │
                │  ┌────────────────────────────────────────┐ │
                │  │   Red-Team Adversarial Agents          │ │
                │  └─────────────────┬──────────────────────┘ │
                │                    │                        │
                │                    ▼                        │
                │  ┌────────────────────────────────────────┐ │
                │  │   Outcome Collector & Behavior Trace   │ │
                │  └─────────────────┬──────────────────────┘ │
                │                    │                        │
                │                    ▼                        │
                │  ┌────────────────────────────────────────┐ │
                │  │   Verdict Aggregator                   │ │
                │  │   (correctness, user outcome,          │ │
                │  │    robustness, risk, confidence)       │ │
                │  └─────────────────┬──────────────────────┘ │
                │                    │                        │
                │                    ▼                        │
                │  ┌────────────────────────────────────────┐ │
                │  │   Failure-Mode Extractor & Library     │ │
                │  └─────────────────┬──────────────────────┘ │
                │                    │                        │
                └────────────────────┼────────────────────────┘
                                     │
                                     ▼
                              ┌────────────┐
                              │  Verdict   │
                              └────────────┘

   Sidecar integrations:
   ────────────────────
   GBrain  ◄── real user analytics ── (population calibration)
   GBrain  ──► failure modes, verdicts (write)
   GToM    ◄── intent inferences ── (synthetic user goals)
   GOrch   ◄── attempts ── (primary trigger source)
```

### 4.2 Core components

#### 4.2.1 Trigger Receiver

**Responsibility:** Accept incoming triggers from any of the three modes and normalize them into a common TestRequest envelope.

A trigger may be:
- A diff (file paths + changes + optional context) from GOrchestrator or a CI hook.
- A spec or proposal (structured description) from a product/PM source.
- A production signal (live traffic snapshot, alert payload) from monitoring.

The receiver is mode-aware but the downstream pipeline is mode-agnostic. This is what allows one engine to serve three modes.

#### 4.2.2 Scope Resolver

**Responsibility:** Determine the *test profile* for this trigger — which population subset, which scenarios, which adversarial probes, which scoring weights.

Inputs:
- The TestRequest.
- The task signature (if from GOrchestrator) or inferred signature (if from CI).
- GBrain priors on similar tests.
- Configured per-org / per-product profile overrides.

Output: a ScopeBundle specifying:
- Synthetic user persona distribution to draw from.
- Scenario library to apply.
- Red-team probe set.
- Scoring weights.
- Latency budget.

#### 4.2.3 Synthetic User Population Assembler

**Responsibility:** Maintain the synthetic user population and draw representative panels.

The population is the heart of GMirror. It is structured, queryable, and grounded in cognitive science.

A SyntheticUser is a structured profile:

```typescript
type SyntheticUser = {
  user_id: UUID;
  persona_label: string;            // e.g., "first-time mobile user, low trust"

  // Cognitive parameters
  big_five: {                       // OCEAN, [0,1] per dimension
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  cognitive_load_baseline: number;  // baseline cognitive capacity, [0,1]
  dual_process_bias: number;        // -1 (System 1) to +1 (System 2)
  trust_baseline: number;           // [0,1]
  frustration_threshold: number;    // [0,1] — when abandonment likely
  expertise: ExpertiseVector;       // per-domain, [0,1]

  // Contextual parameters
  goals: Goal[];                    // what they typically want
  constraints: Constraint[];        // device, accessibility, time, etc.
  history_seed: HistoryReference;   // anchors continuity across runs

  // Provenance
  derivation: 'sampled' | 'real_user_anonymized' | 'synthetic';
  source_evidence: EvidenceRef[];   // for calibration audit
};
```

The population is not generated ad-hoc per run. It is a maintained, versioned, evolving asset. Adding a synthetic user is a deliberate action, like adding a test case. Real user analytics from GBrain are used to calibrate the population's distribution to match real user distributions; this is the empirical grounding.

The assembler draws a panel from the population based on the ScopeBundle. Panel sizes typically range from 10 (fast, less rigorous) to 200+ (slow, statistical confidence).

#### 4.2.4 Scenario Generator

**Responsibility:** Produce concrete scenarios for synthetic users to attempt against the change.

A scenario is a goal + a starting state + a success criterion. Examples:
- "Buy a single item, log out, log back in, find your order."
- "Recover from entering an invalid email three times."
- "Use the export feature on a 10MB dataset on a slow connection."

Scenarios are drawn from:
- A baseline library per product family.
- Real user analytics in GBrain (frequent paths, edge paths).
- Failure modes from the library (every past failure becomes a recurring scenario).
- Adversarial generation (synthetic users plus red-team agents propose scenarios specifically targeting the change).

Scenarios are versioned and tagged. Regression testing is straightforward: every change is automatically run against the historical scenario set.

#### 4.2.5 Red-Team Agents

**Responsibility:** Probe for security, prompt-injection, abuse, and adversarial failures.

Red-team agents are a parallel population to synthetic users. They are not modeling typical user behavior; they are modeling adversarial behavior:

- Prompt-injection probes (against any LLM surface in the system).
- Security probes (SQLi, XSS, auth bypass, IDOR).
- Abuse probes (rate-limit evasion, resource exhaustion).
- Social engineering probes (against any agent that takes natural-language input).
- Data exfiltration probes (against agents with sensitive data access).

Each red-team probe has a payload, an expected denial, and an observed outcome. A successful probe is a high-severity verdict.

#### 4.2.6 Synthetic User Runner

**Responsibility:** Take a SyntheticUser + Scenario + Change, instantiate the user as a model conditioned on its profile, and run the scenario against the change in an isolated environment.

The runner is the moment where the synthetic mind becomes behavior. The conditioning is structured: the model receives the cognitive profile as constraints on its behavior. Trust and frustration are *tracked state* that updates step-by-step during the run, not just initial conditions.

For example: a synthetic user with trust_baseline=0.3 and frustration_threshold=0.4, encountering an unexpected modal dialog, has their trust reduced and frustration increased. If frustration exceeds threshold, they abandon. This abandonment is the signal.

Crucially, this is **not** roleplay-as-improv. The state is structured and tracked. The behavior is conditioned on the structured state. Two runs of the same synthetic user against the same scenario produce statistically similar (not identical) behavior — variance is intentional, since real users vary.

#### 4.2.7 Outcome Collector & Behavior Trace

**Responsibility:** Capture everything that happened during a run, normalize it, and pass it forward.

Each run produces:
- Task outcome (succeeded / abandoned / errored / harmful_outcome).
- Behavior trace (every action, every state change).
- Subjective trace (the synthetic user's running internal state — trust, frustration, confusion).
- Time-to-outcome and intermediate timestamps.
- Cost (model and compute).

The behavior trace is what makes GMirror diagnostic, not just judgmental. When a change fails, the verdict can show *why*: "Users with low trust and low expertise abandoned at step 3 because the consent modal was unexpected." This is what unit tests cannot tell you.

#### 4.2.8 Verdict Aggregator

**Responsibility:** Synthesize per-run outcomes into a verdict for the change.

The verdict is the contract output of GMirror. Its shape:

```typescript
type Verdict = {
  verdict_id: UUID;
  request_id: UUID;            // the TestRequest this verdict answers
  overall: 'pass' | 'pass_with_warnings' | 'risky' | 'fail';
  scores: {
    correctness: ScoreBundle;
    user_outcome: ScoreBundle;
    robustness: ScoreBundle;
    cost: ScoreBundle;
    risk: ScoreBundle;
    confidence: ScoreBundle;
  };
  hard_gate_results: HardGateResult[];   // pass/fail gates, separate from scores
  failure_modes_detected: FailureMode[];
  evidence: EvidenceRef[];               // links to runs, traces
  population_coverage: number;           // [0,1]
  scenario_coverage: number;             // [0,1]
  latency_ms: number;
  cost_breakdown: CostBreakdown;
};

type ScoreBundle = {
  score: number;                  // [0,1]
  confidence: number;             // [0,1]
  by_persona: Record<string, number>;
  by_scenario: Record<string, number>;
  evidence: EvidenceRef[];
};
```

The verdict separates **soft scores** (numeric, used for ranking) from **hard gates** (binary, used for blocking). A change can score 0.9 overall and still be blocked because a hard gate failed (e.g., security probe succeeded; accessibility scenario failed).

#### 4.2.9 Failure-Mode Extractor

**Responsibility:** Detect and structure new failure modes from runs, and feed them back into the library.

When a synthetic user abandons or errors, the extractor analyzes the trace:
- Was this a known failure mode? Tag it; increment counter.
- Is it novel? Structure it into a new FailureMode record. Propose a new scenario template that catches it. Submit to library.

The library is the flywheel. Every change tested grows it. Every future change runs against a larger library by default. The system gets harder to fool over time.

#### 4.2.10 Calibration Loop

**Responsibility:** Compare GMirror's verdicts to real-world outcomes (from GBrain's real-user feedback loop) and produce calibration adjustments.

When a verdict says "pass" but a change fails in production (real users abandon, real bugs surface, real complaints arrive), the verdict was miscalibrated. The calibration loop:
- Identifies the persona/scenario combination that should have caught it.
- Lowers the trust of similar synthetic users on similar tasks.
- Proposes a new scenario or synthetic user to add to the library.
- Reports calibration error metrics to GBrain.

This is what keeps GMirror honest. Without calibration, synthetic users drift away from reality.

### 4.3 Data model

(Core types are shown inline above. Additional types below.)

```typescript
type TestRequest = {
  request_id: UUID;
  mode: 'change' | 'pre_build' | 'shadow';
  payload: DiffPayload | SpecPayload | ShadowPayload;
  context: ContextBundle;
  budget: TestBudget;
  caller: CallerRef;
  created_at: Timestamp;
};

type ScopeBundle = {
  request_id: UUID;
  population_filter: PopulationFilter;
  scenario_set: ScenarioRef[];
  red_team_set: RedTeamProbeRef[];
  scoring_profile: ScoringProfile;
  panel_size: number;
};

type Scenario = {
  scenario_id: UUID;
  goal: Goal;
  starting_state: State;
  success_criterion: Predicate;
  failure_criteria: Predicate[];
  tags: string[];
  version: int;
  derivation: 'baseline' | 'analytics' | 'failure_mode' | 'adversarial';
};

type FailureMode = {
  failure_mode_id: UUID;
  description: string;
  trigger_pattern: Pattern;
  affected_personas: PersonaRef[];
  affected_scenarios: ScenarioRef[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  first_observed: Timestamp;
  observation_count: int;
  scenarios_that_catch_it: ScenarioRef[];
};

type RunRecord = {
  run_id: UUID;
  request_id: UUID;
  synthetic_user_id: UUID;
  scenario_id: UUID;
  outcome: 'succeeded' | 'abandoned' | 'errored' | 'harmful';
  behavior_trace: TraceRef;
  subjective_trace: SubjectiveTraceRef;
  duration_ms: number;
  cost: CostBreakdown;
};
```

### 4.4 Where things are stored

| Object | Primary store | Notes |
|---|---|---|
| TestRequest | GMirror local DB | Short-lived (TTL ~30 days) |
| Verdict | GMirror local DB + GBrain mirror | GBrain holds aggregates for calibration |
| SyntheticUser population | GMirror canonical store | Versioned, with audit log |
| Scenario library | GMirror canonical store | Versioned |
| FailureMode library | GMirror canonical store | Continuously updated |
| RunRecord | GMirror local DB | Large; tiered to cold storage after 90 days |
| Calibration data | GBrain (canonical) | GMirror pulls; GBrain owns truth |
| Real user analytics | GBrain (canonical) | GMirror reads for population calibration |

### 4.5 Failure modes per component

| Component | Failure mode | Detection | Mitigation |
|---|---|---|---|
| Trigger receiver | Malformed payload | Schema validation | Reject with clear error |
| Scope resolver | GBrain unreachable | Timeout | Use cached/default profile, flag as degraded |
| Population assembler | Persona drift (no real-user grounding) | Calibration metric | Trigger calibration refresh; warn caller |
| Scenario generator | All scenarios stale | Last-update timestamps | Force adversarial generation pass |
| Synthetic user runner | Model API failures | Retry + timeout | Skip synthetic user; reduce panel size; report coverage drop |
| Synthetic user runner | Roleplay degradation (synthetic acts out of character) | Behavioral drift checks | Discard run; flag profile for review |
| Outcome collector | Trace corruption | Checksums | Discard run |
| Verdict aggregator | Insufficient runs to score | Coverage threshold | Return 'risky' with low confidence rather than fabricate |
| Failure-mode extractor | False novel failure mode (already in library) | Similarity dedup | Merge into existing |
| Calibration loop | Real-world signal sparse | N-threshold | Defer calibration until N reached |

GMirror's invariant: **never return a verdict more confident than the evidence supports**. Low coverage → low confidence → caller can decide whether to gate on it.

---

## 5. Integration Contracts

### 5.1 GMirror ↔ GOrchestrator

#### 5.1.1 Primary contract (scoring attempts)

```
POST /gmirror/score
  body:
    {
      task: TaskBundle,
      attempts: [AttemptResult, ...],
      scoring_profile: ScoringProfile
    }
  returns:
    {
      verdicts: [Verdict, ...],     // one per attempt
      latency_ms: int,
      coverage: { population: float, scenario: float }
    }
```

Latency-budgeted. If the budget is exceeded, GMirror returns partial coverage with explicit `coverage` numbers below 1.0 — the caller can decide whether to trust a partial verdict.

#### 5.1.2 Streaming variant

For long verifications, GMirror exposes a streaming variant:

```
POST /gmirror/score/stream
  body: same as above
  streams:
    - VerdictPartial events as panel runs complete
    - VerdictFinal at the end
```

GOrchestrator's selector can short-circuit if one attempt clearly dominates partway through, saving compute.

### 5.2 GMirror ↔ GBrain

#### 5.2.1 Reads

- **Real user analytics.** For population calibration. Pulled periodically, not per request.
- **Failure-mode aggregates.** For cross-product failure-mode transfer (V2+).
- **Historical verdicts on similar changes.** For confidence priors.

#### 5.2.2 Writes

- **Verdicts.** Mirrored to GBrain for downstream analytics and cross-system learning.
- **Failure modes.** Written for cross-system visibility (e.g., other tools can subscribe).
- **Calibration error events.** When the calibration loop detects miscalibration, the event goes to GBrain.

### 5.3 GMirror ↔ GToM

#### 5.3.1 Synthetic user goal grounding

GToM models real users' intents. GMirror's synthetic users have goals. The intersection is rich:

```
GET /gtom/typical-intents
  params: persona_filter, surface
  returns:
    {
      intents: [{intent: string, frequency: float, evidence_count: int}, ...]
    }
```

GMirror uses this to ensure synthetic user goals are realistic. If real users on this surface almost never want X, no synthetic user should want X.

#### 5.3.2 Misinterpretation testing

When GToM has flagged that a particular phrasing is commonly misinterpreted (e.g., "delete all my data" might mean "delete cache" or "delete account"), GMirror generates scenarios that test both interpretations. This is one of the highest-value cross-tool flows in the stack.

### 5.4 GMirror ↔ GStack

Minimal. GMirror does not invoke GStack directly. GStack skills produce the changes that GMirror tests. The integration is indirect: GStack writes diffs; GOrchestrator (or a CI hook) submits the diff to GMirror.

V2+ may add direct GStack integration if GMirror generates fix suggestions for failure modes (i.e., GMirror tells GStack: "this failure mode is recurring, here's a candidate fix skill to add"). Not in V1.

### 5.5 GMirror ↔ external CI/CD

GMirror exposes a webhook surface so it can be a GitHub Action, a CI step, or a deployment gate without going through GOrchestrator:

```
POST /gmirror/ci/verify
  body:
    {
      repo: string,
      pr_number: int,
      diff_url: string,
      scoring_profile_hint: string,
      blocking: boolean
    }
  returns:
    {
      verdict_id: UUID,
      status_url: string,
      passes: boolean,
      summary: string
    }
```

This is what makes GMirror a standalone product, not just a GOrchestrator dependency.

---

## 6. Synthetic User Design Detail

This section is the moat. It deserves the most depth.

### 6.1 Cognitive parameters explained

#### 6.1.1 Big Five (OCEAN)

The five-factor model is the most empirically validated structure of personality. Each dimension affects behavior measurably:

- **Openness** affects willingness to explore new features, try edge cases.
- **Conscientiousness** affects thoroughness, error recovery, attention to detail.
- **Extraversion** affects engagement with social features (chat, sharing).
- **Agreeableness** affects response to friction (high A users accept friction longer).
- **Neuroticism** affects frustration build-up and abandonment thresholds.

Conditioning a model on a profile means: when this synthetic user encounters a decision, the response distribution shifts according to OCEAN. Not deterministically — probabilistically.

#### 6.1.2 Cognitive load

Cognitive load is tracked as a running state, not a fixed parameter. Baseline + accumulated load from the current scenario = current load. When current load exceeds capacity, behavior degrades: more errors, more abandonment, less thorough error recovery. Sources for the model: Sweller's cognitive load theory.

#### 6.1.3 Dual-process bias

System 1 (fast, intuitive) vs System 2 (slow, deliberate). Real users default to System 1 on routine tasks and engage System 2 on novel or high-stakes ones. Synthetic users have a baseline bias and a context-dependent shift. A high-stakes scenario (e.g., entering credit card details) shifts even System-1-biased users toward System 2.

This matters because most UX failures are System-1 failures (the user didn't read; the user clicked the highlighted button without parsing). A test population that's all System-2 misses these.

#### 6.1.4 Trust baseline and dynamics

Trust starts at the baseline and updates step-by-step. Trust falls on: unexpected modals, surprising redirects, asking for permissions out of context, confusing copy. Trust rises on: progress feedback, consistent affordances, clear error messages.

Low trust → faster abandonment, more verification behavior, less data sharing.

#### 6.1.5 Frustration threshold

Frustration accumulates with friction (delays, errors, surprises). When it crosses threshold, the synthetic user abandons. Threshold varies per user. A high-N test surfaces the persona slice that abandons.

#### 6.1.6 Expertise vector

Per-domain expertise affects assumed knowledge, terminology, navigation confidence. A novice and an expert testing the same change produce different outcomes. Both signals are valuable.

### 6.2 Population calibration to real users

The population is only as useful as it is representative. Calibration steps:

1. **Pull real user analytics from GBrain.** Aggregate distributions: demographics, behavior patterns, expertise indicators.
2. **Map to cognitive parameters.** This mapping is the hard, science-grounded part. Frequent fast-clicker → high System-1 bias. Long-dwelling reader → high Conscientiousness + high System-2. Abandon-quickly user → low frustration threshold. (Inferences are statistical, not deterministic.)
3. **Resample population.** Adjust the synthetic user distribution to match real distributions.
4. **Audit.** When real-user outcomes diverge from synthetic predictions, the mapping is wrong somewhere. Adjust.

This is an ongoing process. The population is not fit-once; it drifts and is re-calibrated.

### 6.3 Persona vs population

A persona is a labeled cluster of cognitive parameters ("first-time mobile shopper, low trust, high frustration sensitivity"). A population is a distribution over personas with weights.

Tests draw panels from populations. Per-persona scores let you see *which kinds of minds* the change serves or fails. This is the diagnostic depth that unit tests can't match.

### 6.4 Behavioral fidelity vs cost

There is a fidelity-cost frontier in synthetic user runs:

| Fidelity tier | Method | Cost per run | Use case |
|---|---|---|---|
| Tier 1 (fast) | Heuristic simulator + small model | $ | High-volume regression |
| Tier 2 (medium) | Mid-size model with structured conditioning | $$ | Default tier |
| Tier 3 (high) | Frontier model with rich conditioning + chain-of-thought subjective trace | $$$ | High-stakes changes, calibration baselines |

A panel typically mixes tiers: most users run at Tier 2, a few at Tier 3 for high-confidence anchoring. Tier 1 is for regression-only runs.

### 6.5 Ethical considerations

Synthetic users that model vulnerable populations (children, people in crisis, people with cognitive impairments) require extra care:

- They should exist in the population because excluding them means the system fails to test for failures that affect them.
- They should not be modeled exploitatively — the goal is to detect when changes harm these populations, not to "use" them.
- Failure modes affecting vulnerable populations are weighted higher in scoring by default.

Red-team adversarial agents that probe for ways to abuse the system are NOT modeled as vulnerable users. They are explicitly adversarial. The two are kept architecturally separate.

---

## 7. Scoring and Verdict Logic

### 7.1 Soft scores vs hard gates

Two distinct outputs, both in the verdict:

**Soft scores** (numeric, [0,1], usable for ranking):
- correctness: did the deliverable do what was specified?
- user_outcome: did synthetic users succeed?
- robustness: did adversarial probes fail to break it?
- cost: how expensive was the attempt?
- risk: security, reversibility, compliance concerns.
- confidence: GMirror's confidence in the above scores.

**Hard gates** (binary, blocking):
- All red-team probes failed (i.e., no probe succeeded against the system)?
- Accessibility scenario set passed?
- All "critical" tagged scenarios passed?
- No "critical" failure modes detected?
- (Per-product customizable)

A change with a high soft score but a failed hard gate is *blocked*, not just scored low. This distinction is what makes GMirror trustworthy as a deployment gate.

### 7.2 Aggregation across panel

Per-dimension scores aggregate across the panel with persona-weighted means. Critical persona slices (e.g., accessibility users) can be given non-uniform weights. The aggregation is transparent — the verdict shows the per-persona breakdown so callers can see whether the score is uniform or hides a bad slice.

A 0.85 mean with a 0.3 accessibility-slice score is *not* the same as a 0.85 uniform score. The verdict surfaces both.

### 7.3 Confidence is first-class

Every score has a confidence. Confidence is a function of:
- Panel size (more synthetic users → higher confidence).
- Variance across the panel (low variance → higher confidence).
- Coverage (did the panel exercise the relevant scenarios?).
- Calibration history (how well-calibrated has the system been on similar changes?).

Low confidence does not mean low score. A confident pass and an unconfident pass are different products to the caller. GMirror surfaces both.

### 7.4 Decision boundaries

The `overall` field of the verdict is derived from scores + gates:

- `pass`: all hard gates passed; all soft scores above threshold; confidence above threshold.
- `pass_with_warnings`: hard gates passed; some soft scores below threshold or some persona slices weak.
- `risky`: gates pass but confidence is low OR significant persona slice failure.
- `fail`: at least one hard gate failed.

Thresholds are profile-configurable. Defaults are conservative.

---

## 8. Observability

### 8.1 What gets logged

- Every TestRequest, ScopeBundle, Verdict.
- Every RunRecord (synthetic user × scenario combination).
- Every behavior trace and subjective trace.
- Every failure-mode detection event.
- Calibration error events.
- Population drift events.

### 8.2 Dashboards (v1+)

- **Per-verdict dashboard:** the verdict expanded, with per-persona and per-scenario breakdown, plus example failing traces (one click to replay the synthetic user's run).
- **Failure-mode library dashboard:** every known failure mode, its frequency, which products it affects, when it was first observed.
- **Calibration dashboard:** predicted vs. actual outcomes over time. The single most important dashboard for trust.
- **Population dashboard:** persona distribution, drift over time, real-world fit.
- **Cost dashboard:** cost per verdict, cost per detected failure (the inverse metric).

### 8.3 Replay

Every synthetic user run is replayable. Given the RunRecord, you can:
- Watch the behavior trace step by step.
- See the subjective trace (trust, frustration over time).
- See where the user's behavior diverged from a "good" path.
- Modify the change and re-run the same user with the same scenario.

This is the braindance experience — and it's also a critical engineering tool.

---

## 9. Build Plan & Milestones

### 9.1 Hackathon MVP (the weekend)

**Goal:** an autonomous change tester that takes a code diff, runs it against 5–10 synthetic users with structured cognitive profiles, and returns a verdict with per-persona breakdown.

**Scope:**

- Single trigger mode: change-testing (diff in → verdict out).
- Single product domain for the demo: a simple web app with a few user flows.
- Synthetic user population: 10 hand-crafted personas spanning the Big Five and expertise axes.
- Scenario library: 5 baseline scenarios for the demo app.
- Red-team probes: 2–3 hard-coded ones (a prompt-injection probe and an auth-bypass probe).
- Synthetic user runner: Tier 2 (mid-size model with structured conditioning).
- Verdict: full structure but with stubs for confidence calibration.
- Failure-mode library: write-only; entries accumulate but don't yet feed back into future runs.
- Calibration loop: stubbed.
- Persistence: SQLite.
- GBrain / GOrchestrator / GToM integrations: stub clients with the real API shapes.

**Demo flow (90 seconds):**

1. A code change is submitted (e.g., a redesigned checkout flow).
2. GMirror dashboard lights up. Ten synthetic user avatars appear, each labeled by persona.
3. Each one starts running the checkout scenario in its own pane. You see their cursors moving, their trust meter, their frustration meter.
4. User 3 (low-trust, low-expertise) abandons at the consent modal. Trust hits zero.
5. User 7 (high-conscientiousness, mid-expertise) succeeds but slowly, with backtracks visible.
6. User 1 (red-team-adjacent, attempts to inject a payload into the address field) — the system blocks the injection (probe failed = pass on robustness).
7. Verdict appears: `pass_with_warnings`. Per-persona breakdown shows the abandonment slice. One failure mode added to the library: "consent modal causes low-trust user abandonment."
8. Re-run after a small change to the consent modal. User 3 now succeeds. Verdict: `pass`. Failure-mode library shows the now-resolved entry.

**Time budget:**
- Friday night: trigger receiver, scope resolver, synthetic user data model, ~3 personas to start (8h).
- Saturday morning: synthetic user runner, behavior trace, outcome collector (8h).
- Saturday afternoon: 7 more personas, 5 scenarios, 2 red-team probes (6h).
- Saturday night: verdict aggregator, dashboard UI (6h).
- Sunday: demo polish, the second-run improvement beat, pitch (8h).

**Risk:**
- The synthetic user behavior must feel *cognitively real* in the demo, not generic. If they all act the same, the moat is invisible. Mitigation: rehearse the demo against the 10 personas Friday night; if behavior is too uniform, intensify the conditioning prompts.
- Red-team probes must visibly succeed at being blocked (the absence of a bad outcome is hard to demo). Mitigation: include one probe that visibly tries something obviously bad (prompt injection with a flashy payload), and one that visibly bypasses an early check before being caught at a later gate.

### 9.2 V1 — Production-shaped prototype (post-hackathon, ~6 weeks)

**Goal:** the architecture from this DDD with real integrations.

**New scope vs MVP:**

- Full synthetic user data model with versioning.
- Population calibration loop (real user data from GBrain).
- Scenario library with three sources (baseline, analytics-derived, failure-mode-derived).
- Adversarial scenario generation.
- Full red-team probe set (10–20 probes spanning security, prompt injection, abuse).
- Real integration with GOrchestrator (scoring per attempt).
- Real integration with GBrain (verdicts, failure modes, calibration).
- Real integration with GToM (intent grounding, misinterpretation testing).
- Calibration loop, end to end.
- Webhook surface for CI/CD integration (standalone use case).
- Per-verdict dashboard.

**Milestones:**

- **Week 1:** Synthetic user model + population store + versioning.
- **Week 2:** Scenario library + scenario generation (baseline + analytics-derived).
- **Week 3:** Red-team probe library + execution.
- **Week 4:** GOrchestrator + GBrain integrations.
- **Week 5:** GToM integration + adversarial scenario generation.
- **Week 6:** Calibration loop, dashboard, CI webhook, polish.

**Exit criteria:**
- Real change submitted via CI webhook produces a verdict that catches at least one known bug class.
- Calibration loop measurably reduces false-positive rate over 100+ verdicts.
- Per-verdict dashboard is usable for diagnosing failures.

### 9.3 V2 — Multi-mode, multi-tenant (months 2–4)

**New scope:**

- Pre-build simulation mode (spec in → predicted outcome).
- Production shadow mode (sample live traffic → continuous verdict stream).
- Multi-tenancy (per-org synthetic populations, scenario libraries, scoring profiles).
- Tier 1 (fast) and Tier 3 (high-fidelity) synthetic user runners.
- Streaming verdict variant for GOrchestrator short-circuit.
- Failure-mode library cross-product transfer.
- Calibration dashboard.
- Failure-mode dashboard.
- SLO hardening, alerting.

**Milestones:**

- **Month 2:** Pre-build simulation mode + spec-payload normalization.
- **Month 3:** Production shadow mode + sampling + drift detection.
- **Month 4:** Multi-tenancy + tier system + cross-product transfer.

### 9.4 V3 — Ecosystem (months 4+)

- Public synthetic-user persona library (community-contributed).
- Public scenario library (community-contributed, per product family).
- Open red-team probe set (community-contributed, peer-reviewed).
- Cross-org failure-mode federation (share failure modes without sharing data).
- SDK for embedding GMirror in third-party CI/CD pipelines.

### 9.5 Engineering principles to enforce throughout

- **Cognitive grounding.** Every synthetic user parameter must trace to a defensible cognitive-science source. No vibe-based personas.
- **Calibration or confidence drop.** When real-world outcomes diverge from verdicts, confidence drops. The system signals its own untrustworthiness.
- **Hard gates separate from soft scores.** Never let a soft score override a hard gate.
- **Failure modes accrete.** Every detected failure is structured and stored. Library grows monotonically (with deduplication).
- **Replay or it didn't happen.** Every synthetic user run is replayable.
- **Ethics first.** Vulnerable-population modeling has additional review. Red-team probes are explicitly bounded.

---

## 10. Risks & Mitigations

### 10.1 Technical risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Synthetic users behave generically (don't reflect cognitive parameters) | High | Critical | Structured state tracking (trust/frustration as updated state, not just initial); behavioral drift checks; per-run audits |
| Population miscalibrated to real users | High | High | Calibration loop; real analytics from GBrain; periodic resample |
| Cost per verdict too high for routine use | Medium | High | Tiered fidelity; Tier 1 for regression-only; smart panel sizing |
| Latency too high to gate deployments | Medium | High | Streaming verdicts; parallel panel runs; aggressive caching of unchanged scenario results |
| False positive rate too high → callers route around | Medium | Critical | Hard gates conservative; soft scores informational; confidence-aware decisions |
| Red-team probes become stale | Medium | Medium | Continuous adversarial generation; community library in V3 |

### 10.2 Product risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Pattern-matched as "another AI test tool" | High | High | Lead with the cognitive-mind framing; never pitch as "we generate tests" |
| Customers don't trust synthetic users enough to gate on them | High | High | Calibration dashboard public; clear confidence reporting; gradual adoption (warnings → blocking) |
| Crowded category with well-funded competitors | High | Medium | The moat is the cognitive grounding + the failure-mode library flywheel — neither is easy to copy fast |
| Buyers want unit-test generation, not user simulation | Medium | Medium | Offer both. Generate tests from observed failure modes as a side output |

### 10.3 Ethical risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Modeling vulnerable users exploitatively | Medium | Critical | Explicit review process; weighted-higher scoring for failures affecting them; never use these personas in red-team |
| Red-team probes used offensively outside intended scope | Low | Critical | Probes are scoped to the system under test; deployment-gated; auditable |
| Calibration data leaking real user behavior | Medium | High | Calibration uses aggregates only; no PII in the loop; differential privacy in V2+ |

### 10.4 Hackathon-specific risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Synthetic users look like the same character with different labels | High | Critical | Test on Friday; if true, intensify conditioning prompts; pre-script behavioral examples per persona |
| The verdict is hard to demo in 90 seconds | Medium | High | Lean on the dashboard — show 10 avatars, color-coded by outcome, with one failure trace zoomed in |
| Red-team probes don't visibly do anything | Medium | Medium | Include one obviously adversarial probe (visible payload) and visibly show it being blocked |

---

## 11. Open Questions

1. **Synthetic user persistence across runs.** Should the same synthetic user "remember" prior sessions for continuity testing, or is each run independent? V1 default: independent; V2 may add persistent personas for multi-session scenarios.

2. **How small can panels go and still produce trustworthy verdicts?** Below N=5, confidence drops sharply. Open question what the right minimum is by task type.

3. **Should synthetic users be allowed to learn during a run?** A real user adapts to a UI over time. Synthetic users currently don't. Modeling within-session learning is a V2 question.

4. **Cross-product population transfer.** Can a synthetic-user population calibrated on product A be used on product B? Hypothesis: yes for cognitive parameters, no for domain expertise. Needs validation.

5. **Live red-team agents vs scripted probes.** V1 uses scripted probes; V2+ may use live adversarial agents that adapt. Threshold for moving to live agents: when scripted probe coverage plateaus.

6. **Failure-mode deduplication.** When is a "novel" failure mode actually a variant of an existing one? Similarity threshold needs empirical tuning.

7. **Verdict expiration.** A verdict valid today may not be valid in a week (synthetic user population may have updated). How to handle stale verdicts? Probably: time-stamped; consumers can re-request if they care.

8. **User consent for production shadow mode.** In production shadow, are we replaying real user sessions against changes? If so, consent and PII handling are critical. To be designed carefully in V2.

---

## 12. Appendix

### 12.1 Glossary

- **Synthetic user** — a structured cognitive profile + goal, instantiated as a model conditioned on its profile.
- **Persona** — a labeled cluster of cognitive parameters; synthetic users belong to personas.
- **Population** — a weighted distribution over personas, used to draw panels.
- **Panel** — the subset of synthetic users drawn for a specific test.
- **Scenario** — a goal + starting state + success criterion that synthetic users attempt.
- **Probe** — a red-team adversarial action against the change.
- **Verdict** — the contract output: scores + gates + evidence + failure modes.
- **Failure mode** — a structured description of a recurring failure pattern.
- **Calibration** — the loop that compares verdicts to real-world outcomes to maintain trust.
- **Hard gate** — a binary blocking check.
- **Soft score** — a numeric [0,1] dimension used for ranking and reporting.
- **Fidelity tier** — speed/cost tradeoff for synthetic user runners.

### 12.2 Versioning

This document is v0.1. Material changes require a version bump. See CHANGELOG.md.

### 12.3 Related references

- Sweller, Cognitive Load Theory.
- McCrae & Costa, Big Five (OCEAN) — empirical structure of personality.
- Kahneman, Thinking Fast and Slow — dual-process theory.
- Premack & Woodruff, "Does the chimpanzee have a theory of mind?" — related to GToM but informs synthetic-user goal modeling.
- Chaos engineering literature (Netflix Chaos Monkey, Gremlin) — for the principle that pre-deployment fault injection catches a measurable fraction of production failures.
- Game playtest literature (Schell, "The Art of Game Design") — playtest fidelity and persona design.

---

*End of GMirror DDD v0.1.*
