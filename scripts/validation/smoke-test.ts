#!/usr/bin/env bun
/**
 * Regression Test Suite — Issue #74
 * Automated smoke tests that run existing test suites.
 * Ensures adversarial, accuracy, and unit tests pass.
 */

import { spawn } from 'child_process';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<{ passed: boolean; output: string; duration: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    let output = '';
    const proc = spawn(cmd, args, { cwd, shell: true });
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      const duration = Date.now() - start;
      resolve({ passed: code === 0, output, duration });
    });
    
    proc.on('error', (err) => {
      const duration = Date.now() - start;
      resolve({ passed: false, output: err.message, duration });
    });
  });
}

async function main() {
  console.log('=== DYAD Regression Test Suite ===\n');
  
  const results: TestResult[] = [];
  const rootDir = process.cwd();
  
  // Test 1: Adversarial tests
  console.log('Running adversarial tests...');
  const adversarialResult = await runCommand('bun', ['test', '--cwd', 'packages/engine', 'adversarial.test.ts'], rootDir);
  results.push({
    name: 'Adversarial Tests',
    passed: adversarialResult.passed,
    duration: adversarialResult.duration,
    output: adversarialResult.output,
  });
  console.log(`  Status: ${adversarialResult.passed ? '✅ PASS' : '❌ FAIL'} (${adversarialResult.duration}ms)\n`);
  
  // Test 2: Accuracy audit
  console.log('Running accuracy audit...');
  const accuracyResult = await runCommand('bun', ['run', 'scripts/accuracy-audit.ts'], rootDir);
  results.push({
    name: 'Accuracy Audit',
    passed: accuracyResult.passed,
    duration: accuracyResult.duration,
    output: accuracyResult.output,
  });
  console.log(`  Status: ${accuracyResult.passed ? '✅ PASS' : '❌ FAIL'} (${accuracyResult.duration}ms)\n`);
  
  // Test 3: Unit tests (if they exist)
  console.log('Running unit tests...');
  const unitTestResult = await runCommand('bun', ['test', '--cwd', 'packages/engine'], rootDir);
  results.push({
    name: 'Unit Tests',
    passed: unitTestResult.passed,
    duration: unitTestResult.duration,
    output: unitTestResult.output,
  });
  console.log(`  Status: ${unitTestResult.passed ? '✅ PASS' : '❌ FAIL'} (${unitTestResult.duration}ms)\n`);
  
  // Test 4: TypeScript compilation
  console.log('Running TypeScript compilation check...');
  const tscResult = await runCommand('bun', ['run', 'tsc', '--noEmit'], rootDir);
  results.push({
    name: 'TypeScript Compilation',
    passed: tscResult.passed,
    duration: tscResult.duration,
    output: tscResult.output,
  });
  console.log(`  Status: ${tscResult.passed ? '✅ PASS' : '❌ FAIL'} (${tscResult.duration}ms)\n`);
  
  // Summary
  console.log('=== Summary ===');
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.duration}ms`);
  });
  
  console.log(`\nTotal: ${passedCount}/${totalCount} passed`);
  console.log(`Total duration: ${totalDuration}ms`);
  console.log(`Overall: ${passedCount === totalCount ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Write results to file
  const fs = await import('fs');
  const resultsData = {
    timestamp: new Date().toISOString(),
    totalDuration,
    passed: passedCount === totalCount,
    summary: `${passedCount}/${totalCount} tests passed`,
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
    })),
  };
  
  fs.writeFileSync(
    'scripts/validation/smoke-test-results.json',
    JSON.stringify(resultsData, null, 2)
  );
  console.log('\nResults written to: scripts/validation/smoke-test-results.json');
  
  // Exit with error code if any test failed
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch(console.error);
