/**
 * Cross-Tool Integration Test with Unified Receipt
 * 
 * Demonstrates integration between G-Stack tools using the unified BaseReceipt schema
 * This file can be run as a script or adapted to any test framework
 */

// Unified receipt schema (from receipt-schema-decision.md)
interface BaseReceipt {
  receipt_id: string;
  tool: 'gmirror' | 'gorchestrator' | 'glearn' | 'gtom' | 'gstack';
  timestamp: string;
  status: 'success' | 'failed' | 'partial';
  cost_usd: number;
  latency_ms: number;
  tokens_used: number;
  llm_calls: number;
  quality: {
    correctness: number;
    efficiency: number;
    robustness: number;
    clarity: number;
    authenticity: number;
  };
  tool_data?: any;
}

// Mock tool receipts for testing
const mockGMirrorReceipt: BaseReceipt = {
  receipt_id: 'gmirror-001',
  tool: 'gmirror',
  timestamp: new Date().toISOString(),
  status: 'success',
  cost_usd: 0.0234,
  latency_ms: 1250,
  tokens_used: 1500,
  llm_calls: 3,
  quality: {
    correctness: 0.95,
    efficiency: 0.88,
    robustness: 0.90,
    clarity: 0.92,
    authenticity: 0.85,
  },
  tool_data: {
    overall: 'pass',
    scores: {
      correctness: { score: 0.95, reasoning: 'Correct implementation' },
      user_outcome: { score: 0.88, reasoning: 'Good UX' },
    },
    failure_modes: [],
  },
};

const mockGOrchestratorReceipt: BaseReceipt = {
  receipt_id: 'gorchestrator-001',
  tool: 'gorchestrator',
  timestamp: new Date().toISOString(),
  status: 'success',
  cost_usd: 0.0567,
  latency_ms: 3500,
  tokens_used: 4200,
  llm_calls: 5,
  quality: {
    correctness: 0.90,
    efficiency: 0.75,
    robustness: 0.85,
    clarity: 0.80,
    authenticity: 0.88,
  },
  tool_data: {
    attempts: [
      { attempt_id: 'att-1', status: 'success', cost_usd: 0.0189, latency_ms: 1200 },
      { attempt_id: 'att-2', status: 'success', cost_usd: 0.0223, latency_ms: 1500 },
    ],
    winner: 'att-2',
  },
};

const mockGLearnReceipt: BaseReceipt = {
  receipt_id: 'glearn-001',
  tool: 'glearn',
  timestamp: new Date().toISOString(),
  status: 'success',
  cost_usd: 0.0345,
  latency_ms: 2800,
  tokens_used: 3100,
  llm_calls: 4,
  quality: {
    correctness: 0.85,
    efficiency: 0.90,
    robustness: 0.82,
    clarity: 0.88,
    authenticity: 0.80,
  },
  tool_data: {
    patterns_found: 15,
    proposals_generated: 8,
    pattern_details: [
      { pattern_id: 'p-1', support: 0.85, confidence: 0.92 },
    ],
  },
};

const mockGToMReceipt: BaseReceipt = {
  receipt_id: 'gtom-001',
  tool: 'gtom',
  timestamp: new Date().toISOString(),
  status: 'success',
  cost_usd: 0.0123,
  latency_ms: 800,
  tokens_used: 900,
  llm_calls: 2,
  quality: {
    correctness: 0.92,
    efficiency: 0.95,
    robustness: 0.88,
    clarity: 0.90,
    authenticity: 0.95,
  },
  tool_data: {
    authenticity_score: 0.95,
    vulnerability_detected: false,
    cognitive_defense_score: 0.88,
  },
};

const mockGStackReceipt: BaseReceipt = {
  receipt_id: 'gstack-001',
  tool: 'gstack',
  timestamp: new Date().toISOString(),
  status: 'success',
  cost_usd: 0.0189,
  latency_ms: 1500,
  tokens_used: 1200,
  llm_calls: 2,
  quality: {
    correctness: 0.88,
    efficiency: 0.85,
    robustness: 0.90,
    clarity: 0.82,
    authenticity: 0.85,
  },
  tool_data: {
    files_reviewed: ['file1.ts', 'file2.ts'],
    findings: [
      { file: 'file1.ts', line: 10, severity: 'warning', message: 'Unused variable' },
    ],
    total_issues: 1,
  },
};

// Test functions
function testReceiptSchemaValidation(receipts: BaseReceipt[]): boolean {
  console.log('Testing receipt schema validation...');
  
  for (const receipt of receipts) {
    if (!receipt.receipt_id || !receipt.tool || !receipt.timestamp || !receipt.status) {
      console.log('FAIL: Missing required fields');
      return false;
    }
    
    if (receipt.quality.correctness < 0 || receipt.quality.correctness > 1 ||
        receipt.quality.efficiency < 0 || receipt.quality.efficiency > 1 ||
        receipt.quality.robustness < 0 || receipt.quality.robustness > 1 ||
        receipt.quality.clarity < 0 || receipt.quality.clarity > 1 ||
        receipt.quality.authenticity < 0 || receipt.quality.authenticity > 1) {
      console.log('FAIL: Invalid quality scores');
      return false;
    }
  }
  
  console.log('PASS: Receipt schema validation');
  return true;
}

