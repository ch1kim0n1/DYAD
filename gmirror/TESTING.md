# GMirror Testing Guide

## Test Structure

```
test/
├── runner.test.ts          # SyntheticUserRunner tests
├── verdict.test.ts         # VerdictAggregator tests
├── population.test.ts      # PopulationManager tests
└── failure-mode.test.ts    # FailureModeLibrary tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test runner.test.ts
```

## Test Categories

### Unit Tests

**SyntheticUserRunner** (`test/runner.test.ts`)
- RunRecord has required fields
- High-trust users don't abandon immediately
- Low-trust users abandon on frustration
- RunPanel returns one record per user
- Subjective trace arrays grow with steps
- Cost is non-negative

**VerdictAggregator** (`test/verdict.test.ts`)
- Verdict has all required fields
- Correctness score is 1.0 when all succeed
- Correctness score is 0 when all fail
- Overall is fail when harmful runs trigger gate
- Overall is pass/with_warnings when all succeed with low frustration
- Empty run list returns valid verdict with 0 correctness

**PopulationManager** (`test/population.test.ts`)
- Population creation and management
- Panel drawing with filters
- Persona and expertise domain filtering
- Trust range filtering

**FailureModeLibrary** (`test/failure-mode.test.ts`)
- Predefined failure modes
- Extraction from run records
- Clustering by last-3-action patterns
- Severity classification based on occurrence count

## Test Data Fixtures

Test helpers create minimal valid objects:

```typescript
function makeUser(overrides?: Partial<SyntheticUser>): SyntheticUser { ... }
function makeScenario(): Scenario { ... }
function makeRunRecord(outcome: RunRecord['outcome']): RunRecord { ... }
function makeRequest(): TestRequest { ... }
```

## Coverage Goals

- Core modules: > 90%
- Behavioral tests: > 85%
- Overall: > 85%

## Adding Tests

1. Create test file in `test/`
2. Import from `@jest/globals`
3. Use `describe`, `it`, `expect`, `beforeEach`
4. Follow existing test patterns
5. Add helpers for fixture creation

## CI Testing

```bash
npm run verify    # typecheck + test
npm run ci:local  # verify + build
```
