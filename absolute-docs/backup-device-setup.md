# Backup demo device setup (#57)

Hardware failure during a live demo is a real risk. This doc walks through
provisioning a second macOS machine so a hot-swap takes < 2 minutes.

## Inventory checklist

- [ ] macOS version matches the primary device (record both: primary _____, backup _____)
- [ ] Same Bun version (`bun --version` matches)
- [ ] Same Rust toolchain (`rustc --version` matches)
- [ ] Same Xcode command-line tools (run `xcode-select --install` once)
- [ ] Backup device named distinctly in System Settings (e.g. "DYAD-backup-1")

## One-time provisioning

```bash
# 1. Clone repo into ~/dyad
git clone https://github.com/ch1kim0n1/DYAD.git ~/dyad
cd ~/dyad

# 2. Install dependencies
bun install

# 3. Bring over the .env from the primary device.
#    Use a USB or 1Password share — do NOT email.
cp /path/to/primary/.env .env

# 4. Build the engine sidecar binary
bun run --cwd apps/mac sidecar:build

# 5. Build the Tauri production bundle (takes 5-10 min)
bun run --cwd apps/mac tauri:build
# Bundle ends up at apps/mac/src-tauri/target/release/bundle/macos/DYAD.app
```

## macOS permissions

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Add `Terminal.app` and the built `DYAD.app`
3. Restart Terminal after granting access

Verify with:
```bash
bun run scripts/checkpoint-1-ingestion.ts --live --days 7
```
The "messages loaded" row must show ≥ 1.

## Env-var parity

| Variable | Why it matters |
|----------|----------------|
| `ANTHROPIC_API_KEY` | Required for L2 extraction + brief / reframe generation |
| `DYAD_CONVERSATION_ID` | Scopes which chat is analysed; same as primary |
| `GSTACK_URL` / `GSTACK_API_KEY` | Optional but recommended so the backup picks up the same persisted state |
| `GSTACK_SESSION_ID` | Hot-swap: if set to the primary's session id, the backup resumes the same session |
| `HOG_URL` / `THE_HOG_API_KEY` | Optional partner enrichment |
| `JO_URL` / `JO_API_KEY` | Optional user life context |

## Pre-warm + smoke

```bash
# Run the night before
bun run --cwd apps/mac sidecar:dev &
bun run scripts/prewarm-demo.ts --live --days 7
bun run scripts/checkpoint-3-demo.ts --fixture scripts/fixtures/bid-asymmetry.json
```

All three must succeed before the device is considered ready.

## Hot-swap procedure (< 2 minutes)

1. Quit DYAD on the primary device.
2. On the backup: `bun run --cwd apps/mac tauri:dev` (or open the built app)
3. Backup pulls the same `GSTACK_SESSION_ID` and resumes immediately.
4. Confirm the conversation pill and "Live" status indicator before
   continuing the demo.

## Differences to document

After provisioning, note anything that differs from primary so on-the-fly
troubleshooting is faster:

| Item | Primary | Backup |
|------|---------|--------|
| macOS version |  |  |
| Bun version |  |  |
| Last sync of `.env` |  |  |
| Last prewarm run |  |  |
| GStack session id |  |  |
