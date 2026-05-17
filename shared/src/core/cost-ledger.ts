/**
 * Cost Ledger - Reserve/Commit Semantics with Persistence
 * 
 * Tracks AI model costs with two-phase commit semantics:
 * - Reserve: Allocate budget for an operation before execution
 * - Commit: Finalize the actual cost after execution
 * - Rollback: Release reserved budget if operation fails
 * 
 * Provides cost tracking, budget enforcement, and persistence.
 */

export interface CostReservation {
  id: string;
  operation_id: string;
  reserved_amount_usd: number;
  committed_amount_usd: number;
  status: 'reserved' | 'committed' | 'rolled_back';
  reserved_at: string;
  committed_at?: string;
  model_tier: string;
}

export interface CostBudget {
  total_budget_usd: number;
  reserved_usd: number;
  committed_usd: number;
  available_usd: number;
  period_start: string;
  period_end: string;
}

export interface CostLedgerConfig {
  budget_usd_per_hour: number;
  max_reserve_usd: number;
  auto_commit: boolean;
  persistence_enabled: boolean;
}

export class CostLedger {
  private config: CostLedgerConfig;
  private reservations: Map<string, CostReservation>;
  private currentBudget: CostBudget;
  private persistencePath: string | null;

  constructor(config: CostLedgerConfig, persistencePath?: string) {
    this.config = config;
    this.reservations = new Map();
    this.persistencePath = persistencePath || null;
    
    // Initialize budget for current hour
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    
    this.currentBudget = {
      total_budget_usd: config.budget_usd_per_hour,
      reserved_usd: 0,
      committed_usd: 0,
      available_usd: config.budget_usd_per_hour,
      period_start: hourStart.toISOString(),
      period_end: hourEnd.toISOString(),
    };

    if (this.config.persistence_enabled) {
      this.loadFromPersistence();
    }
  }

  /**
   * Reserve budget for an operation
   */
  reserve(operationId: string, estimatedCostUsd: number, modelTier: string): CostReservation {
    if (estimatedCostUsd > this.config.max_reserve_usd) {
      throw new Error(`Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds max reserve $${this.config.max_reserve_usd.toFixed(4)}`);
    }

    if (estimatedCostUsd > this.currentBudget.available_usd) {
      throw new Error(`Insufficient budget: need $${estimatedCostUsd.toFixed(4)}, available $${this.currentBudget.available_usd.toFixed(4)}`);
    }

    const reservationId = this.generateId();
    const reservation: CostReservation = {
      id: reservationId,
      operation_id: operationId,
      reserved_amount_usd: estimatedCostUsd,
      committed_amount_usd: 0,
      status: 'reserved',
      reserved_at: new Date().toISOString(),
      model_tier: modelTier,
    };

    this.reservations.set(reservationId, reservation);
    this.currentBudget.reserved_usd += estimatedCostUsd;
    this.currentBudget.available_usd -= estimatedCostUsd;

    if (this.config.persistence_enabled) {
      this.saveToPersistence();
    }

    return reservation;
  }

