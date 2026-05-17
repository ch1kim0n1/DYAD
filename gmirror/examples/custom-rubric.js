// Show how to use a custom rubric with GMirror.
//
// Phase 8 (gmirror/src/core/gmirror-rubric.ts) exports GMIRROR_RUBRIC_V1
// and the RubricFramework type so you can extend it:
//
//   import { GMIRROR_RUBRIC_V1, type RubricFramework } from 'gmirror';
//
// Until Phase 8 is compiled, this example shows the standard scoring flow
// with comments pointing to the customization hooks added in Phase 8.
//
// Requires: GMirror server running (npm run serve in gmirror/)
// Env vars:
//   GMIRROR_URL       (default: http://localhost:3002)
//   ANTHROPIC_API_KEY (required by GMirror)
//
// Usage: node examples/custom-rubric.js

const baseUrl = process.env.GMIRROR_URL ?? 'http://localhost:3002';

// --- Phase 8 customization (TypeScript, in your app code) ---
//
// import { GMirror, GMIRROR_RUBRIC_V1, type RubricFramework } from 'gmirror';
//
// const myRubric: RubricFramework = {
//   ...GMIRROR_RUBRIC_V1,
//   name: 'my_custom_rubric_v1',
//   dimensions: [
//     ...GMIRROR_RUBRIC_V1.dimensions,
//     {
//       name: 'documentation',
//       description: 'Public API surface is fully documented with JSDoc',
//       min: 0, max: 1, weight: 0.1, pass_floor: 0.5,
//     },
//   ],
// };
//
// const gmirror = new GMirror({ rubric: myRubric });
// --------------------------------------------------------

async function main() {
  console.log(`Demonstrating standard scoring flow at ${baseUrl}`);
  console.log('(Custom rubric support added in Phase 8 — see comments above)\n');

  const res = await fetch(`${baseUrl}/gmirror/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: `custom-rubric-example-${Date.now()}`,
      task: 'Refactor database query to use parameterized statements',
      output: `
        // Before: vulnerable to SQL injection
        // const row = db.query(\`SELECT * FROM users WHERE id = \${id}\`);

        // After: parameterized query
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      `,
      metadata: {
        rubric_hint: 'security-focused',
        // Phase 8: pass rubricId here to select a registered rubric by name
        // rubricId: 'my_custom_rubric_v1',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`GMirror returned ${res.status}:`, body);
    process.exit(1);
  }

  const verdict = await res.json();
  console.log('Verdict with default rubric (GMIRROR_RUBRIC_V1):');
  console.log(JSON.stringify(verdict, null, 2));
  console.log('\nTo use a custom rubric, see Phase 8 comments in this file.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
