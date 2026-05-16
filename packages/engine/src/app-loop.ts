/**
 * Main application loop (#104).
 *
 * Wires the full DYAD pipeline end-to-end:
 *   ChatDbWatcher → ExtractionPipeline → state updaters → DetectorOrchestrator
 *
 * Designed to run *inside the engine process* (the Tauri sidecar). Calling
 * `startAppLoop()` returns a `{ stop }` handle. Each new batch of messages
 * from the watcher flows through extraction, updates the three model
 * snapshots on disk, runs the orchestrator, and surfaces the result via
 * the `onResult` callback.
 *
 * Failures inside the loop are caught + reported via `onError` so a
 * single batch failure can't take down the watcher. Checkpoints are
 * advanced only after a successful pass.
 */
import type {
  FeatureVector,
  NormalizedMessage,
  OrchestratorResult,
  PartnerModel,
  RelationshipModel,
  SelfModel,
} from '@dyad/shared';
import { ExtractionPipeline, type ExtractionPipelineOptions } from './extraction-pipeline.js';
import { DetectorOrchestrator } from './detectors/orchestrator.js';
import { SelfModelUpdater } from './state/self-model-updater.js';
import { PartnerModelUpdater } from './state/partner-model-updater.js';
import { RelationshipModelUpdater } from './state/relationship-model-updater.js';

export interface AppLoopConfig {
  /** The conversation / dyad id being analysed. */
  conversationId: string;
  /** Stable user identifier for the self-model storage path. */
  userId?: string;
  /** Partner id. Defaults to `<conversationId>-partner`. */
  partnerId?: string;
  /** Storage directory for the three model JSON snapshots. */
  storageDir?: string;
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Concurrency for the extraction pipeline. */
  concurrency?: number;
  /** Per-batch callback fired after a successful orchestrator run. */
  onResult?: (result: OrchestratorResult, models: AppLoopModels) => void;
  /** Per-batch callback fired on any failure inside the loop. */
  onError?: (err: Error) => void;
}

export interface AppLoopModels {
  self: SelfModel;
  partner: PartnerModel;
  relationship: RelationshipModel;
}

export interface AppLoopHandle {
  /** Push a new batch of messages through the full pipeline. */
  process: (messages: NormalizedMessage[]) => Promise<OrchestratorResult | null>;
  /** Stop the loop. Currently a no-op — kept for symmetry with watcher-driven entrypoints. */
  stop: () => void;
  /** Current model snapshot in memory (last successful pass). */
  getModels: () => AppLoopModels | null;
}

/**
 * Build a loop. The returned handle is the standard entry point — Tauri's
 * sidecar `/analyze` calls `handle.process(messages)`, and any test or
 * script that wants the same composition can do the same without re-
 * wiring the five components.
 */
export function startAppLoop(config: AppLoopConfig): AppLoopHandle {
  const conversationId = config.conversationId;
  const userId = config.userId ?? `${conversationId}-self`;
  const partnerId = config.partnerId ?? `${conversationId}-partner`;
  const pipelineOptions: ExtractionPipelineOptions = {
    apiKey: config.apiKey,
    concurrency: config.concurrency,
  };

  // Lazily build the LLM-dependent pipeline so the loop can still be
  // constructed (and inspected by tests) when no key is set.
  let pipeline: ExtractionPipeline | null = null;
  function ensurePipeline(): ExtractionPipeline {
    if (!pipeline) pipeline = new ExtractionPipeline(pipelineOptions);
    return pipeline;
  }

  const orchestrator = new DetectorOrchestrator({ apiKey: config.apiKey, dyadId: conversationId });
  const selfUpdater = new SelfModelUpdater(userId, config.storageDir);
  const partnerUpdater = new PartnerModelUpdater(conversationId, partnerId, config.storageDir);
  const relUpdater = new RelationshipModelUpdater(conversationId, config.storageDir);
  let lastModels: AppLoopModels | null = null;

  async function process(messages: NormalizedMessage[]): Promise<OrchestratorResult | null> {
    if (messages.length === 0) return null;
    try {
      const features: FeatureVector[] = await ensurePipeline().processBatch(messages);
      const self = selfUpdater.update(features, messages);
      selfUpdater.save();
      const partner = partnerUpdater.update(features, messages);
      partnerUpdater.save();
      const relationship = relUpdater.update(features, messages);
      relUpdater.save();
      lastModels = { self, partner, relationship };
      const result = await orchestrator.run({ messages, features, relationshipModel: relationship });
      config.onResult?.(result, lastModels);
      return result;
    } catch (err) {
      config.onError?.(err as Error);
      return null;
    }
  }

  return {
    process,
    stop: () => { /* watcher lifecycle is owned by the caller */ },
    getModels: () => lastModels,
  };
}
