# Cost Tracking API Documentation

This document provides detailed API documentation for the cost tracking utilities in the g-stack shared module.

## Table of Contents

- [Budget Ledger](#budget-ledger)
- [Cost Calculator](#cost-calculator)
- [Cost Rollup Manager](#cost-rollup-manager)

---

## Budget Ledger

The budget ledger manages budgets with a reserve/commit pattern for accurate cost tracking.

### Classes

#### `BudgetLedger`

Manages budget reservations and commitments.

**Constructor:**
```typescript
constructor(budgetUsd: number)
```

**Parameters:**
- `budgetUsd` (number): Total budget in USD

**Methods:**

##### `reserve(amountUsd: number): BudgetReservation`

Reserve a portion of the budget for an operation.

**Parameters:**
- `amountUsd` (number): Amount to reserve in USD

**Returns:** Budget reservation object

**Reservation Interface:**
```typescript
interface BudgetReservation {
  id: string; // Unique reservation ID
  amountUsd: number; // Reserved amount
  timestamp: string; // ISO timestamp
}
```

**Throws:** Error if insufficient budget

**Example:**
```typescript
const ledger = new BudgetLedger(100); // $100 budget
const reservation = ledger.reserve(10); // Reserve $10
// Returns: { id: 'res-123', amountUsd: 10, timestamp: '2026-05-13T...' }
```

##### `commit(reservationId: string, actualCostUsd: number): void`

Commit the actual cost for a reservation.

**Parameters:**
- `reservationId` (string): Reservation ID from `reserve()`
- `actualCostUsd` (number): Actual cost incurred

**Throws:** Error if reservation not found or actual cost exceeds reserved amount

**Example:**
```typescript
ledger.commit(reservation.id, 5); // Actual cost was $5, $5 released back to budget
```

##### `cancel(reservationId: string): void`

Cancel a reservation and return the amount to the budget.

**Parameters:**
- `reservationId` (string): Reservation ID to cancel

**Throws:** Error if reservation not found

**Example:**
```typescript
ledger.cancel(reservation.id); // $10 returned to budget
```

##### `getAvailableBudget(): number`

Get the currently available budget.

**Returns:** Available budget in USD

**Example:**
```typescript
const available = ledger.getAvailableBudget();
// Returns: 90 (after reserving $10 from $100)
```

##### `getReservedBudget(): number`

Get the currently reserved budget.

**Returns:** Reserved budget in USD

**Example:**
```typescript
const reserved = ledger.getReservedBudget();
// Returns: 10
```

##### `getCommittedBudget(): number`

Get the total committed budget (actual costs).

**Returns:** Committed budget in USD

**Example:**
```typescript
const committed = ledger.getCommittedBudget();
// Returns: 5
```

##### `getTotalBudget(): number`

Get the total budget.

**Returns:** Total budget in USD

**Example:**
```typescript
const total = ledger.getTotalBudget();
// Returns: 100
```

##### `getUtilization(): number`

Get budget utilization as a percentage.

**Returns:** Utilization percentage (0-100)

**Example:**
```typescript
const utilization = ledger.getUtilization();
// Returns: 5 (5% of $100 committed)
```

##### `reset(): void`

Reset the ledger (clear all reservations and commitments).

**Example:**
```typescript
ledger.reset();
```

---

## Cost Calculator

The cost calculator converts token counts to USD costs using model pricing tables.

### Classes

#### `CostCalculator`

Calculates costs for LLM API calls.

**Methods:**

##### `static calculateCost(model: string, inputTokens: number, outputTokens: number): number`

Calculate the cost of an LLM API call.

**Parameters:**
- `model` (string): Model identifier (e.g., 'claude-sonnet-4-6', 'gpt-4o')
- `inputTokens` (number): Number of input tokens
- `outputTokens` (number): Number of output tokens

**Returns:** Cost in USD

**Throws:** Error if model pricing not found

**Example:**
```typescript
const cost = CostCalculator.calculateCost('claude-sonnet-4-6', 1000, 500);
// Returns: 0.012 (1000 * $0.003 + 500 * $0.015)
```

##### `static getModelPricing(model: string): ModelPricing | null`

Get pricing information for a model.

**Parameters:**
- `model` (string): Model identifier

**Returns:** Model pricing object or null if not found

**Pricing Interface:**
```typescript
interface ModelPricing {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
  avg_latency_ms: number; // Average latency in ms
}
```

**Example:**
```typescript
const pricing = CostCalculator.getModelPricing('claude-sonnet-4-6');
// Returns: { input: 3.0, output: 15.0, avg_latency_ms: 2000 }
```

##### `static estimateTokens(text: string, model?: string): number`

Estimate token count for a text string.

**Parameters:**
- `text` (string): Text to estimate tokens for
- `model` (string, optional): Model to use for estimation (default: 'gpt-4o')

**Returns:** Estimated token count

**Example:**
```typescript
const tokens = CostCalculator.estimateTokens('Hello world', 'claude-sonnet-4-6');
// Returns: 3
```

**Supported Models:**

Anthropic:
- `claude-opus-4-7`: $5.00/1M input, $25.00/1M output
- `claude-sonnet-4-6`: $3.00/1M input, $15.00/1M output
- `claude-haiku-4-5-20251001`: $1.00/1M input, $5.00/1M output
- `claude-opus-4-6`: $5.00/1M input, $25.00/1M output
- `claude-3-5-sonnet-20241022`: $3.00/1M input, $15.00/1M output
- `claude-3-5-haiku-20241022`: $0.80/1M input, $4.00/1M output

OpenAI:
- `gpt-4o`: $2.50/1M input, $10.00/1M output
- `gpt-4o-mini`: $0.15/1M input, $0.60/1M output
- `gpt-4-turbo`: $10.00/1M input, $30.00/1M output
- `gpt-3.5-turbo`: $0.50/1M input, $1.50/1M output

---

## Cost Rollup Manager

The cost rollup manager aggregates costs by day and week for reporting.

### Classes

#### `CostRollupManager`

Manages cost rollups stored in JSON files.

**Constructor:**
```typescript
constructor(basePath?: string)
```

**Parameters:**
- `basePath` (string, optional): Base path for storing rollup files (default: `.gstack/costs`)

**Methods:**

##### `async addCostRecord(record: CostRecord): Promise<void>`

Add a cost record to the rollup.

**Record Interface:**
```typescript
interface CostRecord {
  timestamp: string; // ISO timestamp
  tool: string; // Tool name (e.g., 'gagent', 'gmirror')
  model: string; // Model used
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  request_id?: string;
}
```

**Example:**
```typescript
await rollup.addCostRecord({
  timestamp: new Date().toISOString(),
  tool: 'gagent',
  model: 'claude-sonnet-4-6',
  input_tokens: 1000,
  output_tokens: 500,
  total_tokens: 1500,
  cost_usd: 0.012,
  request_id: 'req-123',
});
```

##### `async getDailyCost(date: string): Promise<DailyCostRollup>`

Get cost rollup for a specific day.

**Parameters:**
- `date` (string): Date in YYYY-MM-DD format

**Returns:** Daily cost rollup object

**Daily Rollup Interface:**
```typescript
interface DailyCostRollup {
  date: string;
  total_cost_usd: number;
  total_tokens: number;
  tool_costs: Record<string, number>;
  model_costs: Record<string, number>;
  request_count: number;
}
```

**Example:**
```typescript
const daily = await rollup.getDailyCost('2026-05-13');
// Returns: { date: '2026-05-13', total_cost_usd: 0.5, ... }
```

##### `async getWeeklyCost(week: string): Promise<WeeklyCostRollup>`

Get cost rollup for a specific week.

**Parameters:**
- `week` (string): Week in YYYY-Www format (e.g., '2026-W20')

**Returns:** Weekly cost rollup object

**Weekly Rollup Interface:**
```typescript
interface WeeklyCostRollup {
  week: string;
  total_cost_usd: number;
  total_tokens: number;
  daily_costs: Record<string, number>;
  tool_costs: Record<string, number>;
  model_costs: Record<string, number>;
  request_count: number;
}
```

**Example:**
```typescript
const weekly = await rollup.getWeeklyCost('2026-W20');
// Returns: { week: '2026-W20', total_cost_usd: 3.5, ... }
```

##### `async getRangeCost(startDate: string, endDate: string): Promise<RangeCostRollup>`

Get cost rollup for a date range.

**Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format

**Returns:** Range cost rollup object

**Range Rollup Interface:**
```typescript
interface RangeCostRollup {
  start_date: string;
  end_date: string;
  total_cost_usd: number;
  total_tokens: number;
  daily_costs: Record<string, number>;
  tool_costs: Record<string, number>;
  model_costs: Record<string, number>;
  request_count: number;
}
```

**Example:**
```typescript
const range = await rollup.getRangeCost('2026-05-01', '2026-05-13');
// Returns: { start_date: '2026-05-01', end_date: '2026-05-13', ... }
```

##### `async listAvailableDays(): Promise<string[]>`

List all days with cost data.

**Returns:** Array of date strings (YYYY-MM-DD)

**Example:**
```typescript
const days = await rollup.listAvailableDays();
// Returns: ['2026-05-01', '2026-05-02', '2026-05-13']
```

##### `async listAvailableWeeks(): Promise<string[]>`

List all weeks with cost data.

**Returns:** Array of week strings (YYYY-Www)

**Example:**
```typescript
const weeks = await rollup.listAvailableWeeks();
// Returns: ['2026-W19', '2026-W20']
```

---

## CLI Integration

Cost tracking is integrated into the gagent CLI:

```bash
# View costs for a specific day
gagent cost --day 2026-05-13

# View costs for a specific week
gagent cost --week 2026-W20

# View costs for a date range
gagent cost --range 2026-05-01 2026-05-13

# Run with budget enforcement
gagent run "task description" --budget-usd 10
```

---

## Best Practices

1. **Always reserve before executing**: Use the budget ledger to reserve costs before executing expensive operations
2. **Commit actual costs**: Always commit the actual cost after execution to release unused budget
3. **Track by request**: Include request IDs in cost records for traceability
4. **Review rollups regularly**: Check daily/weekly rollups to monitor spending trends
5. **Set reasonable budgets**: Use historical data to set appropriate budget limits
6. **Use model tiers**: Choose appropriate model tiers based on task complexity to optimize costs
7. **Monitor token usage**: Use the cost calculator to estimate costs before execution
8. **Clean up old data**: Periodically archive old cost rollup data to manage storage
