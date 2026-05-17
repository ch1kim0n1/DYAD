// POST a run record, attach a receipt, then query runs by task_id.
// Demonstrates GBrain as a tamper-evident execution receipt store.
// Requires: GBrain server running (npm run dev in gbrain/)
// Env vars: GBRAIN_URL (default: http://localhost:3000)
//
// Usage: node examples/run-as-receipt-store.js

const baseUrl = process.env.GBRAIN_URL ?? 'http://localhost:3000';
const taskId = `task-${Date.now()}`;

async function main() {
  // 1. Create a run record for our task
  const runRes = await fetch(`${baseUrl}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      config: { model: 'claude-sonnet-4-6', temperature: 0.7 },
      verdict: 'pass',
      cost_usd: 0.0042,
    }),
  });

  if (!runRes.ok) {
    console.error('Failed to create run:', runRes.status, await runRes.text());
    process.exit(1);
  }

  const run = await runRes.json();
  console.log('Created run:', JSON.stringify(run, null, 2));

  // 2. Attach a receipt to the run
  const receiptRes = await fetch(`${baseUrl}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: run.id,
      fingerprint: `sha256-example-fingerprint-${Date.now()}`,
      payload: {
        rubric: 'gmirror_v1',
        scores: { correctness: 0.9, user_outcome: 0.85 },
        timestamp: new Date().toISOString(),
      },
    }),
  });

  if (!receiptRes.ok) {
    console.error('Failed to attach receipt:', receiptRes.status, await receiptRes.text());
    process.exit(1);
  }

  const receipt = await receiptRes.json();
  console.log('\nAttached receipt:', JSON.stringify(receipt, null, 2));

  // 3. Query runs by task_id
  const queryRes = await fetch(`${baseUrl}/runs?task_id=${encodeURIComponent(taskId)}`);

  if (!queryRes.ok) {
    console.error('Failed to query runs:', queryRes.status, await queryRes.text());
    process.exit(1);
  }

  const runs = await queryRes.json();
  console.log(`\nFound ${runs.length} run(s) for task_id=${taskId}`);

  if (runs.length === 0) {
    console.error('Expected at least one run for our task_id.');
    process.exit(1);
  }

  console.log('\nAll checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
