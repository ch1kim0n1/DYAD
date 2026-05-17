# CareCircle Demo Spec

Last updated: May 16, 2026

## Product Promise

CareCircle is a care coordination layer for exhausted family caregivers. The demo centers on Maya checking in once after work and getting:

- what changed this week
- what needs action
- what CareCircle already prepared
- what still needs human approval

The system is designed to feel capable and calm, not like a clinical dashboard or surveillance tool.

## Primary Demo Flow

1. Maya opens CareCircle.
2. Dashboard shows the family circle and one primary action: Catch me up.
3. Catch me up runs a synthesis animation over latest timeline context.
4. Care Brief shows three staged next actions.
5. Maya can act:
   - open a family SMS draft
   - download a calendar reminder
   - review and open a provider email draft
6. Messages show editable drafts with reasoning.
7. Timeline shows source-visible context and live source search.
8. Trust explains privacy, source visibility, explicit sharing, and human review.

## Dashboard

### What It Shows

- Brand/product context: CareCircle, relationship intelligence for family care.
- Hero promise: come home, check once, feel caught up.
- Family circle cards:
  - Linda
  - Maya
  - Sarah
  - Arjun
  - Dr. Chen

### Current Behavior

- Catch me up navigates to Care Brief and starts the synthesis animation.
- Family cards are clickable shortcuts:
  - Linda opens Care Brief.
  - Maya opens Messages with Check-in for Mom selected.
  - Sarah opens Messages with Pharmacy summary selected.
  - Arjun opens Care Brief.
  - Dr. Chen opens Messages with Pharmacy summary selected.

## Timeline

### What It Shows

- Source-visible timeline of care events.
- Source badges:
  - family note
  - messages
  - calendar
  - pharmacy notification
  - task
  - learned pattern
- Evidence chips on each event.
- Source overlay with source type, person, sensitivity, timestamp, related people, and tags.

### Search

- One unified search bar at the top.
- Typing filters the visible timeline.
- Submitting the same search retrieves stronger context from the larger source corpus.
- Retrieval status is user-facing:
  - Demo sources
  - Live sources
  - Checking sources

### Add Note

- Compact note input supports:
  - author selection
  - note type selection
  - free-text note
- Authors:
  - Maya
  - Sarah
  - Arjun
  - Linda
- Note types:
  - Check-in
  - Symptom
  - Meal
  - Appointment
  - Task
  - Preference
- Added notes appear immediately in the Timeline, newest-first.
- Added notes are included in the Catch me up synthesis graph.
- Added notes attempt to save into GBrain through the local bridge.
- Old local notes are migrated defensively so the app does not crash.

## Catch Me Up

### What It Does

- Navigates to Care Brief.
- Starts a 3.8 second synthesis flow.
- Starts an agentic brief request while the synthesis animation runs.
- Streams latest observations, including live notes.
- Labels incoming context by source.
- Clusters observations into source-aware rationales:
  - routine change
  - appointment loop
  - medical review boundary
- Resolves into the Care Brief.

### Agentic Behavior

- Vite exposes `POST /api/carecircle/agent-brief`.
- The endpoint reads the current care graph and asks a bounded care-coordinator agent for structured JSON.
- The agent identifies:
  - changed patterns
  - unresolved loops
  - task assignments
  - message drafts
  - medical/human-review boundaries
- The agent is prompted to explain cross-source reasoning, such as:
  - family notes plus learned preferences
  - calendar mentions plus Arjun's task ownership
  - pharmacy notification plus family-message symptom mentions
- The response is normalized back into the existing `CareBrief` shape.
- If the agent succeeds, the Care Brief shows an `Agent analysis` badge.
- If the agent fails or no model key is configured, CareCircle silently falls back to the deterministic `analyzeCareWeek` workflow.

### Memory Behavior

- Attempts to sync the source bundle to local GBrain.
- Falls back silently if GBrain is unavailable.
- Keeps the demo deterministic and reliable.

## Care Brief

### What It Shows

- Brief headline.
- Short lead:
  - three changes found
  - next moves staged
  - one item needs approval
- Three primary action cards:
  - Sibling update
  - Appointment confirmation
  - Pharmacy call brief
- Compact calendar-aware reminder strip.
- What you do now callout.
- Collapsed reasoning section.

### What Is Collapsed

The reasoning layer is behind Show why I staged this:

- why the plan was staged
- evidence chips
- confidence
- unresolved loops
- Linda preferences

