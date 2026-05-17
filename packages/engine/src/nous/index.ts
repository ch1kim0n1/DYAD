/**
 * NOUS public entry point. Re-exports every implemented module so callers
 * (app-loop, sidecar, tests) import from `@dyad/engine/nous`.
 *
 * NOTE: re-exports become non-empty as each block lands.
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
