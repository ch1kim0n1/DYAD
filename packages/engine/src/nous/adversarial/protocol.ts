// NOUS Adversarial Protocol — orchestrates Mentalizer, Adversary, and Arbiter.
//
// Flow:
//   1. Mentalizer proposes belief update with evidence
//   2. Adversary generates alternatives (counter-interpretations)
//   3. Arbiter computes KL divergence, selects max, commits if exceeds threshold
//
// In this iteration, Mentalizer and Adversary are stubs (deferred to Anthropic Sonnet).
// The protocol orchestrates the pure math in Arbiter.
import type {
  MentalizationProposal,
  AdversarialAlternative,
  ArbiterDecision,
  BeliefNode,
  EvidenceRef,
} from '@dyad/shared';
import { BayesianArbiter, type ArbiterOptions } from './arbiter.js';

// ════════════════════════════════════════════════════════════════════════════
// Mentalizer (stub)
// ════════════════════════════════════════════════════════════════════════════

export interface MentalizerOptions {
  anthropicApiKey?: string;
}

export class Mentalizer {
  constructor(private options: MentalizerOptions = {}) {}

  /**
   * Propose a belief update based on evidence.
   * In production, calls Anthropic Sonnet to interpret evidence.
   * For now, returns a heuristic proposal.
   */
  propose(
    node: BeliefNode,
    evidence: EvidenceRef
  ): MentalizationProposal {
    const isConfirming = evidence.polarity === 'confirms';
    const strength = evidence.strength;

    // Heuristic: update magnitude based on evidence strength
    const delta = strength * 2;

    return {
      id: `proposal-${node.id}-${Date.now()}`,
      target_node_id: node.id,
      claim: node.claim,
      evidence: [evidence],
      proposed_alpha_delta: isConfirming ? delta : 0,
      proposed_beta_delta: isConfirming ? 0 : delta,
      rationale: isConfirming
        ? `Evidence confirms claim with strength ${strength}`
        : `Evidence disconfirms claim with strength ${strength}`,
      confidence: strength,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Adversary (stub)
// ════════════════════════════════════════════════════════════════════════════

export interface AdversaryOptions {
  anthropicApiKey?: string;
  maxAlternatives?: number; // Default: 3
}

export class Adversary {
  private readonly maxAlternatives: number;

  constructor(private options: AdversaryOptions = {}) {
    this.maxAlternatives = options.maxAlternatives || 3;
  }

  /**
   * Generate alternative interpretations of evidence.
   * In production, calls Anthropic Sonnet to generate counter-arguments.
   * For now, returns heuristic alternatives.
   */
  challenge(
    proposal: MentalizationProposal,
    node: BeliefNode
  ): AdversarialAlternative[] {
    const alternatives: AdversarialAlternative[] = [];

    // Alternative 1: Opposite polarity with reduced strength
    alternatives.push({
      id: `alt-${proposal.id}-1`,
      alternative_claim: `Alternative interpretation: evidence may not ${proposal.evidence[0]?.polarity === 'confirms' ? 'support' : 'contradict'} claim`,
      competing_evidence: proposal.evidence.map(e => ({
        ...e,
        polarity: e.polarity === 'confirms' ? 'disconfirms' : 'confirms',
        strength: e.strength * 0.5,
      })),
      proposed_alpha_delta: proposal.proposed_beta_delta * 0.5,
      proposed_beta_delta: proposal.proposed_alpha_delta * 0.5,
      rationale: 'Consider opposite interpretation with reduced confidence',
      confidence: proposal.confidence * 0.5,
    });

    // Alternative 2: Neutral interpretation
    alternatives.push({
      id: `alt-${proposal.id}-2`,
      alternative_claim: `Evidence may be ambiguous or context-dependent`,
      competing_evidence: proposal.evidence,
      proposed_alpha_delta: 0,
      proposed_beta_delta: 0,
      rationale: 'Suspend judgment pending more evidence',
      confidence: 0.3,
    });

    return alternatives.slice(0, this.maxAlternatives);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Adversarial Protocol
// ════════════════════════════════════════════════════════════════════════════

export interface AdversarialProtocolOptions {
  mentalizer?: MentalizerOptions;
  adversary?: AdversaryOptions;
  arbiter?: ArbiterOptions;
}

export class AdversarialProtocol {
  private mentalizer: Mentalizer;
  private adversary: Adversary;
  private arbiter: BayesianArbiter;

  constructor(options: AdversarialProtocolOptions = {}) {
    this.mentalizer = new Mentalizer(options.mentalizer);
    this.adversary = new Adversary(options.adversary);
    this.arbiter = new BayesianArbiter(options.arbiter);
  }

  /**
   * Run the full adversarial protocol:
   * 1. Mentalizer proposes
   * 2. Adversary challenges
   * 3. Arbiter decides
   */
  async run(
    node: BeliefNode,
    evidence: EvidenceRef
  ): Promise<ArbiterDecision> {
    // Step 1: Mentalizer proposes
    const proposal = this.mentalizer.propose(node, evidence);

    // Step 2: Adversary challenges
    const alternatives = this.adversary.challenge(proposal, node);

    // Step 3: Arbiter decides
    const decision = this.arbiter.decide(
      proposal,
      alternatives,
      node.alpha,
      node.beta
    );

    return decision;
  }
}
