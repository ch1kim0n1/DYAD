# DYAD — iOS companion

Glance surface for DYAD. The Mac runs the engine; the phone is a thin
read-only client that hits the Mac's sidecar HTTP server.

## Running

Pre-requisites match `absolute-docs/tech-stack.md`:
- Xcode signed into a free Apple ID
- iPhone trusts your Mac via USB
- Expo CLI: `bun add -g expo`

```bash
# In one terminal: start the Mac sidecar
bun run --cwd apps/mac sidecar:dev

# In another terminal: find your Mac's LAN IP, then start Expo
EXPO_PUBLIC_DYAD_SIDECAR_URL="http://192.168.1.42:7432" \
  bun run --cwd apps/phone start
```

Press `i` in the Expo terminal to open in the iOS simulator, or scan the
QR code with the Camera app on a real iPhone (must be on the same Wi-Fi).

## What it does (today)

- Polls the Mac sidecar's `/status` on pull-to-refresh
- Shows the latest Gottman status badge
- Surfaces offline state with a red badge
- "Open Mac app" button (deep link wiring to follow)

## What it doesn't do yet

- Charts (Map, Atlas, Mirror) — Mac-only for now
- Notifications — uses macOS notifications (`apps/mac/src/lib/notifications.ts`)
- Onboarding — pairs with the Mac via shared LAN, no separate flow

This is the surface area the DDD calls "mobile-first." The analytical
heavy lifting stays on the Mac so we don't ship LLM keys to a phone or
duplicate the engine on two devices.
