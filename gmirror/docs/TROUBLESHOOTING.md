# GMirror Troubleshooting

## Score Produces No Verdict

Check input diff/artifact path, panel size, model credentials, and sandbox availability. Run:

```bash
node dist/cli.js health
node dist/cli.js sandbox-stats
```

## Too Many Risky Verdicts

Review calibration, scenario mix, and failure-mode severity mapping. A high adversarial ratio can
make a normal change look riskier than intended.

## Failure Modes Are Too Generic

Use a smaller scenario set and inspect raw synthetic user outputs. Generic modes usually mean the
runner lacked enough context or the analyzer received sparse evidence.

## MCP Contract Check Fails

```bash
npm run check:mcp-contract
rg "gmirror_" src/mcp/server.ts
```

Update server, tests, and contract docs together if tool names change.

## TypeDoc Generation Fails

```bash
npx typedoc@0.25.13 --options typedoc.json
```

Fix unresolved entry points or TypeScript syntax first.

## Receipts Cannot Be Written

Check receipt directory permissions, JSONL lock files, disk space, and process user permissions.
Receipts are append-only; append a superseding receipt instead of editing history.
