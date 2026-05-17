// POST a code diff to /gmirror/score and print the scoring verdict.
// Demonstrates the GMirror quality scoring API with a sample diff.
//
// Requires: GMirror server running (npm run serve in gmirror/)
// Env vars:
//   GMIRROR_URL      (default: http://localhost:3002)
//   ANTHROPIC_API_KEY (required by GMirror for LLM scoring)
//
// Usage: node examples/score-a-diff.js

const baseUrl = process.env.GMIRROR_URL ?? 'http://localhost:3002';

const sampleDiff = `
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,15 @@ export function add(a: number, b: number): number {
   return a + b;
 }

+/**
+ * Safely divide two numbers.
+ * Returns null when divisor is zero instead of throwing.
+ */
+export function safeDivide(a: number, b: number): number | null {
+  if (b === 0) return null;
+  return a / b;
+}
+
 export function multiply(a: number, b: number): number {
   return a * b;
 }
`;

async function main() {
  console.log(`Scoring diff against GMirror at ${baseUrl}`);

  const res = await fetch(`${baseUrl}/gmirror/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: `example-${Date.now()}`,
      task: 'Add a safeDivide utility function that handles division by zero gracefully',
      output: sampleDiff,
      metadata: {
        language: 'typescript',
        change_type: 'feature',
        lines_added: 9,
        lines_removed: 0,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`GMirror returned ${res.status}:`, body);
    console.log('\nMake sure GMirror is running:  npm run serve  (in gmirror/)');
    process.exit(1);
  }

  const verdict = await res.json();
  console.log('\nScoring verdict:');
  console.log(JSON.stringify(verdict, null, 2));

  const score = verdict.score ?? 0;
  console.log(`\nOverall score: ${(score * 100).toFixed(1)}%`);
  console.log(`Confidence:    ${((verdict.confidence ?? 0) * 100).toFixed(1)}%`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
