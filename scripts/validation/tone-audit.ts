#!/usr/bin/env bun
/**
 * Tone Audit — Issue #62
 * Scans brief/reframe prompt templates for harmful language patterns.
 * Checks for: victim-blaming, gaslighting, minimization, invalidation, directive language.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Harmful language patterns to detect
const PATTERNS = {
  victimBlaming: [
    /you're being too sensitive/i,
    /you're overreacting/i,
    /you're making a big deal out of nothing/i,
    /it's your fault/i,
    /you brought this on yourself/i,
    /you should have/i,
    /why didn't you/i,
  ],
  gaslighting: [
    /that never happened/i,
    /you're imagining things/i,
    /you're crazy/i,
    /you're being irrational/i,
    /you're delusional/i,
    /that's not what they meant/i,
  ],
  minimization: [
    /it's not that bad/i,
    /you'll get over it/i,
    /at least they didn't/i,
    /could be worse/i,
    /don't worry about it/i,
    /it's fine/i,
  ],
  invalidation: [
    /you shouldn't feel that way/i,
    /that's silly to feel/i,
    /just get over it/i,
    /stop being/i,
    /you're wrong to feel/i,
    /nobody feels that way/i,
  ],
  directive: [
    /you should/i,
    /you must/i,
    /you have to/i,
    /you need to/i,
    /you ought to/i,
    /tell them to/i,
  ],
};

interface AuditResult {
  file: string;
  category: string;
  pattern: RegExp;
  matches: string[];
  lineNumbers: number[];
}

const results: AuditResult[] = [];

function scanFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const [category, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      const matches: string[] = [];
      const lineNumbers: number[] = [];

      lines.forEach((line, idx) => {
        const match = line.match(pattern);
        if (match) {
          matches.push(match[0]);
          lineNumbers.push(idx + 1);
        }
      });

      if (matches.length > 0) {
        results.push({
          file: filePath,
          category,
          pattern,
          matches,
          lineNumbers,
        });
      }
    }
  }
}

// Scan prompt files
const promptFiles = [
  'packages/engine/src/intervention/brief-prompt.ts',
  'packages/engine/src/intervention/reframe-prompt.ts',
  'packages/prompts/src/llm-extraction-prompt.md',
];

const rootDir = process.cwd();
for (const file of promptFiles) {
  try {
    scanFile(join(rootDir, file));
  } catch (error) {
    console.error(`Error scanning ${file}:`, error);
  }
}

// Output results
console.log('=== Tone Audit Results ===\n');

if (results.length === 0) {
  console.log('✅ No harmful language patterns found in prompt templates.');
  console.log('\nAll prompts follow safe, non-judgmental tone guidelines.');
} else {
  console.log(`⚠️ Found ${results.length} potential issues:\n`);

  for (const result of results) {
    console.log(`📄 ${result.file}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Pattern: ${result.pattern}`);
    console.log(`   Matches: ${result.matches.join(', ')}`);
    console.log(`   Lines: ${result.lineNumbers.join(', ')}`);
    console.log('');
  }

  console.log('=== Recommendations ===');
  console.log('Review and revise the flagged sections to:');
  console.log('- Remove directive language ("you should", "you must")');
  console.log('- Replace with exploratory language ("you might", "one possibility")');
  console.log('- Avoid invalidation of user feelings');
  console.log('- Ensure tone is non-judgmental and supportive');
}

// Write results to file
const outputPath = join(rootDir, 'scripts/validation/tone-audit-results.md');
const reportContent = `# Tone Audit Results — Issue #62

## Summary
${results.length === 0 
  ? '✅ No harmful language patterns found. All prompts follow safe, non-judgmental tone guidelines.' 
  : `⚠️ Found ${results.length} potential issues requiring review.`}

## Findings
${results.length === 0 
  ? 'No issues detected. Prompt templates are compliant with tone guidelines.' 
  : results.map(r => `
### ${r.file}
- **Category**: ${r.category}
- **Pattern**: \`${r.pattern}\`
- **Matches**: ${r.matches.join(', ')}
- **Lines**: ${r.lineNumbers.join(', ')}
`).join('\n')}

## Recommendations
${results.length === 0 
  ? 'Continue current tone guidelines. No changes needed.' 
  : 'Review and revise the flagged sections to:\n- Remove directive language ("you should", "you must")\n- Replace with exploratory language ("you might", "one possibility")\n- Avoid invalidation of user feelings\n- Ensure tone is non-judgmental and supportive'}
`;

require('fs').writeFileSync(outputPath, reportContent);
console.log(`\nResults written to: ${outputPath}`);
