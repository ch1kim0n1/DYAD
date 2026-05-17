/**
 * NOUS public entry point. Re-exports every implemented module so callers
 * (app-loop, sidecar, tests) import from `@dyad/engine/nous`.
 *
 * NOTE: re-exports become non-empty as each block lands.
 * Types are available from @dyad/shared.
 */
export {
  HogClient,
  HogError,
  HogAuthError,
  HogPaymentError,
  HogValidationError,
  HogRateLimitError,
  HogTransportError,
  extractDeepResearchResult,
  type HogClientOptions,
  type HogRequestOptions,
  type PeopleEnrichInput,
  type PeopleEnrichIdentity,
  type PeopleEnrichRecord,
  type PeopleEnrichSyncResult,
} from './hog/client';

export {
  HawkesPoller,
  type HawkesPollerOptions,
} from './hog/hawkes-poller';

export {
  IdempotencyCache,
  idempotencyKey,
  canonicalJson,
  temporalBucket,
} from './hog/idempotency';

export {
  MentalizationGraphImpl,
} from './graph/mentalization-graph';

export {
  MentalizationGraphRepository,
  LayeredGraphRepository,
  LocalJsonGraphRepository,
  GBrainGraphRepository,
} from './graph/repository';

export {
  SchemaMigrator,
  LATEST_SCHEMA_VERSION,
  type Migration,
} from './graph/migrations';

export {
  MviPlanner,
} from './mvi/planner';

export {
  MviCandidateGenerator,
  type CandidateGenerationOptions,
} from './mvi/candidates';

export {
  BayesianArbiter,
  type ArbiterOptions,
} from './adversarial/arbiter';

export {
  Mentalizer,
  Adversary,
  AdversarialProtocol,
  type MentalizerOptions,
  type AdversaryOptions,
  type AdversarialProtocolOptions,
} from './adversarial/protocol';

export {
  CognitiveTwin,
  type CognitiveTwinOptions,
} from './twin/cognitive-twin';

export {
  EthicsGate,
  type EthicsGateOptions,
} from './ethics/ethics-gate';
