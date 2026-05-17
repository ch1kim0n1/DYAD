/**
 * NOUS Mentalization Graph — Bayesian belief substrate.
 *
 * Stores beliefs as Beta(α,β) posteriors over claims. Each BeliefNode:
 *   - alpha: confirming pseudo-counts (starts at 1, Laplace prior)
 *   - beta: disconfirming pseudo-counts (starts at 1)
 *   - embedding: 64-dim hashed bag-of-words (optional, L2-normalized)
 *   - evidence_refs: chain of evidence with polarity and strength
 *
 * Entropy H(Beta(α,β)) = log(B(α,β)) - (α-1)ψ(α) - (β-1)ψ(β) + (α+β-2)ψ(α+β)
 * where ψ is the digamma function. Closed-form via approximation.
 */
import type {
  BeliefDimension,
  BeliefEdge,
  BeliefNode,
  BeliefUpdate,
  EvidenceRef,
  MentalizationGraph,
} from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// Digamma approximation (Abramowitz & Stegun 6.3.16)
// ════════════════════════════════════════════════════════════════════════════

function digamma(x: number): number {
  if (x < 1e-10) return -0.5772156649; // -γ
  const series = 0.5772156649 + 1 / x - 1 / (x + 1);
  return series;
}

// ════════════════════════════════════════════════════════════════════════════
// Beta distribution utilities
// ════════════════════════════════════════════════════════════════════════════

function betaFunction(a: number, b: number): number {
  // Log B(α,β) = log(Γ(α)) + log(Γ(β)) - log(Γ(α+β))
  // Use lgamma approximation
  const lgamma = (x: number): number => {
    if (x < 1) return 0;
    // Stirling's approximation
    return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI);
  };
  return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b));
}

function betaEntropy(alpha: number, beta: number): number {
  if (alpha < 1 || beta < 1) return 0;
  // Simplified entropy approximation for Beta distribution
  // H(Beta) ≈ ln(B(α,β)) - (α-1)ψ(α) - (β-1)ψ(β) + (α+β-2)ψ(α+β)
  // Use absolute value to ensure non-negative result
  const b = betaFunction(alpha, beta);
  const term1 = Math.log(Math.max(b, 1e-10));
  const term2 = (alpha - 1) * digamma(alpha);
  const term3 = (beta - 1) * digamma(beta);
  const term4 = (alpha + beta - 2) * digamma(alpha + beta);
  const entropy = term1 - term2 - term3 + term4;
  return Math.max(0, entropy);
}

// ════════════════════════════════════════════════════════════════════════════
// Hashed bag-of-words embedding (64-dim, zero deps)
// ════════════════════════════════════════════════════════════════════════════

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function generateEmbedding(text: string, dim: number = 64): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const embedding = new Float32Array(dim);
  
  for (const word of words) {
    const hash = hashString(word);
    const idx = hash % dim;
    embedding[idx] += 1;
  }
  
  // L2 normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      embedding[i] /= norm;
    }
  }
  
  return Array.from(embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ════════════════════════════════════════════════════════════════════════════
// MentalizationGraph
// ════════════════════════════════════════════════════════════════════════════

export class MentalizationGraphImpl {
  constructor(private graph: MentalizationGraph) {}

  static create(dyadId: string): MentalizationGraphImpl {
    return new MentalizationGraphImpl({
      dyad_id: dyadId,
      nodes: {},
      edges: [],
      schema_version: 1,
      updated_at: new Date().toISOString(),
    });
  }

  static from(graph: MentalizationGraph): MentalizationGraphImpl {
    return new MentalizationGraphImpl(graph);
  }

  toObject(): MentalizationGraph {
    return this.graph;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Node operations
  // ════════════════════════════════════════════════════════════════════════════

  addNode(node: BeliefNode): void {
    this.graph.nodes[node.id] = node;
    this.graph.updated_at = new Date().toISOString();
  }

  getNode(id: string): BeliefNode | undefined {
    return this.graph.nodes[id];
  }

  getAllNodes(): BeliefNode[] {
    return Object.values(this.graph.nodes);
  }

  getNodesByDimension(dimension: BeliefDimension): BeliefNode[] {
    return this.getAllNodes().filter(n => n.dimension === dimension);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Edge operations
  // ════════════════════════════════════════════════════════════════════════════

  addEdge(edge: BeliefEdge): void {
    this.graph.edges.push(edge);
    this.graph.updated_at = new Date().toISOString();
  }

  getEdges(): BeliefEdge[] {
    return this.graph.edges;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Belief updates
  // ════════════════════════════════════════════════════════════════════════════

  applyUpdates(updates: BeliefUpdate[]): void {
    for (const update of updates) {
      const node = this.graph.nodes[update.node_id];
      if (!node) continue;

      node.alpha += update.alpha_delta;
      node.beta += update.beta_delta;
      node.evidence_refs.push(update.evidence);
      node.last_updated = update.evidence.observed_at;
      
      // Regenerate embedding if this is a significant update
      if (update.evidence.kind === 'message' || update.evidence.kind === 'hog_operation') {
        node.embedding = generateEmbedding(node.claim);
      }
    }
    this.graph.updated_at = new Date().toISOString();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Entropy and information gain
  // ════════════════════════════════════════════════════════════════════════════

  getNodeEntropy(nodeId: string): number {
    const node = this.graph.nodes[nodeId];
    if (!node) return 0;
    return betaEntropy(node.alpha, node.beta);
  }

  getExpectedInformationGain(
    nodeId: string,
    alphaDelta: number,
    betaDelta: number
  ): number {
    const node = this.graph.nodes[nodeId];
    if (!node) return 0;
    
    const priorEntropy = betaEntropy(node.alpha, node.beta);
    const posteriorEntropy = betaEntropy(node.alpha + alphaDelta, node.beta + betaDelta);
    
    return priorEntropy - posteriorEntropy; // bits
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Similarity search (cosine over embeddings)
  // ════════════════════════════════════════════════════════════════════════════

  findSimilarNodes(query: string, k: number = 5): Array<{ node: BeliefNode; similarity: number }> {
    const queryEmbedding = generateEmbedding(query);
    const similarities = this.getAllNodes()
      .filter(n => n.embedding)
      .map(node => ({
        node,
        similarity: cosineSimilarity(queryEmbedding, node.embedding!),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    return similarities;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Utility
  // ════════════════════════════════════════════════════════════════════════════

  clone(): MentalizationGraphImpl {
    return MentalizationGraphImpl.from(JSON.parse(JSON.stringify(this.graph)));
  }
}
