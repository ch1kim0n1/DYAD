/**
 * NOUS Mentalization Graph tests
 */
import { describe, it, expect } from 'bun:test';
import { MentalizationGraphImpl } from '../src/nous/graph/mentalization-graph.js';
import type { BeliefNode, BeliefUpdate, EvidenceRef } from '@dyad/shared';

describe('MentalizationGraph', () => {
  it('creates empty graph for dyad', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-1');
    const obj = graph.toObject();
    
    expect(obj.dyad_id).toBe('test-dyad-1');
    expect(obj.nodes).toEqual({});
    expect(obj.edges).toEqual([]);
    expect(obj.schema_version).toBe(1);
  });

  it('adds and retrieves nodes', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-2');
    const node: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy',
      alpha: 2,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    
    graph.addNode(node);
    
    const retrieved = graph.getNode('node-1');
    expect(retrieved).toEqual(node);
  });

  it('applies belief updates', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-3');
    const node: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    graph.addNode(node);
    
    const evidence: EvidenceRef = {
      kind: 'message',
      ref_id: 'msg-1',
      observed_at: new Date().toISOString(),
      polarity: 'confirms',
      strength: 0.8,
    };
    
    const update: BeliefUpdate = {
      node_id: 'node-1',
      evidence,
      alpha_delta: 1,
      beta_delta: 0,
    };
    
    graph.applyUpdates([update]);
    
    const updated = graph.getNode('node-1');
    expect(updated?.alpha).toBe(2);
    expect(updated?.beta).toBe(1);
    expect(updated?.evidence_refs).toHaveLength(1);
  });

  it('calculates node entropy', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-4');
    const node: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy',
      alpha: 5,
      beta: 3,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    graph.addNode(node);
    
    const entropy = graph.getNodeEntropy('node-1');
    expect(entropy).toBeGreaterThanOrEqual(0);
  });

  it('calculates expected information gain', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-5');
    const node: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy',
      alpha: 2,
      beta: 2,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    graph.addNode(node);
    
    const gain = graph.getExpectedInformationGain('node-1', 2, 0);
    expect(gain).toBeGreaterThanOrEqual(0); // Information gain should be non-negative
  });

  it('finds similar nodes by cosine similarity', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-6');
    const node1: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy and closeness',
      alpha: 2,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    const node2: BeliefNode = {
      id: 'node-2',
      dimension: 'attachment',
      claim: 'Partner prefers independence and space',
      alpha: 1,
      beta: 2,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    graph.addNode(node1);
    graph.addNode(node2);
    
    const similar = graph.findSimilarNodes('emotional intimacy closeness', 2);
    expect(similar.length).toBeLessThanOrEqual(2);
    if (similar.length > 1) {
      expect(similar[0].similarity).toBeGreaterThanOrEqual(similar[1].similarity);
    }
  });

  it('clones graph independently', () => {
    const graph = MentalizationGraphImpl.create('test-dyad-7');
    const node: BeliefNode = {
      id: 'node-1',
      dimension: 'attachment',
      claim: 'Partner values emotional intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    graph.addNode(node);
    
    const clone = graph.clone();
    clone.addNode({
      id: 'node-2',
      dimension: 'values',
      claim: 'Partner values honesty',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    });
    
    expect(graph.getNode('node-2')).toBeUndefined();
    expect(clone.getNode('node-2')).toBeDefined();
  });
});
