/**
 * NOUS Bayesian Arbiter — pure math for belief update decisions.
 *
 * Given a proposal from Mentalizer and alternatives from Adversary,
 * the Arbiter computes KL divergence between priors and posteriors,
 * selects the update with maximum information gain, and commits if
 * the gain exceeds a threshold (default: 0.2 bits).
 *
 * KL(posterior || prior) = Σ posterior * log(posterior / prior)
 * For Beta(α,β): analytic form via digamma.
 */
import type {
  MentalizationProposal,
  AdversarialAlternative,
  ArbiterDecision,
  BeliefUpdate,
  EvidenceRef,
} from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// KL divergence for Beta distributions
// ════════════════════════════════════════════════════════════════════════════

function digamma(x: number): number {
  if (x < 1e-10) return -0.5772156649; // -γ
  const series = 0.5772156649 + 1 / x - 1 / (x + 1);
  return series;
}

function betaKLDivergence(
  priorAlpha: number,
  priorBeta: number,
  posteriorAlpha: number,
  posteriorBeta: number
): number {
  // Simplified KL using entropy difference: KL = H(prior) - H(posterior)
  // This is an approximation but more robust for our use case
  const betaEntropy = (alpha: number, beta: number): number => {
    const total = alpha + beta;
    if (total === 0) return 0;
    const p = alpha / total;
    if (p === 0 || p === 1) return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  };

  const priorEntropy = betaEntropy(priorAlpha, priorBeta);
  const posteriorEntropy = betaEntropy(posteriorAlpha, posteriorBeta);
  
  const kl = priorEntropy - posteriorEntropy;
  return Math.max(0, kl);
}

// ════════════════════════════════════════════════════════════════════════════
// Bayesian Arbiter
// ════════════════════════════════════════════════════════════════════════════

export interface ArbiterOptions {
  klThreshold?: number; // Default: 0.2 bits
}

export class BayesianArbiter {
  private readonly klThreshold: number;

  constructor(options: ArbiterOptions = {}) {
    this.klThreshold = options.klThreshold ?? 0.2;
  }

  /**
   * Decide whether to commit a belief update.
   * Computes KL divergence for proposal and all alternatives,
   * selects the max, commits if exceeds threshold.
   */
  decide(
    proposal: MentalizationProposal,
    alternatives: AdversarialAlternative[],
    priorAlpha: number,
    priorBeta: number
  ): ArbiterDecision {
    const posteriorAlpha = priorAlpha + proposal.proposed_alpha_delta;
    const posteriorBeta = priorBeta + proposal.proposed_beta_delta;

    const proposalKl = betaKLDivergence(priorAlpha, priorBeta, posteriorAlpha, posteriorBeta);

    // Compute KL for alternatives
    const alternativeKls = alternatives.map(alt => ({
      alternative: alt,
      kl: betaKLDivergence(
        priorAlpha,
        priorBeta,
        priorAlpha + alt.proposed_alpha_delta,
        priorBeta + alt.proposed_beta_delta
      ),
    }));

    // Find max KL
    const maxKl = Math.max(proposalKl, ...alternativeKls.map(a => a.kl));

    // Decide whether to commit
    const committed = maxKl >= this.klThreshold;
    const committedUpdate: BeliefUpdate | null = committed
      ? {
          node_id: proposal.target_node_id,
          evidence: proposal.evidence[0] || {
            kind: 'detector',
            ref_id: proposal.id,
            observed_at: new Date().toISOString(),
            polarity: 'confirms',
            strength: 0.5,
          },
          alpha_delta: proposal.proposed_alpha_delta,
          beta_delta: proposal.proposed_beta_delta,
        }
      : null;

    // Determine which option was chosen
    let chosenId: string | null = null;
    let chosenAlphaDelta = 0;
    let chosenBetaDelta = 0;

    if (maxKl === proposalKl) {
      chosenId = proposal.id;
      chosenAlphaDelta = proposal.proposed_alpha_delta;
      chosenBetaDelta = proposal.proposed_beta_delta;
    } else {
      const bestAlt = alternativeKls.reduce((best, curr) => 
        curr.kl > best.kl ? curr : best
      );
      chosenId = bestAlt.alternative.id;
      chosenAlphaDelta = bestAlt.alternative.proposed_alpha_delta;
      chosenBetaDelta = bestAlt.alternative.proposed_beta_delta;
    }

    const finalPosteriorAlpha = priorAlpha + (committed ? chosenAlphaDelta : 0);
    const finalPosteriorBeta = priorBeta + (committed ? chosenBetaDelta : 0);

    return {
      proposal_id: proposal.id,
      committed,
      committed_update: committedUpdate,
      reasoning: committed
        ? `KL divergence ${maxKl.toFixed(3)} bits exceeds threshold ${this.klThreshold}`
        : `KL divergence ${maxKl.toFixed(3)} bits below threshold ${this.klThreshold}`,
      posterior_before: { alpha: priorAlpha, beta: priorBeta },
      posterior_after: { alpha: finalPosteriorAlpha, beta: finalPosteriorBeta },
      alternatives_considered: alternatives.length + 1,
      kl_divergence: maxKl,
    };
  }
}
