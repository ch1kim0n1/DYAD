import { CostLedger, CostLedgerConfig, CostReservation } from '../src/core/cost-ledger';

const baseConfig: CostLedgerConfig = {
  budget_usd_per_hour: 1.0,
  max_reserve_usd: 0.50,
  auto_commit: false,
  persistence_enabled: false,
};

describe('CostLedger', () => {
  let ledger: CostLedger;

  beforeEach(() => {
    ledger = new CostLedger(baseConfig);
  });

  it('reserve() stores an entry and returns a reservation', () => {
    const res = ledger.reserve('op1', 0.10, 'tier1');
    expect(res.id).toBeDefined();
    expect(res.operation_id).toBe('op1');
    expect(res.reserved_amount_usd).toBe(0.10);
    expect(res.status).toBe('reserved');
  });

  it('getStatistics() returns total_committed_usd > 0 after commit', () => {
    const res = ledger.reserve('op2', 0.10, 'tier1');
    ledger.commit(res.id, 0.08);
    const stats = ledger.getStatistics();
    expect(stats.total_committed_usd).toBeGreaterThan(0);
    expect(stats.total_committed_usd).toBeCloseTo(0.08);
  });

  it('getStatistics().byTier groups entries by model tier', () => {
    const r1 = ledger.reserve('op-a', 0.05, 'tier1');
    const r2 = ledger.reserve('op-b', 0.05, 'tier2');
    ledger.commit(r1.id, 0.04);
    ledger.commit(r2.id, 0.06);
    const stats = ledger.getStatistics();
    expect(stats.byTier['tier1']).toBeDefined();
    expect(stats.byTier['tier2']).toBeDefined();
    expect(stats.byTier['tier1'].count).toBe(1);
    expect(stats.byTier['tier2'].count).toBe(1);
  });

  it('getBudget() available_usd decreases after reservation', () => {
    const before = ledger.getBudget().available_usd;
    ledger.reserve('op3', 0.20, 'tier1');
    const after = ledger.getBudget().available_usd;
    expect(after).toBeCloseTo(before - 0.20);
  });

  it('rollback() frees reserved budget', () => {
    const res = ledger.reserve('op4', 0.30, 'tier1');
    const before = ledger.getBudget().available_usd;
    ledger.rollback(res.id);
    const after = ledger.getBudget().available_usd;
    expect(after).toBeCloseTo(before + 0.30);
    expect(ledger.getReservation(res.id)!.status).toBe('rolled_back');
  });

  it('handles zero-cost entries without error', () => {
    const res = ledger.reserve('zero-op', 0.0, 'tier1');
    expect(res.reserved_amount_usd).toBe(0.0);
    ledger.commit(res.id, 0.0);
    const stats = ledger.getStatistics();
    expect(stats.committed_count).toBe(1);
  });

  it('handles multiple sequential reservations and commits', () => {
    const r1 = ledger.reserve('a', 0.10, 'tier1');
    const r2 = ledger.reserve('b', 0.10, 'tier1');
    const r3 = ledger.reserve('c', 0.10, 'tier1');
    ledger.commit(r1.id, 0.09);
    ledger.commit(r2.id, 0.10);
    ledger.commit(r3.id, 0.11);
    const stats = ledger.getStatistics();
    expect(stats.committed_count).toBe(3);
    expect(stats.total_committed_usd).toBeCloseTo(0.30);
  });

  it('getStatistics() returns rolled_back_count correctly', () => {
    const r1 = ledger.reserve('rb1', 0.10, 'tier1');
    const r2 = ledger.reserve('rb2', 0.10, 'tier1');
    ledger.rollback(r1.id);
    ledger.rollback(r2.id);
    const stats = ledger.getStatistics();
    expect(stats.rolled_back_count).toBe(2);
  });

  it('daily cap enforcement: throws when exceeding budget', () => {
    expect(() => ledger.reserve('big', 0.60, 'tier1')).toThrow();
  });

  it('serialization round-trip: getAllReservations returns all stored entries', () => {
    const r1 = ledger.reserve('s1', 0.05, 'tier1');
    const r2 = ledger.reserve('s2', 0.05, 'tier2');
    ledger.commit(r1.id, 0.04);
    const all = ledger.getAllReservations();
    expect(all.length).toBe(2);
    const ids = all.map(r => r.id);
    expect(ids).toContain(r1.id);
    expect(ids).toContain(r2.id);
  });
});
