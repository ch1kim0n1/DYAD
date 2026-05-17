## Quickstart (60 seconds)

```bash
npm install gbrain
```

```typescript
import { GBrainSDK } from 'gbrain/sdk';
const brain = new GBrainSDK(); // zero config — embedded SQLite, no API key needed
const page = brain.createPage({ content: 'My first note', page_kind: 'note' });
console.log('Created:', page.id);
```

> No Docker. No services. Embedded SQLite knowledge store — no server required.

---

# GBrain

SQLite-backed persistence layer for the G-Stack. Stores memories, execution receipts, observations, cognitive state, and drift metrics.

## Installation

```bash
npm install gbrain
```

Or run locally:

```bash
npm install
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GBRAIN_DB_PATH` | SQLite database file path | `~/.gbrain/gbrain.db` |
| `PORT` | HTTP server port | `3000` |
| `GBRAIN_AUTH_TOKEN` | Bearer token for API authentication (if set, required for `/api` routes) | None (disabled) |
| `GBRAIN_RATE_LIMIT_RPM` | Rate limit per IP for API routes (requests per minute) | `60` |

## Authentication and Rate Limiting

### Authentication

GBrain supports optional Bearer token authentication for API endpoints:

```bash
# Enable authentication by setting GBRAIN_AUTH_TOKEN
export GBRAIN_AUTH_TOKEN=your-secret-token

# Clients must include the token in requests
curl -H "Authorization: Bearer your-secret-token" http://localhost:3000/api/memories
```

If `GBRAIN_AUTH_TOKEN` is not set, authentication is disabled and all `/api` routes are publicly accessible.

### Rate Limiting

API endpoints are rate-limited by IP to prevent abuse:

```bash
# Configure rate limit (requests per minute per IP)
export GBRAIN_RATE_LIMIT_RPM=120
```

When the rate limit is exceeded, the server responds with `429 Too Many Requests` and includes a `Retry-After` header indicating when to retry.

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/memories` | Create a memory with content, tags, and metadata |
| `GET` | `/memories` | Query memories (`?q=<text>`) |
| `GET` | `/memories/:id` | Get a memory by ID |
| `DELETE` | `/memories/:id` | Delete a memory |
| `POST` | `/receipts` | Store an execution receipt |
| `GET` | `/receipts` | List receipts (`?limit=`, `?offset=`) |
| `POST` | `/observations` | Record an observation event |
| `GET` | `/observations` | List observations |
| `GET` | `/pages` | List pages |
| `POST` | `/pages` | Create a page |
| `GET` | `/runs` | List agent runs |
| `POST` | `/runs` | Record an agent run |
| `GET` | `/drift` | Get drift metrics |
| `GET` | `/cognitive` | Get cognitive state |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |

## Usage

### As a library

```typescript
import { getDb, createMemory, queryMemories } from 'gbrain';

const db = getDb();

await createMemory(db, {
  content: 'Important project context',
  tags: ['project', 'context'],
  metadata: { source: 'manual' },
});

const memories = await queryMemories(db, 'project context');
```

### As a server

```bash
npm run build
npm start
# Listening on http://localhost:3000
```

## Development

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm test           # Run Jest tests
npm run typecheck  # Type-check without emit
```

## License

MIT
