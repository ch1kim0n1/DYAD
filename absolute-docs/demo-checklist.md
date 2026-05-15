# Demo readiness checklist (#55)

Final pre-demo run-through. Print this and tick boxes on the demo machine
(not the dev machine).

## T-24h: pre-warm cache

```bash
# In one terminal
bun run --cwd apps/mac sidecar:dev

# In another terminal
bun run scripts/prewarm-demo.ts --fixture scripts/fixtures/healthy-couple.json
# or for live data:
bun run scripts/prewarm-demo.ts --live --conversation-id <id> --days 7
```

The script prints `cache pre-warmed. N messages, M briefs ready.` when done.

## T-2h: smoke test

```bash
bun run scripts/checkpoint-3-demo.ts --fixture scripts/fixtures/bid-asymmetry.json
```

All steps should be `✓`. If any are `✗`, stop and debug before demo.

## T-15min: full app launch

1. [ ] Launch DYAD desktop app (`bun run --cwd apps/mac tauri:dev`)
2. [ ] App shows "Engine loading…" then green dot "Live"
3. [ ] Conversation id pill visible in header
4. [ ] "updated just now" timestamp visible
5. [ ] Map view renders self + partner valence over time (last 50 messages)
6. [ ] Atlas view shows the Gottman status badge with appropriate colour
7. [ ] At least one detector annotation visible on the Map
8. [ ] Click the annotation → brief panel shows in Divergence view
9. [ ] Click "See another perspective" → reframe appears within 10s
10. [ ] Mirror view shows the NRC radar + I/we/you bars + attachment bars
11. [ ] Keyboard shortcut Cmd+1/2/3/4 cycles views
12. [ ] App stays responsive for 5 minutes without restart

## Failure paths to rehearse

- **Engine sidecar not running** → red dot "Disconnected" in header
- **chat.db unreadable / Full Disk Access denied** → error banner, but
  Mirror still renders empty state
- **Ethical refusal triggered** → CrisisOverlay covers the screen,
  Mirror remains the only accessible tab after dismiss
- **No detectors fire** → views render baseline metrics, no markers

## Pass criteria

- [ ] All 12 launch steps complete without console errors
- [ ] No unhandled promise rejections in devtools
- [ ] Pre-warm cache hit rate ≥ 90% (briefs return in < 100ms on hit)
- [ ] Pre-demo `checkpoint-3-demo.ts` reports all green
