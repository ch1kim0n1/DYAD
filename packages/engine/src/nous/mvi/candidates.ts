/**
 * NOUS MVI candidate generation.
 *
 * Generates Hog query candidates from the mentalization graph.
 * Each candidate targets specific BeliefNodes with an expected information gain.
 */
import type {
  MviCandidate,
  HogCapability,
  MentalizationGraph,
  BeliefNode,
} from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// Candidate generation strategies
// ════════════════════════════════════════════════════════════════════════════

export interface CandidateGenerationOptions {
  dyadId: string;
  budget: number;
  maxCandidates?: number; // Default: 50
}

interface DeepResearchCandidate {
  prompt: string;
  targetBeliefIds: string[];
  rationale: string;
}

export class MviCandidateGenerator {
  /**
   * Generate Hog deep_research candidates from high-entropy beliefs.
   */
  static generateDeepResearchCandidates(
    graph: MentalizationGraph,
    options: CandidateGenerationOptions
  ): MviCandidate[] {
    const candidates: MviCandidate[] = [];
    const maxCandidates = options.maxCandidates || 50;

    // Sort nodes by entropy (highest first)
    const nodes = Object.values(graph.nodes)
      .sort((a, b) => {
        const entropyA = this.calculateEntropy(a);
        const entropyB = this.calculateEntropy(b);
        return entropyB - entropyA;
      })
      .slice(0, maxCandidates);

    for (const node of nodes) {
      const candidate = this.createDeepResearchCandidate(node, graph, options.dyadId);
      candidates.push(candidate);
    }

    return candidates;
  }

  /**
   * Generate Hog people_research candidates for external context.
   */
  static generatePeopleResearchCandidates(
    graph: MentalizationGraph,
    options: CandidateGenerationOptions
  ): MviCandidate[] {
    const candidates: MviCandidate[] = [];

    // Target nodes in 'external_context' dimension
    const externalNodes = Object.values(graph.nodes).filter(
      n => n.dimension === 'external_context'
    );

    for (const node of externalNodes.slice(0, 10)) {
      candidates.push({
        id: this.generateId('people_research', node.id),
        capability: 'people_research',
        payload: {
          identities: [
            { platform: 'linkedin', username: this.extractLinkedInUsername(node.claim) },
          ],
        },
        cost_credits: 5,
        expected_information_gain: this.calculateEntropy(node) * 0.5, // Conservative estimate
        target_belief_ids: [node.id],
        rationale: `Research external context for: ${node.claim}`,
      });
    }

    return candidates;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════════════════

  private static calculateEntropy(node: BeliefNode): number {
    // Simplified entropy: -p*log(p) - (1-p)*log(1-p) where p = alpha/(alpha+beta)
    const total = node.alpha + node.beta;
    if (total === 0) return 0;
    const p = node.alpha / total;
    if (p === 0 || p === 1) return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  }

  private static createDeepResearchCandidate(
    node: BeliefNode,
    graph: MentalizationGraph,
    dyadId: string
  ): MviCandidate {
    const prompt = this.buildDeepResearchPrompt(node, graph);
    
    return {
      id: this.generateId('deep_research', node.id),
      capability: 'deep_research',
      payload: {
        prompt,
        schema: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            facts: { type: 'array', items: { type: 'object' } },
          },
        },
      },
      cost_credits: 3, // Base cost for deep research
      expected_information_gain: this.calculateEntropy(node),
      target_belief_ids: [node.id],
      rationale: `Investigate belief about ${node.claim} (current entropy: ${this.calculateEntropy(node).toFixed(3)})`,
    };
  }

  private static buildDeepResearchPrompt(node: BeliefNode, graph: MentalizationGraph): string {
    // Build a research prompt based on the belief claim and related context
    const relatedClaims = graph.edges
      .filter(e => e.to === node.id)
      .map(e => graph.nodes[e.from]?.claim)
      .filter(Boolean)
      .slice(0, 3);

    let prompt = `Research the following claim about a relationship partner: "${node.claim}"`;
    
    if (relatedClaims.length > 0) {
      prompt += `\n\nRelated context:\n${relatedClaims.map(c => `- ${c}`).join('\n')}`;
    }

    prompt += `\n\nFocus on finding evidence that confirms or disconfirms this claim. Return a headline and supporting facts with sources.`;

    return prompt;
  }

  private static extractLinkedInUsername(claim: string): string {
    // Simple extraction - in production would be more sophisticated
    const match = claim.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : 'unknown';
  }

  private static generateId(capability: HogCapability, nodeId: string): string {
    // Semantic idempotency key will be computed by HogClient
    // This is just a local identifier
    return `${capability}_${nodeId}`;
  }
}
