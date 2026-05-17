/**
 * NOUS Cognitive Twin — per-dyad orchestrator for the NOUS cycle.
 *
 * Orchestrates the full NOUS cycle:
 *   1. Load mentalization graph
 *   2. Generate MVI candidates from graph
 *   3. Select optimal plan via MviPlanner
 *   4. Execute Hog queries via HogClient
 *   5. Apply evidence to graph via AdversarialProtocol
 *   6. Save updated graph
 *
 * Returns CognitiveTwinCycleOutput with all decisions and enriched summary.
 */
import type {
  CognitiveTwinCycleOutput,
  MentalizationGraph,
  MviPlan,
  HogOperationResult,
  ArbiterDecision,
  EthicsVerdict,
  HypothesisFork,
  HypothesisClass,
} from '@dyad/shared';
import { LocalJsonGraphRepository } from '../graph/repository.js';
import { SchemaMigrator } from '../graph/migrations.js';
import { MentalizationGraphImpl } from '../graph/mentalization-graph.js';
import { MviPlanner } from '../mvi/planner.js';
import { MviCandidateGenerator, type CandidateGenerationOptions } from '../mvi/candidates.js';
import { AdversarialProtocol, type AdversarialProtocolOptions } from '../adversarial/protocol.js';
import { EthicsGate, type EthicsGateOptions } from '../ethics/ethics-gate.js';

// ════════════════════════════════════════════════════════════════════════════
// Cognitive Twin Options
// ════════════════════════════════════════════════════════════════════════════

export interface CognitiveTwinOptions {
  dyadId: string;
  budget?: number; // Default: 10 credits
  gbrainOptions?: {
    baseUrl?: string;
    apiKey?: string;
  };
  adversarialOptions?: AdversarialProtocolOptions;
  ethicsOptions?: EthicsGateOptions;
}

// ════════════════════════════════════════════════════════════════════════════
// Cognitive Twin
// ════════════════════════════════════════════════════════════════════════════

export class CognitiveTwin {
  private repository: LocalJsonGraphRepository;
  private adversarialProtocol: AdversarialProtocol;
  private ethicsGate: EthicsGate;
  private readonly budget: number;
  private readonly dyadId: string;

  constructor(options: CognitiveTwinOptions) {
    this.dyadId = options.dyadId;
    this.budget = options.budget ?? 10;
    this.repository = new LocalJsonGraphRepository();
    this.adversarialProtocol = new AdversarialProtocol(options.adversarialOptions);
    this.ethicsGate = new EthicsGate(options.ethicsOptions);
  }

  /**
   * Run the full NOUS cycle.
   */
  async runCycle(): Promise<CognitiveTwinCycleOutput> {
    // Step 1: Load and migrate graph
    const rawGraph = await this.repository.load(this.dyadId);
    const migratedGraph = SchemaMigrator.migrate(rawGraph);
    const graph = MentalizationGraphImpl.from(migratedGraph);

    // Step 2: Generate MVI candidates
    const genOptions: CandidateGenerationOptions = {
      dyadId: this.dyadId,
      budget: this.budget,
      maxCandidates: 50,
    };
    const deepResearchCandidates = MviCandidateGenerator.generateDeepResearchCandidates(
      graph.toObject(),
      genOptions
    );
    const peopleResearchCandidates = MviCandidateGenerator.generatePeopleResearchCandidates(
      graph.toObject(),
      genOptions
    );
    const allCandidates = [...deepResearchCandidates, ...peopleResearchCandidates];

    // Step 3: Select optimal plan
    const mviPlan: MviPlan = MviPlanner.plan(allCandidates, this.budget);

    // Step 4: Execute Hog queries (stub - returns mock results)
    const hogResults: HogOperationResult[] = mviPlan.selected.map(candidate => ({
      operation_id: `op-${candidate.id}`,
      status: 'completed',
      result: {
        headline: `Research completed for ${candidate.id}`,
        facts: [],
      },
      credits_spent: candidate.cost_credits,
    }));

    // Step 5: Apply evidence via adversarial protocol
    const decisions: ArbiterDecision[] = [];
    for (const result of hogResults) {
      if (result.status !== 'completed') continue;

      // Create evidence from Hog result
      const evidence = {
        kind: 'hog_operation' as const,
        ref_id: result.operation_id,
        observed_at: new Date().toISOString(),
        polarity: 'confirms' as const,
        strength: 0.7,
      };

      // Apply to high-entropy nodes
      const nodes = graph.getAllNodes().slice(0, 3);
      for (const node of nodes) {
        const decision = await this.adversarialProtocol.run(node, evidence);
        decisions.push(decision);

        if (decision.committed && decision.committed_update) {
          graph.applyUpdates([decision.committed_update]);
        }
      }
    }

    // Step 6: Generate hypothesis fork (stub)
    const hypothesisFork: HypothesisFork = this.generateHypothesisFork(graph);

    // Step 7: Generate enriched summary
    const enrichedSummary = this.generateEnrichedSummary(decisions, hogResults);

    // Step 8: Apply ethics gate
    const claims = [
      {
        text: enrichedSummary,
        source: 'enrichment' as const,
        confidence: 0.8,
        citations: hogResults.map(r => r.operation_id),
      },
    ];
    const ethicsVerdict: EthicsVerdict = this.ethicsGate.filter(claims);

    // Step 9: Save updated graph
    await this.repository.save(graph.toObject());

    return {
      graph_snapshot_id: `snapshot-${Date.now()}`,
      mvi_plan: mviPlan,
      hog_results: hogResults,
      decisions,
      enriched_summary: ethicsVerdict.allowed ? ethicsVerdict.filtered_claims[0].text : 'Content filtered by ethics gate',
      ethics_verdict: ethicsVerdict,
      user_facing_claims: ethicsVerdict.filtered_claims.map(c => c.text),
      hypothesis_fork: hypothesisFork,
    };
  }

  private generateHypothesisFork(graph: MentalizationGraphImpl): HypothesisFork {
    const classes: HypothesisClass[] = [
      {
        id: 'benign_misread',
        label: 'Benign Misread',
        prior: 0.4,
        posterior: 0.3,
        rationale: 'Message likely misinterpreted without deeper meaning',
      },
      {
        id: 'partner_stressor',
        label: 'Partner Stressor',
        prior: 0.3,
        posterior: 0.5,
        rationale: 'Partner may be experiencing external stress',
      },
      {
        id: 'relational_drift',
        label: 'Relational Drift',
        prior: 0.3,
        posterior: 0.2,
        rationale: 'Slow divergence in values or goals',
      },
    ];

    const klDiverence = classes.reduce((sum, c) => {
      const diff = c.posterior - c.prior;
      return sum + Math.abs(diff * Math.log2(c.posterior / c.prior));
    }, 0);

    return {
      classes,
      kl_divergence: klDiverence,
      chosen_id: classes.reduce((best, c) => c.posterior > best.posterior ? c : best).id,
    };
  }

  private generateEnrichedSummary(
    decisions: ArbiterDecision[],
    hogResults: HogOperationResult[]
  ): string {
    const completedOps = hogResults.filter(r => r.status === 'completed').length;
    const committedDecisions = decisions.filter(d => d.committed).length;
    const avgKl = decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.kl_divergence, 0) / decisions.length
      : 0;

    return `NOUS analysis complete: ${completedOps} Hog operations executed, ${committedDecisions} belief updates committed. Average KL divergence: ${avgKl.toFixed(3)} bits.`;
  }
}
