# CareCircle Feature Status

Last updated: May 16, 2026

## Demo Thesis

CareCircle helps an exhausted family caregiver come home, check once, and feel caught up. It pulls context from messy family-care sources, explains what changed, and stages safe next actions without auto-sending anything sensitive.

## What Works Now

### Demo Shell

- App opens directly into CareCircle demo mode.
- Main tabs are available: Dashboard, Timeline, Care Brief, Messages, Trust.
- UI uses a calm off-white visual direction with readable cards and staged animations.
- The main demo path is Dashboard -> Catch me up -> Care Brief -> action cards.

### Dashboard

- Shows the family circle: Linda, Maya, Sarah, Arjun, Dr. Chen.
- Each person card emphasizes what CareCircle knows or is doing now, not just static roles.
- Dashboard has one primary action: Catch me up.
- Status copy updates based on care plan/action state.

### Timeline

- Shows source-visible care events.
- Supports search across timeline text, tags, people, source type, and evidence.
- Shows source badges such as family note, messages, calendar, pharmacy notification, task, and learned pattern.
- Clicking evidence chips opens a source overlay with source type, person, sensitivity, timestamp, related people, and tags.
- Supports adding a live family note.
- Live notes appear immediately in the Timeline, newest-first.
- Live notes show whether they were saved to GBrain or are in demo fallback memory.

### Catch Me Up Flow

- Clicking Catch me up shows a synthesis animation instead of instantly revealing a static page.
- The animation reads from the latest Timeline graph, including live notes.
- Observation chips stream in with source labels.
- Clusters resolve into the brief.
- The source bundle is sent to the local GBrain bridge when available, with local fallback.

### Care Brief

- Shows the brief headline and care-plan checklist.
- Shows three primary action cards:
  - Queue family update
  - Schedule reminder
  - Review and approve
- Shows why the plan was staged, including insights, confidence, safety level, and evidence chips.
- Shows unresolved loops and Linda preferences with source notes.
- Removed lower-value GBrain/provider detail panels from the main brief to keep it judge-friendly.

### Practical Actions

- Queue family update opens a prefilled SMS draft.
- Schedule reminder downloads a real `.ics` calendar file.
- Review and approve runs the provider handoff check, then opens a prefilled email draft.
- Messages can still be copied or queued from the composer.
- Provider-related action remains approval-first.

### Calendar-Aware Scheduling

- Care Brief includes a calendar-aware reminder panel.
- Shows suggested reminder slots.
- Slots indicate whether they are free or conflicting.
- Includes mock busy blocks for Maya.
- Users can add a busy block such as `class Sunday 10pm`.
- The parser extracts the title, weekday, and time from natural-ish input.
- The `.ics` reminder uses the selected slot.

### Messages

- Shows three draft cards:
  - Check-in for Mom
  - Family update
  - Pharmacy summary
- Each card opens into an editable composer.
- Composer explains why each draft was written that way.
- Mom and family drafts can open SMS.
- Family and pharmacy drafts can open email.
- Pharmacy summary keeps approval-first safety framing.

### Trust Center

- Shows privacy and safety posture as a compact checklist.
- Covers synthetic demo data, explicit sharing, source visibility, export/delete controls, no model training, and human review for medical concerns.
- Runtime reset is available from Trust.

### GBrain Integration

- Local GBrain was initialized under `.gbrain-carecircle`.
- Vite dev server exposes a local bridge route:
  - `POST /api/carecircle/gbrain-memory`
- The bridge calls the real GBrain CLI with `gbrain put`.
- Catch me up attempts to save the source bundle into GBrain.
- Adding a family note attempts to save the note into GBrain.
- If GBrain is unavailable, the app silently falls back to local demo memory.

### ZeroEntropy / Retrieval Integration

- Added a messy synthetic source corpus with 24 documents.
- Sources include family messages, notes, task tracker entries, calendar blocks, learned patterns, provider boundaries, pharmacy notifications, and provider messages.
- Vite dev server exposes:
  - `POST /api/carecircle/context-search`
- If `ZEROENTROPY_API_KEY` is set, the route creates/uses a ZeroEntropy collection, uploads the corpus, and queries top snippets.
- If ZeroEntropy is unavailable, the route falls back to local retrieval.
- Care Brief includes a compact "Messy source retrieval" panel.
- The visible UI says "Live retrieval" rather than shilling the vendor.

## Safety Boundaries

- No diagnosis language.
- Medication-related items use "may be worth checking" framing.
- Provider summaries say family notes mention symptoms, not that medication caused symptoms.
- Sensitive provider messages require human approval before sharing.
- The system prepares actions; it does not replace family, doctors, pharmacists, or caregivers.

## Environment / Run Notes

Start the app:

```bash
bun run --cwd apps/mac dev
```

Use ZeroEntropy live retrieval:

```bash
ZEROENTROPY_API_KEY=your_key bun run --cwd apps/mac dev
```

The GBrain bridge expects:

- GBrain repo at `../gbrain`
- GBrain home at `../.gbrain-carecircle`

## Verified

- `node_modules/.bin/tsc --noEmit --pretty false` passes.
- `git diff --check` passes.

## Known Limitations

- Calendar integration uses mock busy blocks, not Google/Apple Calendar auth.
- SMS/email actions open local client drafts via URL schemes; they do not send automatically.
- Provider handoff route is demo-safe and deterministic.
- ZeroEntropy ingestion is synthetic and may need a short indexing delay on first run.
- Build can fail locally because of a Rollup native binary/code-signing issue unrelated to the CareCircle code.

## Recommended Demo Script

1. Dashboard: "Maya comes home and taps Catch me up."
2. Catch-up animation: "CareCircle reads the week from messages, notes, calendar, pharmacy alerts, learned patterns, and live notes."
3. Care Brief: "It found three changes and staged three actions."
4. Calendar panel: "It avoids conflicts before creating the reminder."
5. Messy source retrieval: "It can retrieve the strongest sources from a larger messy corpus."
6. Messages: "Drafts are editable and explain why they were written this way."
7. Trust: "Nothing sensitive goes out without approval."

## Best Next Improvements

- Add one clean action log: "Handled for you."
- Show retrieved snippets flowing into the Catch me up animation.
- Add richer mock file types to the retrieval corpus, such as `.ics`, `.eml`, `.csv`, and a PDF-like `text-pages` document.
- Make the Timeline source overlay slightly more compact.
- Add a one-click "Demo reset" control that clears runtime state but keeps fixture data.
