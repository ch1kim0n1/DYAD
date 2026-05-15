# DYAD security posture (#69)

This document describes DYAD's threat model, the local-only data path, and
the audited controls that guard against accidental leakage.

## Threat model

DYAD reads private message content from `~/Library/Messages/chat.db` and
sends *redacted, normalised* slices to the Anthropic API to extract bid
classifications, emotional layering, briefs, and reframes. The threats we
explicitly defend against:

| Threat | Mitigation |
|--------|-----------|
| Anyone else on the local network reaching the engine sidecar | Sidecar binds to `127.0.0.1`, never `0.0.0.0` |
| Other local users reading saved state | `~/.dyad/` created at `0700`, files at `0600` |
| Message text leaking via logs | No `console.log(message.text)` anywhere; logs use ids only |
| API keys leaking via the GStack snapshot | API keys are read from env in the *process*; nothing sends them to GStack |
| Plain `.env` accidentally committed | `.env` is in `.gitignore`; CI does not have access |
| Partner / user names leaking to Anthropic | `PIIRedactor` runs **before** any LLM call (`DYAD_PARTNER_NAME` → `[PARTNER]`, `DYAD_USER_NAME` → `[USER]`) |

## Local data path

```
chat.db  →  ChatDbReader (hashes handle_id + chat_id, SHA-256)
         →  MessageNormalizer (Apple-epoch → ISO, hash-derived message_id)
         →  PIIRedactor (URL/email/phone/partner-name/user-name)
         →  ExtractionPipeline (L1 lexicons + L2 Claude)
         →  ~/.dyad/<self|partner|relationship>-model-*.json  (0600)
```

The only fields that ever leave the machine are the **redacted text** and
the **derived features**. The raw `text` field of a `RawMessage` is
discarded after redaction; the `NormalizedMessage.text` that the rest of
the pipeline sees is already PII-stripped.

## API key handling

`ANTHROPIC_API_KEY` (and the optional `GBRAIN_API_KEY` / `HOG_API_KEY` /
`JO_API_KEY`) are read at process start from environment variables. The
options for handing the key to the process:

1. **Development (recommended).** `.env` next to `package.json`. The Bun
   sidecar and Vite frontend both auto-load it. `.env` is gitignored.
2. **Distributed builds (recommended for end-users).** macOS Keychain.
   On first run the app prompts for the key, stores it in Keychain via
   `security add-generic-password`, and the sidecar reads it back with
   `security find-generic-password`. The onboarding flow surfaces this
   path; an implementation hook is in `apps/mac/src/components/OnboardingFlow.tsx`
   under the *Keychain storage* note.
3. **CI / automation.** Use repository secrets. Never check a key into
   the tree. We've grep-checked the repo and there are no Anthropic key
   patterns (`sk-ant-*`) in source.

## Sidecar binding

`apps/mac/src-tauri/sidecar/engine-server.ts` calls `serve({ hostname: '127.0.0.1', port: 7432 })`.
Verify with `lsof -iTCP -sTCP:LISTEN -P` — the sidecar should appear bound
to `127.0.0.1:7432`, not `*:7432`.

If you need to access the sidecar from a remote machine for testing, run
an SSH tunnel rather than rebinding to `0.0.0.0`.

## Filesystem permissions

| Path | Mode |
|------|------|
| `~/.dyad/` | `0700` |
| `~/.dyad/checkpoint.json` | `0600` |
| `~/.dyad/checkpoint-<conv>.json` | `0600` |
| `~/.dyad/self-model.json` | `0600` |
| `~/.dyad/partner-model-<dyad>.json` | `0600` |
| `~/.dyad/relationship-model.json` | `0600` |

All writers go through `secureWriteFile` (`packages/engine/src/secure-fs.ts`)
which calls `chmod 0600` after every write. The checkpoint writer in
`packages/ingestion/src/checkpoint-persistence.ts` enforces the same.

## Logging hygiene

- Default log level is `info`. Set `LOG_LEVEL=warn` for production builds.
- The sidecar logs only `dyad_id`, `message_id`, and counts — never `text`.
- The cost meter logs token counts + USD when `DYAD_LOG_COSTS=1`. It
  never logs payloads.

## Verifying the posture

```bash
# 1. No API keys in source
grep -r "sk-ant-" .   # should produce zero matches

# 2. Sidecar bound to loopback
lsof -iTCP:7432 -sTCP:LISTEN -P

# 3. ~/.dyad mode
stat -f '%Sp' ~/.dyad           # → drwx------
stat -f '%Sp' ~/.dyad/*.json    # → -rw-------

# 4. No text in logs
DYAD_LOG_COSTS=1 bun run --cwd apps/mac sidecar:dev 2>&1 | grep -i 'text:' || echo "clean"
```

## Reporting

If you find a security issue: open a private security advisory on the
repository, do not file a public issue.