### Why This Layout

The Care Brief prioritizes Maya's care plan over system internals. It no longer displays GBrain or provider debug panels inline.

## Three Primary Actions

### Queue Family Update

- Opens an SMS draft with the sibling update.
- Keeps Maya in control before anything is sent.

### Schedule Reminder

- Uses the selected calendar-aware slot.
- Downloads a real `.ics` reminder file.
- Updates the action card state with the selected time.

### Review And Approve

- Runs provider handoff context.
- Opens an email draft with the doctor/pharmacist summary.
- Keeps medication-related language approval-first.

## Calendar-Aware Reminder

### What It Shows

- Suggested free times.
- Conflict indicators.
- Compact `Edit schedule` expansion.

### What It Does

- Users can select a slot.
- Selected slot updates the appointment action card.
- Selected slot is used in the `.ics` download.
- Users can add mock busy blocks, including natural-ish text such as `class Sunday 10pm`.

### Current Limitation

Calendar data is mocked. It does not connect to Google Calendar or Apple Calendar yet.

## Messages

### Drafts

- Check-in for Mom
- Family update
- Pharmacy summary

### Composer

- Opens one draft at a time.
- Draft text is editable.
- Shows why CareCircle wrote it that way.
- Supports copy, queue, SMS, and email actions depending on draft type.

### Safety

- Pharmacy summary is marked Approve first.
- Provider language avoids causation and diagnosis.

## Trust

### What It Communicates

- Synthetic demo data.
- Source visibility.
- Explicit sharing controls.
- Export/delete controls.
- No model training on family data.
- Human review for medical concerns.

### Runtime Reset

- Trust includes reset controls for demo state.

## GBrain Integration

### Current Role

GBrain acts as the memory layer.

### What Works

- Local GBrain was initialized outside the repo.
- Vite exposes `POST /api/carecircle/gbrain-memory`.
- The route writes markdown pages through the GBrain CLI.
- Catch me up saves a source bundle.
- Add note saves a note when the bridge is available.

### Fallback

- If GBrain is unavailable, the UI continues with local demo memory.

## ZeroEntropy / Source Retrieval

### Current Role

ZeroEntropy acts as the live retrieval layer over messy family-care context.

### Corpus

Synthetic corpus includes:

- family messages
- family notes
- task tracker items
- calendar blocks
- learned communication patterns
- pharmacy notifications
- provider boundaries
- provider messages

### What Works

- Vite exposes `POST /api/carecircle/context-search`.
- With `ZEROENTROPY_API_KEY`, the route indexes and queries the corpus.
- Without the key, it falls back to local retrieval.
- Timeline search can show retrieved snippets.

## Safety Rules

- Do not diagnose dementia or medical conditions.
- Do not claim medication caused symptoms.
- Say family notes mention symptoms.
- Say may be worth checking.
- Medication-related outputs stay under human review.
- CareCircle prepares actions; it does not replace family, doctors, pharmacists, or caregivers.

## Environment

Run app:

```bash
bun run --cwd apps/mac dev
```

Run with ZeroEntropy:

```bash
ZEROENTROPY_API_KEY=your_key bun run --cwd apps/mac dev
```

Run with agentic Catch me up:

```bash
CARE_AGENT_API_KEY=your_key bun run --cwd apps/mac dev
```

Optional agent environment:

- `CARE_AGENT_API_KEY` or `OPENAI_API_KEY`
- `CARE_AGENT_MODEL` defaults to `gpt-4o-mini`
- `CARE_AGENT_API_URL` defaults to OpenAI-compatible chat completions

Expected local GBrain paths:

- `../gbrain`
- `../.gbrain-carecircle`

## Verification

Current checks:

```bash
node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

Both pass as of this update.

## Remaining Product Opportunities

### Useful Agent Extension

The next useful agent layer would be a tiny follow-through agent:

1. Reads the current action state.
2. Checks whether family update, reminder, and provider review are done.
3. Produces a "Handled for you" action log.
4. Suggests the next one safe action.

This would make CareCircle feel more capable without granting it risky autonomous sending permissions.

### Other Next Steps

- Add a handled-for-you action log.
- Add a source-search modal from Timeline for deeper retrieval.
- Make retrieved snippets flow into the Catch me up animation.
- Add mock PDF/CSV/ICS/email documents to the retrieval corpus.
- Add real calendar integration later through Google or Apple Calendar auth.
