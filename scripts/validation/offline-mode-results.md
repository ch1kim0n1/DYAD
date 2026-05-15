# Offline/Degraded Mode Validation — Issue #67

## Summary
DYAD implements graceful degradation when the engine sidecar is unavailable. Briefs and reframes are cached in localStorage for 24 hours, allowing the app to remain useful during network issues or sidecar downtime.

## Implementation

### Caching Layer (`apps/mac/src/lib/gbrain-bridge.ts`)
- Added `getCached<T>()` and `setCached<T>()` helper functions
- Cache keys: `dyad_cache_brief_{detectorType}_{conversationId}`, `dyad_cache_reframe_{detectorType}_{conversationId}`
- Cache expiration: 24 hours
- Automatic cache invalidation on expiration

### API Changes
- `requestBrief()` now accepts optional `conversationId` parameter
- `requestReframe()` now accepts optional `conversationId` parameter
- Both functions check cache before making API calls
- Successful responses are automatically cached

### Fallback Behavior (`apps/mac/src/App.tsx`)
- Sidecar ping has 10-second timeout
- If sidecar is unavailable, error message is displayed: "Engine sidecar not responding"
- App remains functional with cached data
- Error state is shown in header status bar
- Views can still render with previously loaded data

## Test Procedure
1. Start app with sidecar running
2. Load a conversation and generate a brief/reframe
3. Stop the sidecar process
4. Refresh the app
5. Verify: App shows error message but cached brief/reframe still displays
6. Verify: After 24 hours, cache expires and fresh data is required

## Results
✅ App remains useful when API is down
✅ Cached data persists across sessions
✅ Graceful error messages guide user
✅ No crashes or unhandled errors in degraded mode

## Recommendations
- Consider adding a "Retry connection" button when sidecar is down
- Cache could be extended to 7 days for better offline experience
- Add visual indicator when displaying cached vs. fresh data
