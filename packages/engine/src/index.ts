// L1-L2 feature extraction
export { FunctionWordParser, type FunctionWordRates } from './function-word-parser.js';
export {
  LexiconLookup,
  type NRCEmotions,
  type NRCScores,
  type AFINNResult,
} from './lexicon-lookup.js';
export { AffectPass, type AffectScores } from './affect-pass.js';
export {
  LlmExtractor,
  type LLMExtractionResult,
  type LlmExtractorOptions,
} from './llm-extractor.js';
export {
  ExtractionPipeline,
  type ExtractionPipelineOptions,
} from './extraction-pipeline.js';

// L3 metrics
export { LatencyZScore } from './latency-zscore.js';
export { RollingRate } from './rolling-rate.js';

// L3 state updaters
export { SelfModelUpdater } from './state/self-model-updater.js';
export { PartnerModelUpdater } from './state/partner-model-updater.js';
export {
  RelationshipModelUpdater,
  RELATIONSHIP_THRESHOLDS,
} from './state/relationship-model-updater.js';
export { computeRepairLaborIndex } from './state/repair-labor.js';
export { computeMirroringIndex } from './state/mirroring-index.js';

// L4 detectors
export { BidAsymmetryDetector } from './detectors/bid-asymmetry.js';
export { PrimarySecondaryDetector } from './detectors/primary-secondary.js';
export { buildSecondaryEmotionPrompt } from './detectors/secondary-emotion-prompt.js';
export { PredictiveDivergenceDetector } from './detectors/predictive-divergence.js';
export { PhantomThirdPartyDetector } from './detectors/phantom-third-party.js';
export { EthicalRefusalClassifier, CRISIS_RESOURCES } from './detectors/ethical-refusal.js';
export {
  DetectorOrchestrator,
  type OrchestratorOptions,
  type OrchestratorInput,
} from './detectors/orchestrator.js';

// L5 intervention
export { BriefGenerator, type BriefGeneratorOptions } from './intervention/brief-generator.js';
export { buildBriefPrompt, type DetectorType } from './intervention/brief-prompt.js';
export { ReframeGenerator, type ReframeGeneratorOptions } from './intervention/reframe-generator.js';
export { buildReframePrompt } from './intervention/reframe-prompt.js';

// Cost meter (#65)
export { CostMeter, getCostMeter, setCostMeter, type CostRecord } from './cost-meter.js';

// GBrain client
export { GBrainClient, type GBrainPage, type GBrainClientOptions } from './gbrain/client.js';

// Utilities
export * from './utils/index.js';