  /**
   * Commit actual cost for a reserved operation
   */
  commit(reservationId: string, actualCostUsd: number): CostReservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation ${reservationId} is not in reserved state (current: ${reservation.status})`);
    }

    // Calculate difference between reserved and actual
    const diff = actualCostUsd - reservation.reserved_amount_usd;
    
    // Update budget
    this.currentBudget.reserved_usd -= reservation.reserved_amount_usd;
    this.currentBudget.committed_usd += actualCostUsd;
    this.currentBudget.available_usd -= diff;

    // Update reservation
    reservation.committed_amount_usd = actualCostUsd;
    reservation.status = 'committed';
    reservation.committed_at = new Date().toISOString();

    if (this.config.persistence_enabled) {
      this.saveToPersistence();
    }

    return reservation;
  }

  /**
   * Rollback a reservation (release budget)
   */
  rollback(reservationId: string): CostReservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation ${reservationId} is not in reserved state (current: ${reservation.status})`);
    }

    // Release reserved budget
    this.currentBudget.reserved_usd -= reservation.reserved_amount_usd;
    this.currentBudget.available_usd += reservation.reserved_amount_usd;

    // Update reservation
    reservation.status = 'rolled_back';

    if (this.config.persistence_enabled) {
      this.saveToPersistence();
    }

    return reservation;
  }

  /**
   * Get current budget status
   */
  getBudget(): CostBudget {
    return { ...this.currentBudget };
  }

  /**
   * Get reservation by ID
   */
  getReservation(reservationId: string): CostReservation | undefined {
    return this.reservations.get(reservationId);
  }

  /**
   * Get all reservations
   */
  getAllReservations(): CostReservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * Get cost statistics for current period
   */
  getStatistics(): {
    total_reservations: number;
    committed_count: number;
    rolled_back_count: number;
    total_committed_usd: number;
    avg_committed_usd: number;
    byTier: { [tier: string]: { count: number; total_usd: number } };
  } {
    const reservations = Array.from(this.reservations.values());
    const committed = reservations.filter(r => r.status === 'committed');
    const rolledBack = reservations.filter(r => r.status === 'rolled_back');
    
    const totalCommittedUsd = committed.reduce((sum, r) => sum + r.committed_amount_usd, 0);
    const avgCommittedUsd = committed.length > 0 ? totalCommittedUsd / committed.length : 0;

    const byTier: { [tier: string]: { count: number; total_usd: number } } = {};
    for (const r of committed) {
      if (!byTier[r.model_tier]) {
        byTier[r.model_tier] = { count: 0, total_usd: 0 };
      }
      byTier[r.model_tier].count++;
      byTier[r.model_tier].total_usd += r.committed_amount_usd;
    }

    return {
      total_reservations: reservations.length,
      committed_count: committed.length,
      rolled_back_count: rolledBack.length,
      total_committed_usd: totalCommittedUsd,
      avg_committed_usd: avgCommittedUsd,
      byTier,
    };
  }

  /**
   * Reset budget for new period
   */
  resetBudget(newBudgetUsd: number): void {
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);

    // Rollback all pending reservations
    for (const reservation of this.reservations.values()) {
      if (reservation.status === 'reserved') {
        this.rollback(reservation.id);
      }
    }

    this.currentBudget = {
      total_budget_usd: newBudgetUsd,
      reserved_usd: 0,
      committed_usd: 0,
      available_usd: newBudgetUsd,
      period_start: hourStart.toISOString(),
      period_end: hourEnd.toISOString(),
    };

    if (this.config.persistence_enabled) {
      this.saveToPersistence();
    }
  }

  /**
   * Save ledger state to persistence
   */
  private saveToPersistence(): void {
    if (!this.persistencePath) return;

    // Fire-and-forget persistence to avoid blocking
    (async () => {
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
      
        const state = {
          budget: this.currentBudget,
          reservations: Array.from(this.reservations.entries()),
          saved_at: new Date().toISOString(),
        };

        const dir = path.dirname(this.persistencePath!);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.persistencePath!, JSON.stringify(state, null, 2));
      } catch (error) {
        console.error('[CostLedger] Failed to save to persistence:', error);
        // Don't throw - persistence failures shouldn't break cost tracking
      }
    })();
  }

  /**
   * Load ledger state from persistence
   */
  private loadFromPersistence(): void {
    if (!this.persistencePath) return;

    // Fire-and-forget persistence to avoid blocking
    (async () => {
      try {
        const fs = await import('node:fs');
      
        if (!fs.existsSync(this.persistencePath!)) {
          return;
        }

        const data = fs.readFileSync(this.persistencePath!, 'utf-8');
        const state = JSON.parse(data);

        // Restore budget
        this.currentBudget = state.budget;

        // Restore reservations
        this.reservations = new Map(state.reservations);
      } catch (error) {
        console.error('[CostLedger] Failed to load from persistence:', error);
        // Don't throw - start fresh on load failure
      }
    })();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
