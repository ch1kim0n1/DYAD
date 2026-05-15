import {
  FeatureVector,
  NormalizedMessage,
  OrchestratorResult,
  RelationshipModel,
} from '@dyad/shared';
import { BidAsymmetryDetector } from './bid-asymmetry.js';
import { PredictiveDivergenceDetector } from './predictive-divergence.js';
import { PhantomThirdPartyDetector } from './phantom-third-party.js';
import { PrimarySecondaryDetector } from './primary-secondary.js';
import { EthicalRefusalClassifier } from './ethical-refusal.js';

export interface OrchestratorOptions {
  apiKey?: string;
  /** Inject a pre-configured ethical classifier (useful in tests). */
  ethical?: EthicalRefusalClassifier;
  /** Inject the primary-secondary detector (Sonnet-backed; optional). */
  primarySecondary?: PrimarySecondaryDetector;
  /** Dyad identifier — embedded in OrchestratorResult. */
  dyadId?: string;
  /** Logger called on individual detector failures. */
  onDetectorError?: (name: string, err: Error) => void;
}

export interface OrchestratorInput {
  messages: NormalizedMessage[];
  features: FeatureVector[];
  relationshipModel?: RelationshipModel;
}

/**
 * DetectorOrchestrator — the single entry point for all detection.
 *
 * Hard gate: `EthicalRefusalClassifier.classify` runs first. When
 * `safe === false`, the result returns IMMEDIATELY with only the ethical
 * refusal field populated. No other detector output is ever produced.
 *
 * When safe, all analytical detectors run in parallel; individual failures
 * are caught and logged so one bad detector cannot block the others.
 */
export class DetectorOrchestrator {
  private bidAsymmetry = new BidAsymmetryDetector();
  private predictiveDivergence = new PredictiveDivergenceDetector();
  private phantomThirdParty = new PhantomThirdPartyDetector();
  private ethical: EthicalRefusalClassifier;
  private primarySecondary: PrimarySecondaryDetector | null;
  private dyadId: string;
  private onDetectorError: (name: string, err: Error) => void;

  constructor(options: OrchestratorOptions = {}) {
    this.dyadId = options.dyadId ?? 'default';
    this.ethical = options.ethical ?? new EthicalRefusalClassifier({ apiKey: options.apiKey });
    this.primarySecondary = options.primarySecondary ?? this.tryBuildPrimarySecondary(options.apiKey);
    this.onDetectorError = options.onDetectorError ?? ((name, err) => {
      console.error(`[orchestrator] detector "${name}" failed:`, err.message);
    });
  }

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const now = Date.now();
    const ethicalRefusal = await this.ethical.classify(input.messages, input.features);

    const base: OrchestratorResult = {
      result_id: `${this.dyadId}-${now}`,
      dyad_id: this.dyadId,
      generated_at: new Date(now).toISOString(),
      analyzed_at: now,
      ethical_refusal: ethicalRefusal,
      detectors: { ethical_refusal: ethicalRefusal },
      summary: '',
      recommended_actions: [],
      citations: [],
      confidence: 0,
    };

    // HARD GATE — when unsafe, never run analytical detectors.
    if (!ethicalRefusal.safe) {
      return {
        ...base,
        summary: 'Conversation contains safety-critical signals. Showing crisis resources.',
        recommended_actions: ethicalRefusal.crisis_resources.map(r => r.description),
      };
    }

    const settled = await Promise.allSettled([
      this.runSafely('bid_asymmetry', () => this.bidAsymmetry.detect(input.features, input.messages)),
      this.runSafely('predictive_divergence', () => this.predictiveDivergence.detect(input.features, input.messages)),
      this.runSafely('phantom_third_party', () => this.phantomThirdParty.detect(input.features)),
      this.runSafely('primary_secondary', () => this.runPrimarySecondary(input)),
    ]);

    const bid = settled[0].status === 'fulfilled' ? settled[0].value as ReturnType<BidAsymmetryDetector['detect']> : null;
    const divergence = settled[1].status === 'fulfilled' ? settled[1].value as ReturnType<PredictiveDivergenceDetector['detect']> : null;
    const phantom = settled[2].status === 'fulfilled' ? settled[2].value as ReturnType<PhantomThirdPartyDetector['detect']> : null;
    const primarySecondary = settled[3].status === 'fulfilled' ? settled[3].value as Awaited<ReturnType<PrimarySecondaryDetector['detect']>> : null;

    const merged: OrchestratorResult = {
      ...base,
      bid_asymmetry: bid ?? undefined,
      predictive_divergence: divergence ?? undefined,
      phantom_third_party: phantom ?? undefined,
      primary_secondary: primarySecondary ?? undefined,
      relationship_model: input.relationshipModel,
      detectors: {
        ethical_refusal: ethicalRefusal,
        bid_asymmetry: bid ?? undefined,
        predictive_divergence: divergence ?? undefined,
        phantom_third_party: phantom ?? undefined,
        primary_secondary: primarySecondary ?? undefined,
      },
      summary: this.summarise({ bid, divergence, phantom, primarySecondary }),
      confidence: this.aggregateConfidence({ bid, divergence, phantom, primarySecondary }),
    };
    return merged;
  }

  private async runSafely<T>(name: string, fn: () => T | Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.onDetectorError(name, err as Error);
      return null;
    }
  }

  private async runPrimarySecondary(input: OrchestratorInput) {
    if (!this.primarySecondary || input.messages.length === 0) return null;
    // Run only on the most recent message
    const target = [...input.messages]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const targetVector = input.features.find(f => f.message_id === target.message_id);
    if (!targetVector) return null;
    return this.primarySecondary.detect(target, targetVector, input.messages);
  }

  private summarise(parts: {
    bid: ReturnType<BidAsymmetryDetector['detect']> | null;
    divergence: ReturnType<PredictiveDivergenceDetector['detect']> | null;
    phantom: ReturnType<PhantomThirdPartyDetector['detect']> | null;
    primarySecondary: Awaited<ReturnType<PrimarySecondaryDetector['detect']>> | null;
  }): string {
    const out: string[] = [];
    if (parts.bid?.detected) out.push(`bid asymmetry (${parts.bid.severity})`);
    if (parts.divergence?.detected) out.push('predictive divergence');
    if (parts.phantom?.detected) out.push('phantom third-party presence');
    if (parts.primarySecondary && parts.primarySecondary.confidence >= 0.7) {
      out.push(`secondary emotion: ${parts.primarySecondary.surface_emotion}→${parts.primarySecondary.underlying_emotion}`);
    }
    return out.length === 0 ? 'No notable patterns detected.' : `Detected: ${out.join('; ')}`;
  }

  private aggregateConfidence(parts: {
    bid: ReturnType<BidAsymmetryDetector['detect']> | null;
    divergence: ReturnType<PredictiveDivergenceDetector['detect']> | null;
    phantom: ReturnType<PhantomThirdPartyDetector['detect']> | null;
    primarySecondary: Awaited<ReturnType<PrimarySecondaryDetector['detect']>> | null;
  }): number {
    const sigs: number[] = [];
    if (parts.bid) sigs.push(parts.bid.confidence);
    if (parts.primarySecondary) sigs.push(parts.primarySecondary.confidence);
    if (sigs.length === 0) return 0;
    return sigs.reduce((a, b) => a + b, 0) / sigs.length;
  }

  private tryBuildPrimarySecondary(apiKey?: string): PrimarySecondaryDetector | null {
    try {
      return new PrimarySecondaryDetector({ apiKey });
    } catch {
      // No API key available — orchestrator simply skips primary/secondary
      return null;
    }
  }
}
