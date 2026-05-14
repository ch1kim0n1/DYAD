# Dyad — Tech Stack

Quick reference. Print or pin during the build.

## The decisions

- **Language:** TypeScript across the stack.
- **Mac app:** Tauri 2.0 + React + Tailwind + shadcn/ui.
- **Phone app:** Expo (React Native), free dev build signed with personal Apple ID, installed on your own iPhone.
- **Apple Developer account:** Not buying it. Free 7-day dev signing covers the hackathon. Re-sign if needed for post-hackathon investor demos.
- **Hackathon stack:** GStack (orchestration), GBrain (state), The Hog (partner external context), jo (personal context).
- **LLM:** Anthropic API (Claude) unless GStack exposes one natively — check at hour 0.
- **Runtime:** Bun. Faster than Node, native TS, native SQLite, less setup.

## Stack at a glance

| Layer | Choice |
|---|---|
| Runtime | **Bun** (or Node 20+ as fallback) |
| Mac app shell | **Tauri 2.0** |
| UI framework | React + **Tailwind** + **shadcn/ui** |
| State | Zustand |
| iOS companion | **Expo** + React Native (free dev signing) |
| iMessage reader | `better-sqlite3` against `~/Library/Messages/chat.db` |
| File watching | `chokidar` |
| Tokenization / POS | `wink-nlp` |
| Function-word parser | Custom dictionary (~200 lines TS) — Pennebaker categories |
| Sentiment lexicons | NRC Emotion Lexicon + AFINN, loaded as JSON |
| LLM SDK | `@anthropic-ai/sdk` (JSON mode for structured extraction) |
| Charts (Map) | **Visx** (D3 in React) |
| Animation | **Framer Motion** |
| Orchestration | **GStack** (hackathon-provided) |
| Persistent state | **GBrain** (hackathon-provided) |
| Partner external context | **The Hog** (hackathon-provided) |
| Personal context | **jo** (hackathon-provided) |
| IPC (Mac ↔ phone, optional) | Local network HTTP via Bonjour/mDNS |

## API keys to have ready before hour 0

1. **GStack** — from hackathon org
2. **GBrain** — from hackathon org
3. **The Hog** — from hackathon org
4. **jo** — from hackathon org
5. **Anthropic API** — only if GStack doesn't wrap LLM access natively. Load $100 of credits.

Set these in a `.env` at the repo root. Never commit it.

```
ANTHROPIC_API_KEY=
GSTACK_API_KEY=
GBRAIN_API_KEY=
THE_HOG_API_KEY=
JO_API_KEY=
```

## Money

| Item | Cost |
|---|---|
| LLM API calls during build | $20–80 (cache aggressively) |
| Apple Developer account | **$0** — free dev signing on personal device |
| Hosting / domain | $0 during hackathon |
| Hackathon-provided services | $0 during hackathon |
| Lexicons / open-source libs | $0 |
| **Total expected spend** | **$20–80** |

## Free Apple ID signing — how it works

1. Sign in to Xcode with your free Apple ID.
2. Open the Expo iOS project in Xcode.
3. Set the team to your personal team.
4. Plug in your iPhone, trust the computer.
5. Build & run. App installs on phone, valid for 7 days.
6. If it expires, re-build from Xcode. Takes 30 seconds.

Limits: only on devices you physically own and trust; can't distribute through TestFlight; 3 free dev accounts per device per week. None of these matter for the hackathon.

## Pre-hackathon setup checklist

Do these the day before, not at hour 0.

- [ ] Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- [ ] Xcode installed and signed into a free Apple ID
- [ ] iPhone trusts your Mac, USB cable works
- [ ] Tauri prereqs installed (Rust toolchain, Xcode command-line tools)
- [ ] `npx create-tauri-app` runs successfully on a throwaway dir
- [ ] `npx create-expo-app` runs successfully on a throwaway dir
- [ ] Anthropic account exists, $100 credit loaded, key generated
- [ ] Hackathon API keys received, tested with a `curl` against each endpoint
- [ ] `~/Library/Messages/chat.db` accessible — Full Disk Access granted to your terminal in System Settings → Privacy & Security
- [ ] Repo created, `.env` set up, `.gitignore` covers `.env`, `node_modules`, `target/`, `dist/`
- [ ] NRC Emotion Lexicon and AFINN downloaded as JSON, committed to repo

## What lives where in the repo

```
dyad/
├── apps/
│   ├── mac/              # Tauri app (primary surface)
│   └── phone/            # Expo app (iOS companion, optional)
├── packages/
│   ├── engine/           # L2 signal extraction, L3 state, L4 detectors
│   ├── ingestion/        # chat.db reader, normalizer
│   ├── lexicons/         # NRC, AFINN, Pennebaker dictionary as JSON
│   ├── prompts/          # LLM system prompts with citations
│   └── shared/           # types, schemas
├── corpora/
│   ├── team/             # consenting team-member relationships
│   └── public/           # Jobs/Sculley, Dorsey/Williams
└── .env
```

Monorepo via Bun workspaces. Each `packages/*` is consumed by both apps.

## Hour-0 commands

```bash
bun install
bun run dev:mac        # Tauri dev mode, hot reload
bun run dev:phone      # Expo dev server, hot reload to iPhone
bun run engine:test    # run detectors against fixture corpus
```

## What to do if something breaks

| Problem | First move |
|---|---|
| LLM rate-limited mid-build | Switch to Claude Haiku for non-demo-path extraction; cache everything |
| Tauri build fails | `cargo clean && bun install && bun run dev:mac` |
| Expo build fails | `npx expo prebuild --clean && open ios/*.xcworkspace` |
| chat.db permission denied | Re-grant Full Disk Access to terminal, restart terminal |
| GStack/GBrain auth fails | Check `.env` is loaded; check the key isn't quoted weirdly |
| iPhone won't trust dev cert | Settings → General → VPN & Device Management → trust the cert |

---

*Lock this in before hour 0. Don't change stack decisions mid-build.*
