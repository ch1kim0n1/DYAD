# DYAD — Relational Intelligence Platform

[![CI](https://github.com/ch1kim0n1/DYAD/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ch1kim0n1/DYAD/actions/workflows/ci.yml)

> The first software that operates on the real machinery of the relationships you can't afford to lose.

> **For contributors:** see [`docs/BUILD-ORDER.md`](docs/BUILD-ORDER.md) for the issue dependency map / build sequence, [`docs/SECURITY.md`](docs/SECURITY.md) for the security posture, and [`docs/RELEASING.md`](docs/RELEASING.md) for sign + notarize + ship.

DYAD is a mobile-first relational intelligence platform. It ingests a user's real communication history with specific people in their life — partner, co-founder, parent, close friend — and produces a continuously updated, calibrated, citation-backed model of how that relationship is actually functioning. The system surfaces what is silently going wrong, in time for the user to do something about it.

---

## Why this exists

Most adult suffering happens in dyads. Estranged parents. Co-founder breakups that destroy companies. Marriages that ended without warning. Friendships that ghosted. These failures share a structure: the dynamics that govern the relationship are invisible to the people inside it. The patterns repeat. The repairs never happen. The window closes.

The clinical literature on this is unusually well-developed — Gottman on rupture and repair, Reis & Shaver on perceived partner responsiveness, Sue Johnson's EFT framework on primary versus secondary emotion, Pennebaker on function-word linguistics. None of this is in software. All of it could be.

---

## The six core features

### 1. The Map
The relationship rendered as a single scrollable visualization: emotional temperature over time, rupture-and-repair events marked as discrete points, topic-drift regions shaded, bid-and-response cadence shown as rhythm. Fourteen months of relational dynamics compress into eight seconds on first render.

**Grounded in:** Boals, Banks & Hayslip on narrative coherence in autobiographical memory.

### 2. The Emotion Atlas
Every message carries a tag for primary emotion (Plutchik's eight), intensity (low/medium/high), and an inferred secondary emotion where the surface emotion is a protective layer over a vulnerable one. Surfaces as per-message color tags, a heat band along the Map, and an aggregate emotional-signature card.

**Grounded in:** Plutchik's wheel; Ekman on intensity; Sue Johnson's EFT primary/secondary framework.

### 3. Bid Response Asymmetry
Two numbers: the rate at which the user responds to the partner's bids for connection, and vice versa. Shown against Gottman's empirical thresholds — 86% in stable relationships, ~33% in failing ones. Almost always shocking on first surface. Almost always unknown by both parties.

**Grounded in:** Gottman's *The Relationship Cure*; Gottman & Levenson longitudinal studies.

### 4. Primary / Secondary Emotion Separation
For any flagged conflict, the system separates the stated content (the surface argument) from the inferred underlying emotion (the vulnerable feeling being protected against). Names both. Cites the specific linguistic markers. Proposes a reframe that addresses the primary rather than the secondary.

**Grounded in:** Johnson's *Hold Me Tight*; Higgins's self-discrepancy theory.

### 5. Predictive Divergence
For any draft message the user is about to send: what the user intends to communicate, and what the partner-model says the partner will actually hear. The gap between the two is rendered visually — not as a paragraph, as a literal distance — with the specific divergent phrases highlighted.

**Grounded in:** Reis & Shaver on perceived partner responsiveness; Vallacher & Wegner on action identification asymmetry.

### 6. The Phantom Third Party
When the user's reaction in a specific interaction is disproportionate to the trigger, and the shape of the disproportion matches earlier-relationship templates, the system surfaces the transferential pattern. High confidence threshold (0.8+) required. Suppressed silently if not met.

**Grounded in:** Wachtel's cyclical psychodynamics; Mikulincer & Shaver on attachment-style behavioral markers.

### 7. Ethical Refusal (structural feature)
When the system encounters patterns consistent with intimate-partner abuse, suicidality, or severe depression, it declines to perform further analysis and surfaces appropriate referral resources. This is a real classifier built on the computational psychiatry literature — not a keyword filter. Drawing this line visibly is itself the feature.

**Grounded in:** Coppersmith et al. on suicidality detection; De Choudhury et al. on depression markers.

---

## Architecture

DYAD is composed of six logical layers:

```
L6 — Surface        iOS/Mac app. Map, Atlas, Brief, Mirror views.
L5 — Intervention   Wise-intervention engine. Reframes, repair drafts, Brief content.
L4 — Detection      Six demo-critical detectors + ethical-refusal classifier.
L3 — State          Self-Model, Partner-Model, Relationship-Model — updated continuously.
L2 — Extraction     Pennebaker function-word parsing, NRC/AFINN lexicons, LLM structured extraction.
L1 — Ingestion      iMessage chat.db reader, Discord/WhatsApp/Slack adapters, jo federation, The Hog enrichment.
```

Orchestration through these layers is owned by **GStack**, which treats each layer as a typed service. Persistent state lives in **GBrain** (three objects per user/relationship tuple). Partner external context comes from **The Hog**. Personal context (calendar, photos, notes) comes from **jo**.

### Two-surface architecture

```
macOS daemon (Tauri/Python)          iOS/Mac app (Tauri + React)
────────────────────────             ──────────────────────────
Reads ~/Library/Messages/chat.db     Consumes state + detector outputs
Watches via FSEvents / chokidar      Renders Map, Atlas, Brief, Mirror
Normalizes messages → POST           No LLM calls on view open (cache)
Pushes to GStack orchestration       Live only for Predictive Divergence
```

### End-to-end message flow

```
chat.db row → normalize → GStack L2 (parallel: function-word + lexicon + LLM extraction)
           → L3 state update in GBrain → L4 detector check → APNs push if threshold crossed
           → iOS app reads latest state on open → renders from cache
```

---

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | **Bun** | Native TS, native SQLite, faster than Node |
| Mac app shell | **Tauri 2.0** | Native performance, smaller binary, Full Disk Access for chat.db |
| UI framework | **React + Tailwind + shadcn/ui** | Speed of development with agent assistance |
| State management | **Zustand** | Simple, fast, pairs well with Tauri IPC |
| iOS companion | **Expo** (React Native) | Free dev signing, hot reload, cross-platform roadmap |
| iMessage reader | `better-sqlite3` against `~/Library/Messages/chat.db` | Direct SQLite, no API layer |
| File watching | `chokidar` | Cross-platform FSEvents wrapper |
| Tokenization/POS | `wink-nlp` | Fast, browser-compatible, TypeScript-native |
| Function-word parser | Custom (~200 lines TS) | Pennebaker dictionary, deterministic |
| Sentiment lexicons | NRC Emotion Lexicon + AFINN (JSON) | Open-source, fast lookup, no API cost |
| LLM | `@anthropic-ai/sdk` (JSON mode) | Structured extraction, calibrated confidence |
| Charts (Map) | **Visx** (D3 in React) | Composable, animated, full D3 power |
| Animation | **Framer Motion** | Native React, smooth transitions |
| Orchestration | **GStack** | Parallel pipeline execution, agent decomposition |
| Persistent state | **GBrain** | Entity-resolved, longitudinal, three-object schema |
| Partner context | **The Hog** | Partner public footprint, cached per relationship |
| Personal context | **jo** | Calendar, photos, notes federation |

---

## Repository structure

```
DYAD/
├── apps/
│   ├── mac/                  # Tauri app — primary surface
│   │   ├── src-tauri/        # Rust shell (minimal, mostly pass-through)
│   │   └── src/              # React frontend
│   │       ├── views/        # Map, Atlas, Brief, Mirror, Relationship list
│   │       ├── components/   # Shared UI components
│   │       └── store/        # Zustand state slices
│   └── phone/                # Expo app — iOS companion
│       └── app/              # Expo Router screens
├── packages/
│   ├── engine/               # L2–L4: extraction, state, detectors
│   │   ├── extraction/       # function-word parser, lexicon pass, LLM extraction
│   │   ├── state/            # Self-Model, Partner-Model, Relationship-Model
│   │   └── detectors/        # 6 detectors + ethical refusal classifier
│   ├── ingestion/            # L1: chat.db reader, normalizer, message schema
│   ├── lexicons/             # NRC, AFINN, Pennebaker dictionary (JSON)
│   ├── prompts/              # LLM system prompts (one file per detector)
│   └── shared/               # TypeScript types, Zod schemas, constants
├── corpora/
│   ├── team/                 # Consenting team-member relationships (gitignored)
│   └── public/               # Jobs/Sculley, Dorsey/Williams public-figure corpora
├── absolute-docs/            # Source-of-truth design documents
│   ├── Dyad_DDD.md
│   └── tech-stack.md
└── .env                      # API keys (never committed)
```

---

## Integration with the G-stack

DYAD is the primary consumer of all five G-stack backend tools:

| Tool | DYAD's use of it |
|------|-----------------|
| **GStack / gorchestrator** | Owns the L2→L3→L4 pipeline; runs DetectorPool in parallel; handles GToM relational pre-check; scores insights via GMirror |
| **GBrain** | Persists the three state objects (Self-Model, Partner-Model, Relationship-Model), rupture/repair ledger, entity-resolution graph; stores results with `page_kind: 'dyad'` |
| **GToM** | Pre-checks relational risk before running detectors (`POST /gtom/predict-relational-conflicts`); scores bid authenticity (`POST /gtom/score-bid`); tracks attachment state per dyad |
| **GMirror** | Scores each detector output against `GMIRROR_DYAD_RUBRIC_V1` via `POST /gmirror/score-insight`; enforces non_harm and privacy_safe hard gates |
| **GAgent / gagent** | Runs the iMessage ingestion daemon; applies PII redaction before any data leaves the device; dispatches the `analyze_relationship_window` task type; runs the ethical refusal classifier |
| **GLearn** | Learns relational patterns (bid_cycle, repair_window, labor_drift, attachment_signal) from event streams; generates RelationalProposals; tracks DriftDetector metrics per dyad |

---

## Ethical architecture

DYAD operates on private communication between named real humans. Ethics is structural — built into the architecture — not policy bolted on top.

1. **Asymmetric intervention** — DYAD only talks to the user. No outbound messages, no impersonation, no auto-replies. The system has no send capability at all.
2. **Your-side-only data access** — Observes only what the user already has access to. Never crosses into the partner's private accounts.
3. **User is the primary diagnostic target** — The Self-Model and Mirror view are the deepest features. The product indicts the user as much as it explains the partner.
4. **Clinical refusal as first-class output** — The ethical-refusal classifier is shipped, not gestured at. It stops the system when serious patterns appear.
5. **Calibrated humility** — Every claim carries explicit confidence. The system actively suppresses low-confidence inferences. The Phantom Third Party detector requires 0.8+ to display.

---

## Quick start

```bash
# Prerequisites: Bun installed, Xcode signed in, iPhone trusted
bun install

# Start the Mac app in dev mode
bun run dev:mac

# Start the iOS companion
bun run dev:phone

# Run detectors against the fixture corpus
bun run engine:test

# Required .env at repo root:
# ANTHROPIC_API_KEY=
# GSTACK_API_KEY=
# GBRAIN_API_KEY=
# THE_HOG_API_KEY=
# JO_API_KEY=
# DYAD_PII_REDACTION=true
```

Grant Full Disk Access to your terminal in **System Settings → Privacy & Security → Full Disk Access** before first run — required for chat.db access.

---

## Research grounding

Every detector is grounded in a specific literature. Key sources:

- Gottman & Levenson (2000) — longitudinal divorce prediction, bid taxonomy, 5:1 ratio
- Reis & Shaver (1988) — perceived partner responsiveness (PPR)
- Johnson (2008) — EFT, primary/secondary emotion distinction
- Tronick (2007) — rupture-repair framework
- Pennebaker et al. (2003) — function-word linguistics
- Mikulincer & Shaver (2016) — adult attachment behavioral markers
- Wachtel (2014) — cyclical psychodynamics (Phantom Third Party)
- Coppersmith et al. (2018) — NLP suicidality screening (ethical refusal)
- De Choudhury et al. (2013) — depression markers in language (ethical refusal)

Full bibliography in [absolute-docs/Dyad_DDD.md](./absolute-docs/Dyad_DDD.md), Appendix A.
