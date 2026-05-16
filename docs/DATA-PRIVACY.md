# DYAD data handling & privacy (#87)

This document is the single source of truth for what DYAD reads, what
leaves your device, what is stored locally, and how to delete it all.
Linked from the in-app onboarding and the settings panel.

For the security posture (binding, file permissions, threat model),
see [`SECURITY.md`](SECURITY.md).

## What DYAD reads

- Your iMessage history at `~/Library/Messages/chat.db`
- **Read-only** — DYAD never writes to chat.db
- Only the **conversation you select** in onboarding, scoped by `chat_id`
- iMessage attachments (photos, voice memos) are ignored

## What leaves your device

| Goes out | To | Why |
|----------|-----|-----|
| **Redacted message text** | Anthropic API (api.anthropic.com) | L2 extraction + briefs + reframes |
| Aggregate model snapshots | Optional GStack (if `GSTACK_URL` set) | Cross-session resume |
| Aggregate detector results | Optional GBrain (if configured) | History + trend comparisons |
| Conversation id (hashed) | Optional Hog (if `HOG_URL` set) | Partner context enrichment |

**Anthropic privacy policy:** <https://www.anthropic.com/legal/privacy>

**What gets redacted before any LLM call** (`PIIRedactor`):
- Phone numbers (US + international)
- Email addresses
- URLs
- `DYAD_PARTNER_NAME` → `[PARTNER]`
- `DYAD_USER_NAME` → `[USER]`

There is no DYAD-operated server. There is no DYAD cloud. We do not
collect telemetry beyond what runs locally for the in-app debug panel.

## What is stored locally

| Path | Mode | Contents |
|------|------|----------|
| `~/.dyad/checkpoint.json` | `0600` | Last seen `chat.db` row id |
| `~/.dyad/self-model.json` | `0600` | Derived self profile (no raw text) |
| `~/.dyad/partner-model-<dyad>.json` | `0600` | Derived partner fingerprint (no raw text) |
| `~/.dyad/relationship-model.json` | `0600` | Derived relationship metrics (no raw text) |
| `~/.dyad/dyad.log` | `0600` | Engine logs — message ids and counts only, no text |

The directory itself is `0700` (owner-only). The writers go through
`secureWriteFile` (`packages/engine/src/secure-fs.ts`) which enforces
the modes after every save.

## What is NOT stored

- Raw message text from `chat.db` — not in any model snapshot, not in
  any log, not anywhere on disk after the redacted copy has been sent
  to Anthropic
- Contact names or handles in plaintext — `handle_id` and `chat_id` are
  SHA-256 hashed at the boundary of `ChatDbReader`
- Anthropic API responses verbatim — only the parsed structured fields
  are kept

## How to delete everything

```bash
# Nuclear option — clears every byte DYAD has on this device
rm -rf ~/.dyad/

# Plus the app-side preferences (conversation pick, debug toggles)
# Open DYAD → Settings (⌘,) → Data → Delete all DYAD data
```

The Settings panel "Delete all DYAD data" button does both in one step.

## What DYAD will NOT do

- Will not retain raw message content after processing
- Will not share data with third parties beyond the explicit API calls above
- Will not access messages outside the conversation you selected in onboarding
- Will not auto-update or phone home

## Verifying these claims

Run:

```bash
# 1. Confirm no raw text in saved models
jq . ~/.dyad/*.json | grep -i 'text\|message_body' || echo "no raw text — good"

# 2. Confirm no raw text in logs
grep -i 'text:\|message_body' ~/.dyad/dyad.log || echo "no raw text in logs — good"

# 3. Confirm 0600 permissions
ls -la ~/.dyad/
```

## Reporting

Privacy concerns or suspected leaks: open a private security advisory on
the repository (do not file a public issue).
