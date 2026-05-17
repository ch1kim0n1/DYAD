import { BudgetLedger, createBudgetLedger } from '../src/core/budget-ledger';

describe('BudgetLedger', () => {
  let ledger: BudgetLedger;

  beforeEach(() => {
    ledger = createBudgetLedger({ max_budget_usd: 1.0 });
  });

  describe('reserve/commit cycle', () => {
    it('commits actual cost and updates remaining correctly', () => {
      const res = ledger.reserve('test-op', 0.10);
      ledger.commit(res.id, 0.08);

      const status = ledger.getStatus();
      // remaining = max - committed - reserved_active = 1.0 - 0.08 - 0 = 0.92
      expect(status.total_committed).toBeCloseTo(0.08);
      expect(status.remaining_budget).toBeCloseTo(0.92);
    });

    it('reservation transitions to committed state', () => {
      const res = ledger.reserve('test-op', 0.10);
      const committed = ledger.commit(res.id, 0.08);
      expect(committed.status).toBe('committed');
      expect(committed.committed_usd).toBeCloseTo(0.08);
    });
  });

  describe('budget enforcement', () => {
    it('throws when reservation exceeds max budget', () => {
      expect(() => ledger.reserve('over-budget', 1.01)).toThrow(/exceed max budget/i);
    });

    it('throws when cumulative reservations exceed max budget', () => {
      ledger.reserve('op1', 0.60);
      expect(() => ledger.reserve('op2', 0.50)).toThrow(/exceed max budget/i);
    });
  });

  describe('isExhausted via getStatus', () => {
    it('shows utilization_rate of 1.0 when full budget is committed', async () => {
      const res = ledger.reserve('full-op', 1.0);
      ledger.commit(res.id, 1.0);

      const status = ledger.getStatus();
      expect(status.utilization_rate).toBeCloseTo(1.0);
      expect(status.remaining_budget).toBeCloseTo(0);
    });
  });

  describe('getStatus()', () => {
    it('returns required fields with correct types', () => {
      const status = ledger.getStatus();
      expect(typeof status.max_budget_usd).toBe('number');
      expect(typeof status.remaining_budget).toBe('number');
      expect(typeof status.utilization_rate).toBe('number');
      expect(typeof status.total_committed).toBe('number');
      expect(typeof status.total_reserved).toBe('number');
    });

    it('reflects max_budget_usd from config', () => {
      expect(ledger.getStatus().max_budget_usd).toBe(1.0);
    });

    it('utilization_rate is 0 on fresh ledger', () => {
      expect(ledger.getStatus().utilization_rate).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('returns reservation count fields', () => {
      const stats = ledger.getStats();
      expect(typeof stats.total_reservations).toBe('number');
      expect(typeof stats.active_reservations).toBe('number');
      expect(typeof stats.committed_reservations).toBe('number');
    });

    it('counts reservations correctly after reserve and commit', () => {
      const res1 = ledger.reserve('op1', 0.10);
      ledger.reserve('op2', 0.05);
      ledger.commit(res1.id, 0.09);

      const stats = ledger.getStats();
      expect(stats.total_reservations).toBe(2);
      expect(stats.committed_reservations).toBe(1);
      expect(stats.active_reservations).toBe(1);
    });
  });

  describe('release', () => {
    it('frees reserved budget after release', () => {
      const res = ledger.reserve('op', 0.50);
      ledger.release(res.id);

      const status = ledger.getStatus();
      expect(status.total_reserved).toBe(0);
      expect(status.remaining_budget).toBeCloseTo(1.0);
    });
  });
});
