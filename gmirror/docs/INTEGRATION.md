# Embedding GMirror In Other Projects

GMirror can run as a CLI gate, MCP server, or TypeScript library.

## CLI Integration

```bash
npm install
npm run build
node ./dist/cli.js score --diff ./change.patch --panel-size 10
```

CI pipelines should call the pinned checkout's `dist/cli.js` and fail the job on `risky` or `fail`
verdicts according to the project release policy.

## MCP Integration

```json
{
  "mcpServers": {
    "gmirror": {
      "command": "node",
      "args": ["./dist/cli.js", "serve"],
      "env": {
        "GMIRROR_DB_PATH": "./.gmirror/gmirror.db"
      }
    }
  }
}
```

Expose write tools only to trusted callers. `gmirror_score` can trigger model spend and
`gmirror_calibrate` can change scoring behavior.

## TypeScript Integration

```ts
import { GMirror } from './dist/core/gmirror.js';

const gmirror = new GMirror();
const verdict = await gmirror.scoreChange({
  change_id: 'change-123',
  diff: '...',
  panel_size: 10,
});
```

Library callers are responsible for state directories, model credentials, and endpoint
configuration.

## Runtime Requirements

- Writable SQLite database path.
- Writable receipt and audit directories.
- Model-provider credentials if model-backed scoring is enabled.
- Optional GBrain endpoint for receipt storage and retrieval.