function testCrossToolAnalytics(receipts: BaseReceipt[]): boolean {
  console.log('Testing cross-tool analytics...');
  
  const totalCost = receipts.reduce((sum, r) => sum + r.cost_usd, 0);
  const totalLatency = receipts.reduce((sum, r) => sum + r.latency_ms, 0);
  
  if (totalCost <= 0 || totalCost >= 1) {
    console.log('FAIL: Total cost out of reasonable range');
    return false;
  }
  
  if (totalLatency <= 0 || totalLatency >= 30000) {
    console.log('FAIL: Total latency out of reasonable range');
    return false;
  }
  
  console.log(`PASS: Total cost: $${totalCost.toFixed(4)}, Total latency: ${totalLatency}ms`);
  return true;
}

function testReceiptAggregation(receipts: BaseReceipt[]): boolean {
  console.log('Testing receipt aggregation...');
  
  const byTool = receipts.reduce((acc, r) => {
    if (!acc[r.tool]) {
      acc[r.tool] = [];
    }
    acc[r.tool].push(r);
    return acc;
  }, {} as Record<string, BaseReceipt[]>);
  
  if (Object.keys(byTool).length !== 5) {
    console.log('FAIL: Wrong number of tools aggregated');
    return false;
  }
  
  console.log('PASS: Receipt aggregation by tool');
  return true;
}

function testToolSpecificDataPreservation(receipts: BaseReceipt[]): boolean {
  console.log('Testing tool-specific data preservation...');
  
  const gmirrorReceipt = receipts.find(r => r.tool === 'gmirror');
  if (!gmirrorReceipt?.tool_data?.overall) {
    console.log('FAIL: GMirror data not preserved');
    return false;
  }
  
  const orchestratorReceipt = receipts.find(r => r.tool === 'gorchestrator');
  if (!orchestratorReceipt?.tool_data?.attempts) {
    console.log('FAIL: GOrchestrator data not preserved');
    return false;
  }
  
  console.log('PASS: Tool-specific data preserved');
  return true;
}

function testReceiptQuerying(receipts: BaseReceipt[]): boolean {
  console.log('Testing receipt querying...');
  
  const gmirrorReceipts = receipts.filter(r => r.tool === 'gmirror');
  if (gmirrorReceipts.length !== 1 || gmirrorReceipts[0].tool !== 'gmirror') {
    console.log('FAIL: Filtering by tool failed');
    return false;
  }
  
  const expensiveReceipts = receipts.filter(r => r.cost_usd > 0.02);
  if (expensiveReceipts.length === 0) {
    console.log('FAIL: Filtering by cost threshold failed');
    return false;
  }
  
  console.log('PASS: Receipt querying');
  return true;
}

function testReceiptSerialization(receipts: BaseReceipt[]): boolean {
  console.log('Testing receipt serialization...');
  
  for (const receipt of receipts) {
    const serialized = JSON.stringify(receipt);
    const deserialized = JSON.parse(serialized) as BaseReceipt;
    if (JSON.stringify(deserialized) !== JSON.stringify(receipt)) {
      console.log('FAIL: Serialization round-trip failed');
      return false;
    }
  }
  
  console.log('PASS: Receipt serialization');
  return true;
}

// Run all tests
function runIntegrationTests(): void {
  console.log('=== Cross-Tool Integration Test with Unified Receipt ===\n');
  
  const receipts = [
    mockGMirrorReceipt,
    mockGOrchestratorReceipt,
    mockGLearnReceipt,
    mockGToMReceipt,
    mockGStackReceipt,
  ];
  
  const results = [
    testReceiptSchemaValidation(receipts),
    testCrossToolAnalytics(receipts),
    testReceiptAggregation(receipts),
    testToolSpecificDataPreservation(receipts),
    testReceiptQuerying(receipts),
    testReceiptSerialization(receipts),
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n=== Test Results: ${passed}/${total} passed ===`);
  
  if (passed === total) {
    console.log('All tests passed!');
    if (typeof process !== 'undefined') {
      process.exit(0);
    }
  } else {
    console.log('Some tests failed!');
    if (typeof process !== 'undefined') {
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (typeof process !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  runIntegrationTests();
}

export {
  BaseReceipt,
  mockGMirrorReceipt,
  mockGOrchestratorReceipt,
  mockGLearnReceipt,
  mockGToMReceipt,
  mockGStackReceipt,
  runIntegrationTests,
};
