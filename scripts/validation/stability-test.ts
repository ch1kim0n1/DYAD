#!/usr/bin/env bun
/**
 * Memory Leak and Stability Test — Issue #64
 * Runs extraction pipeline in a loop for 30 minutes.
 * Monitors memory usage to detect leaks (>100MB growth over baseline).
 */

import { ExtractionPipeline } from '../../packages/engine/src/extraction-pipeline.js';
import type { NormalizedMessage } from '@dyad/shared';

// Helper to create mock messages
function createMockMessage(id: number): NormalizedMessage {
  return {
    message_id: `msg_${id}`,
    participant_id: id % 2 === 0 ? 'me' : 'partner',
    is_from_me: id % 2 === 0,
    text: `This is test message number ${id}. It contains some emotional content and function words for analysis.`,
    timestamp: new Date(Date.now() + id * 60000).toISOString(),
    chat_id: 'test_chat',
  };
}

// Create a batch of messages for each iteration
const MESSAGE_BATCH_SIZE = 10;
const TEST_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SAMPLE_INTERVAL_MS = 10 * 1000; // Sample every 10 seconds
const MEMORY_THRESHOLD_MB = 100; // Alert if memory grows by 100MB

interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

async function runStabilityTest() {
  console.log('=== Memory Leak and Stability Test ===');
  console.log(`Duration: ${TEST_DURATION_MS / 1000 / 60} minutes`);
  console.log(`Sample interval: ${SAMPLE_INTERVAL_MS / 1000} seconds`);
  console.log(`Memory threshold: ${MEMORY_THRESHOLD_MB}MB growth\n`);

  const pipeline = new ExtractionPipeline({ apiKey: 'test-key' });
  const samples: MemorySample[] = [];
  const startTime = Date.now();
  const baselineMemory = process.memoryUsage();
  
  console.log('Baseline memory:');
  console.log(`  heapUsed: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  heapTotal: ${(baselineMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  rss: ${(baselineMemory.rss / 1024 / 1024).toFixed(2)}MB\n`);

  let iteration = 0;
  let maxHeapUsed = baselineMemory.heapUsed;
  let maxRss = baselineMemory.rss;

  const intervalId = setInterval(() => {
    const mem = process.memoryUsage();
    const sample: MemorySample = {
      timestamp: Date.now() - startTime,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
    };
    samples.push(sample);
    
    maxHeapUsed = Math.max(maxHeapUsed, mem.heapUsed);
    maxRss = Math.max(maxRss, mem.rss);
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[${elapsed.toFixed(0)}s] Iteration ${iteration}: heapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB, rss=${(mem.rss / 1024 / 1024).toFixed(2)}MB`);
  }, SAMPLE_INTERVAL_MS);

  try {
    while (Date.now() - startTime < TEST_DURATION_MS) {
      const messages = Array.from({ length: MESSAGE_BATCH_SIZE }, (_, i) => 
        createMockMessage(iteration * MESSAGE_BATCH_SIZE + i)
      );
      
      await pipeline.processBatch(messages);
      iteration++;
      
      // Small delay to simulate realistic usage
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally {
    clearInterval(intervalId);
  }

  const finalMemory = process.memoryUsage();
  const heapGrowthMB = (finalMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024;
  const rssGrowthMB = (finalMemory.rss - baselineMemory.rss) / 1024 / 1024;

  console.log('\n=== Test Complete ===');
  console.log(`Total iterations: ${iteration}`);
  console.log(`Total messages processed: ${iteration * MESSAGE_BATCH_SIZE}`);
  console.log(`Duration: ${(Date.now() - startTime) / 1000 / 60} minutes`);
  console.log('\nMemory comparison:');
  console.log(`  Heap used growth: ${heapGrowthMB.toFixed(2)}MB (threshold: ${MEMORY_THRESHOLD_MB}MB)`);
  console.log(`  RSS growth: ${rssGrowthMB.toFixed(2)}MB`);
  console.log(`  Max heap used: ${(maxHeapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Max RSS: ${(maxRss / 1024 / 1024).toFixed(2)}MB`);
  
  const memoryLeakDetected = heapGrowthMB > MEMORY_THRESHOLD_MB;
  console.log(`\nStatus: ${memoryLeakDetected ? '❌ MEMORY LEAK DETECTED' : '✅ NO MEMORY LEAK'}`);

  // Write results to file
  const fs = await import('fs');
  const results = {
    timestamp: new Date().toISOString(),
    durationMinutes: TEST_DURATION_MS / 1000 / 60,
    iterations: iteration,
    messagesProcessed: iteration * MESSAGE_BATCH_SIZE,
    baselineMemory: {
      heapUsedMB: baselineMemory.heapUsed / 1024 / 1024,
      heapTotalMB: baselineMemory.heapTotal / 1024 / 1024,
      rssMB: baselineMemory.rss / 1024 / 1024,
    },
    finalMemory: {
      heapUsedMB: finalMemory.heapUsed / 1024 / 1024,
      heapTotalMB: finalMemory.heapTotal / 1024 / 1024,
      rssMB: finalMemory.rss / 1024 / 1024,
    },
    growth: {
      heapUsedMB: heapGrowthMB,
      rssMB: rssGrowthMB,
    },
    maxMemory: {
      heapUsedMB: maxHeapUsed / 1024 / 1024,
      rssMB: maxRss / 1024 / 1024,
    },
    thresholdMB: MEMORY_THRESHOLD_MB,
    memoryLeakDetected,
    samples,
  };

  fs.writeFileSync(
    'scripts/validation/stability-test-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults written to: scripts/validation/stability-test-results.json');
}

runStabilityTest().catch(console.error);
