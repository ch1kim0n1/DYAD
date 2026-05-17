/**
 * NOUS Adversarial Protocol tests
 */
import { describe, it, expect } from 'bun:test';
import { BayesianArbiter } from '../src/nous/adversarial/arbiter.js';
import { Mentalizer, Adversary, AdversarialProtocol } from '../src/nous/adversarial/protocol.js';
import type { BeliefNode, EvidenceRef } from '@dyad/shared';

describe('BayesianArbiter', () => {
  it('commits when KL divergence exceeds threshold', () => {
    const arbiter = new BayesianArbiter({ klThreshold: 0.01 });
    const proposal = {
      id: 'p1',
      target_node_id: 'n1',
      claim: 'test',
      evidence: [],
      proposed_alpha_delta: 2,
      proposed_beta_delta: 0,
      rationale: 'test',
      confidence: 0.8,
    };
    
    const decision = arbiter.decide(proposal, [], 1, 1);
    
    expect(decision.committed).toBe(true);
    expect(decision.committed_update).not.toBeNull();
    expect(decision.kl_divergence).toBeGreaterThan(0);
  });

  it('rejects when KL divergence below threshold', () => {
    const arbiter = new BayesianArbiter({ klThreshold: 10 });
    const proposal = {
      id: 'p1',
      target_node_id: 'n1',
      claim: 'test',
      evidence: [],
      proposed_alpha_delta: 0.1,
      proposed_beta_delta: 0,
      rationale: 'test',
      confidence: 0.1,
    };
    
    const decision = arbiter.decide(proposal, [], 1, 1);
    
    expect(decision.committed).toBe(false);
    expect(decision.committed_update).toBeNull();
  });

  it('selects proposal over alternatives when higher KL', () => {
    const arbiter = new BayesianArbiter({ klThreshold: 0.01 });
    const proposal = {
      id: 'p1',
      target_node_id: 'n1',
      claim: 'test',
      evidence: [],
      proposed_alpha_delta: 2,
      proposed_beta_delta: 0,
      rationale: 'test',
      confidence: 0.8,
    };
    const alternatives = [
      {
        id: 'a1',
        alternative_claim: 'alt',
        competing_evidence: [],
        proposed_alpha_delta: 0.5,
        proposed_beta_delta: 0,
        rationale: 'test',
        confidence: 0.3,
      },
    ];
    
    const decision = arbiter.decide(proposal, alternatives, 1, 1);
    
    expect(decision.committed).toBe(true);
    expect(decision.committed_update?.alpha_delta).toBe(2);
  });
});

describe('Mentalizer', () => {
  it('proposes confirming update for confirming evidence', () => {
    const mentalizer = new Mentalizer();
    const node: BeliefNode = {
      id: 'n1',
      dimension: 'attachment',
      claim: 'Partner values intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    const evidence: EvidenceRef = {
      kind: 'message',
      ref_id: 'm1',
      observed_at: new Date().toISOString(),
      polarity: 'confirms',
      strength: 0.8,
    };
    
    const proposal = mentalizer.propose(node, evidence);
    
    expect(proposal.proposed_alpha_delta).toBeGreaterThan(0);
    expect(proposal.proposed_beta_delta).toBe(0);
    expect(proposal.confidence).toBe(0.8);
  });

  it('proposes disconfirming update for disconfirming evidence', () => {
    const mentalizer = new Mentalizer();
    const node: BeliefNode = {
      id: 'n1',
      dimension: 'attachment',
      claim: 'Partner values intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    const evidence: EvidenceRef = {
      kind: 'message',
      ref_id: 'm1',
      observed_at: new Date().toISOString(),
      polarity: 'disconfirms',
      strength: 0.6,
    };
    
    const proposal = mentalizer.propose(node, evidence);
    
    expect(proposal.proposed_alpha_delta).toBe(0);
    expect(proposal.proposed_beta_delta).toBeGreaterThan(0);
  });
});

describe('Adversary', () => {
  it('generates alternative interpretations', () => {
    const adversary = new Adversary({ maxAlternatives: 2 });
    const node: BeliefNode = {
      id: 'n1',
      dimension: 'attachment',
      claim: 'Partner values intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    const proposal = {
      id: 'p1',
      target_node_id: 'n1',
      claim: 'test',
      evidence: [{
        kind: 'message' as const,
        ref_id: 'm1',
        observed_at: new Date().toISOString(),
        polarity: 'confirms' as const,
        strength: 0.8,
      }],
      proposed_alpha_delta: 1.6,
      proposed_beta_delta: 0,
      rationale: 'test',
      confidence: 0.8,
    };
    
    const alternatives = adversary.challenge(proposal, node);
    
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(2);
  });
});

describe('AdversarialProtocol', () => {
  it('runs full protocol end-to-end', async () => {
    const protocol = new AdversarialProtocol({ arbiter: { klThreshold: 0.01 } });
    const node: BeliefNode = {
      id: 'n1',
      dimension: 'attachment',
      claim: 'Partner values intimacy',
      alpha: 1,
      beta: 1,
      evidence_refs: [],
      last_updated: new Date().toISOString(),
      schema_version: 1,
    };
    const evidence: EvidenceRef = {
      kind: 'message',
      ref_id: 'm1',
      observed_at: new Date().toISOString(),
      polarity: 'confirms',
      strength: 0.8,
    };
    
    const decision = await protocol.run(node, evidence);
    
    expect(decision).toBeDefined();
    expect(decision.alternatives_considered).toBeGreaterThan(1);
    expect(decision.kl_divergence).toBeGreaterThanOrEqual(0);
  });
});
