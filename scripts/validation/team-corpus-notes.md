# Team corpus validation notes (#51)

Template for each team member who runs the engine against their real,
private iMessage history. **No raw message content is committed**. Only the
aggregate metrics and the team member's subjective comparison.

## How to run

```bash
# 1. Make sure Full Disk Access is granted to your terminal / Bun
# 2. Start the sidecar in a separate tab
bun run --cwd apps/mac sidecar:dev

# 3. Live ingestion (will hit chat.db via the sidecar)
bun run scripts/ingest-corpus.ts --live --days 30 --conversation-id <hashed-chat-id>

# 4. (optional) audit metrics offline
bun run scripts/accuracy-audit.ts
```

## Per-person template

Duplicate this block per team member who runs the audit. Fill in the
quantitative columns from `scripts/output/live-<id>-results.json` and the
qualitative columns from your own knowledge of the relationship.

### Team member: _________
**Run date:** _________
**Conversation:** _________ (hashed id)
**Messages analysed:** _________
**Days covered:** _________

| Metric (engine) | Value | Your subjective rating |
|-----------------|-------|------------------------|
| gottman_status | | |
| five_to_one_ratio | | |
| bid_response_rate.partner | | |
| bid_response_rate.self | | |
| repair_labor_index | | |
| mirroring_index | | |
| bid_asymmetry.detected | | matches reality? |
| predictive_divergence.detected | | matches reality? |
| phantom_third_party.detected | | matches reality? |

### False-positive / false-negative log

| Detector | Type (FP / FN) | What you saw | What the detector reported | Likely cause |
|----------|---------------|--------------|----------------------------|--------------|
|  |  |  |  |  |

### Threshold tuning notes

Document anything you changed in the detector source files. Format:

```
file: packages/engine/src/detectors/bid-asymmetry.ts
field: MIN_BID_COUNT
old: 10
new: 15
reason: my real corpus has lots of short transactional bids, raised the
        floor so casual logistics chatter doesn't dominate.
```

## Acceptance summary (filled after at least 2 team runs)

- [ ] ≥ 2 team members ran live ingestion
- [ ] False positive rate < 30% for bid_asymmetry on real data
- [ ] False positive rate < 30% for predictive_divergence on real data
- [ ] Gottman status matches subjective rating in ≥ 70% of cases
- [ ] Any threshold changes have `// Tuned from accuracy audit` comments

## Privacy posture

This file lives in the repo. Do **not** commit:
  - message text
  - real participant_id values (use hashes)
  - chat_id values (use hashes; the engine already hashes them)

Aggregate numeric metrics are fine to commit.
