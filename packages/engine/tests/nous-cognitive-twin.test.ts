/**
 * NOUS Cognitive Twin tests
 */
import { describe, it, expect } from 'bun:test';
import { CognitiveTwin } from '../src/nous/twin/cognitive-twin.js';
import { EthicsGate } from '../src/nous/ethics/ethics-gate.js';
import type { OutboundClaim } from '@dyad/shared';

describe('EthicsGate', () => {
  it('allows safe claims', () => {
    const gate = new EthicsGate();
    const claim: OutboundClaim = {
      text: 'Partner values emotional intimacy',
      source: 'enrichment',
      confidence: 0.8,
      citations: [],
    };
    
    const verdict = gate.filter([claim]);
    
    expect(verdict.allowed).toBe(true);
    expect(verdict.filtered_claims).toHaveLength(1);
    expect(verdict.blocked_claims).toHaveLength(0);
  });

  it('blocks mental health speculation', () => {
    const gate = new EthicsGate();
    const claim: OutboundClaim = {
      text: 'Partner seems depressed and anxious',
      source: 'enrichment',
      confidence: 0.8,
      citations: [],
    };
    
    const verdict = gate.filter([claim]);
    
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocked_claims).toHaveLength(1);
    expect(verdict.blocked_claims[0].reason).toContain('mental health');
  });

  it('blocks low confidence claims', () => {
    const gate = new EthicsGate();
    const claim: OutboundClaim = {
      text: 'Partner values intimacy',
      source: 'enrichment',
      confidence: 0.3,
      citations: [],
    };
    
    const verdict = gate.filter([claim]);
    
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocked_claims[0].reason).toContain('confidence');
  });

  it('blocks PII claims', () => {
    const gate = new EthicsGate();
    const claim: OutboundClaim = {
      text: 'Partner address is 123 Main St',
      source: 'enrichment',
      confidence: 0.8,
      citations: [],
    };
    
    const verdict = gate.filter([claim]);
    
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocked_claims[0].reason).toContain('PII');
  });
});

describe('CognitiveTwin', () => {
  it('creates twin with dyad ID', () => {
    const twin = new CognitiveTwin({ dyadId: 'test-dyad' });
    
    expect(twin).toBeDefined();
  });

  it('runs cycle and returns output', async () => {
    const twin = new CognitiveTwin({ dyadId: 'test-dyad', budget: 5 });
    
    const output = await twin.runCycle();
    
    expect(output).toBeDefined();
    expect(output.graph_snapshot_id).toBeDefined();
    expect(output.mvi_plan).toBeDefined();
    expect(output.hog_results).toBeDefined();
    expect(output.decisions).toBeDefined();
    expect(output.enriched_summary).toBeDefined();
    expect(output.ethics_verdict).toBeDefined();
  }, 10000);

  it('respects budget constraint', async () => {
    const twin = new CognitiveTwin({ dyadId: 'test-dyad', budget: 3 });
    
    const output = await twin.runCycle();
    
    expect(output.mvi_plan.total_cost).toBeLessThanOrEqual(3);
  }, 10000);
});
