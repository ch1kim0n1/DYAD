#!/usr/bin/env bun
/**
 * Dry-run timing verification for NOUS cycle.
 * 
 * Verifies that the NOUS cycle completes within the target 3-minute window.
 */
import { CognitiveTwin } from '../packages/engine/src/nous/twin/cognitive-twin.js';

async function runTimingTest(iterations: number = 5) {
  console.log('Running NOUS timing verification...');
  console.log(`Iterations: ${iterations}`);
  console.log('');

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    
    const twin = new CognitiveTwin({
      dyadId: `timing-test-${i}`,
      budget: 10,
    });
    
    await twin.runCycle();
    
    const elapsed = Date.now() - start;
    times.push(elapsed);
    
    console.log(`Iteration ${i + 1}: ${elapsed}ms`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);
  const min = Math.min(...times);
  const targetMs = 3 * 60 * 1000; // 3 minutes

  console.log('');
  console.log('Timing Results:');
  console.log(`  Average: ${avg.toFixed(0)}ms (${(avg / 1000).toFixed(1)}s)`);
  console.log(`  Min: ${min}ms (${(min / 1000).toFixed(1)}s)`);
  console.log(`  Max: ${max}ms (${(max / 1000).toFixed(1)}s)`);
  console.log(`  Target: ${targetMs}ms (180s)`);
  console.log('');
  
  if (avg <= targetMs) {
    console.log('✓ Timing verification PASSED - average within 3-minute target');
    process.exit(0);
  } else {
    console.log('✗ Timing verification FAILED - average exceeds 3-minute target');
    console.log(`  Exceeded by: ${((avg - targetMs) / 1000).toFixed(1)}s`);
    process.exit(1);
  }
}

const iterations = parseInt(process.argv[2] || '5', 10);
runTimingTest(iterations);
