/**
 * Budget Ledger
 * 
 * Provides:
 * - Budget reservation with TTL (time-to-live)
 * - Commit tracking for actual costs
 * - Automatic cleanup of expired reservations
 * - Budget enforcement and alerts
 * - Persistent spend tracking to JSONL
 * - Daily/weekly/monthly spend analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface BudgetReservation {
  id: string;
  operation: string;
  reserved_usd: number;
  committed_usd: number;
  created_at: string;
  expires_at: string;
  status: 'reserved' | 'committed' | 'expired' | 'released';
  metadata?: Record<string, any>;
}

export interface SpendEntry {
  timestamp: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  operation: string;
}

export interface BudgetLedgerConfig {
  max_budget_usd: number;
  alert_threshold_usd?: number;
  default_ttl_ms?: number;
  auto_cleanup?: boolean;
}

export class BudgetLedger {
  private config: BudgetLedgerConfig;
  private reservations: Map<string, BudgetReservation>;
  private total_committed: number;
  private total_reserved: number;
  private basePath: string | null;
  private spend: SpendEntry[] = [];

  constructor(config: BudgetLedgerConfig, toolName?: string) {
    this.config = {
      default_ttl_ms: 30 * 60 * 1000, // 30 minutes
      auto_cleanup: true,
      ...config,
    };
    this.reservations = new Map();
    this.total_committed = 0;
    this.total_reserved = 0;
    this.basePath = toolName
      ? path.join(process.cwd(), `.${toolName}`, 'audit', 'spend-ledger.jsonl')
      : null;
  }

  /**
   * Initialize ledger from disk (load historical spend)
   */
  async init(): Promise<void> {
    if (!this.basePath) return;

    try {
      const dir = path.dirname(this.basePath);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.basePath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        const entry = JSON.parse(line);
        if (entry.type === 'spend' && entry.data) {
          this.spend.push(entry.data);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // First run
      }
      throw error;
    }
  }

  /**
   * Record an LLM call spend (persisted)
   */
  async recordSpend(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    operation: string
  ): Promise<void> {
    const entry: SpendEntry = {
      timestamp: new Date().toISOString(),
      model_id: modelId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      operation,
    };

    this.spend.push(entry);
    this.total_committed += costUsd;

    if (this.basePath) {
      const dir = path.dirname(this.basePath);
      await fs.mkdir(dir, { recursive: true });
      const line = JSON.stringify({ type: 'spend', data: entry }) + '\n';
      await fs.appendFile(this.basePath, line, 'utf8');
    }

    // Check alert threshold
    this.checkAlertThreshold();
  }

  /**
   * Get spend in last N days
   */
  getSpendInWindow(daysAgo: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysAgo);

    return this.spend
      .filter(s => new Date(s.timestamp) >= cutoff)
      .reduce((sum, s) => sum + s.cost_usd, 0);
  }

  /**
   * Get daily spend (last 24h)
   */
  getDailySpend(): number {
    return this.getSpendInWindow(1);
  }

  /**
   * Get weekly spend (last 7 days)
   */
  getWeeklySpend(): number {
    return this.getSpendInWindow(7);
  }

  /**
   * Get monthly spend (last 30 days)
   */
  getMonthlySpend(): number {
    return this.getSpendInWindow(30);
  }

  /**
   * Get spend breakdown by model
   */
  getSpendByModel(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const entry of this.spend) {
      if (!breakdown[entry.model_id]) {
        breakdown[entry.model_id] = 0;
      }
      breakdown[entry.model_id] += entry.cost_usd;
    }
    return breakdown;
  }

  /**
   * Reserve budget for an operation
   */
  reserve(operation: string, amount_usd: number, ttl_ms?: number): BudgetReservation {
    const id = this.generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl_ms ?? this.config.default_ttl_ms ?? 30 * 60 * 1000));

    const reservation: BudgetReservation = {
      id,
      operation,
      reserved_usd: amount_usd,
      committed_usd: 0,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'reserved',
    };

    // Check if reservation would exceed budget
    if (this.total_reserved + amount_usd > this.config.max_budget_usd) {
      throw new Error(
        `Reservation would exceed max budget. ` +
        `Current reserved: $${this.total_reserved.toFixed(4)}, ` +
        `Requested: $${amount_usd.toFixed(4)}, ` +
        `Max: $${this.config.max_budget_usd.toFixed(4)}`
      );
    }

    this.reservations.set(id, reservation);
    this.total_reserved += amount_usd;

    // Auto-cleanup expired reservations
    if (this.config.auto_cleanup) {
      this.cleanupExpired();
    }

    // Check alert threshold
    this.checkAlertThreshold();

    return reservation;
  }

  /**
   * Commit actual cost for a reservation
   */
  commit(reservationId: string, actual_cost_usd: number): BudgetReservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation is not in reserved state: ${reservation.status}`);
    }

    // Update reservation
    reservation.committed_usd = actual_cost_usd;
    reservation.status = 'committed';

    // Update totals
    this.total_reserved -= reservation.reserved_usd;
    this.total_committed += actual_cost_usd;

    this.reservations.set(reservationId, reservation);

    // Check alert threshold
    this.checkAlertThreshold();

    return reservation;
  }

  /**
   * Release a reservation (operation cancelled or not needed)
   */
  release(reservationId: string): BudgetReservation {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation is not in reserved state: ${reservation.status}`);
    }

    // Update reservation
    reservation.status = 'released';

    // Update totals
    this.total_reserved -= reservation.reserved_usd;

    this.reservations.set(reservationId, reservation);

    return reservation;
  }

  /**
   * Get reservation by ID
   */
  getReservation(reservationId: string): BudgetReservation | undefined {
    return this.reservations.get(reservationId);
  }

  /**
   * Get all reservations
   */
  getAllReservations(): BudgetReservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * Get active (reserved) reservations
   */
  getActiveReservations(): BudgetReservation[] {
    return this.getAllReservations().filter(r => r.status === 'reserved');
  }

  /**
   * Get budget status
   */
  getStatus(): {
    max_budget_usd: number;
    total_reserved: number;
    total_committed: number;
    remaining_budget: number;
    utilization_rate: number;
  } {
    return {
      max_budget_usd: this.config.max_budget_usd,
      total_reserved: this.total_reserved,
      total_committed: this.total_committed,
      remaining_budget: this.config.max_budget_usd - this.total_committed - this.total_reserved,
      utilization_rate: (this.total_committed + this.total_reserved) / this.config.max_budget_usd,
    };
  }

  /**
   * Cleanup expired reservations
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, reservation] of this.reservations.entries()) {
      if (reservation.status === 'reserved') {
        const expiresAt = new Date(reservation.expires_at);
        if (expiresAt < now) {
          reservation.status = 'expired';
          this.total_reserved -= reservation.reserved_usd;
          this.reservations.set(id, reservation);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Check if alert threshold is exceeded
   */
  private checkAlertThreshold(): boolean {
    const total = this.total_committed + this.total_reserved;
    const threshold = this.config.alert_threshold_usd ?? this.config.max_budget_usd * 0.8;
    if (total >= threshold) {
      // In a real implementation, this would trigger an alert
      console.warn(
        `[BudgetLedger] Alert threshold exceeded. ` +
        `Total: $${total.toFixed(4)}, ` +
        `Threshold: $${threshold.toFixed(4)}`
      );
      return true;
    }
    return false;
  }

  /**
   * Generate a unique reservation ID
   */
  private generateId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset the ledger (for testing)
   */
  reset(): void {
    this.reservations.clear();
    this.total_committed = 0;
    this.total_reserved = 0;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total_reservations: number;
    active_reservations: number;
    committed_reservations: number;
    expired_reservations: number;
    released_reservations: number;
    average_commit_vs_reserve_ratio: number;
  } {
    const all = this.getAllReservations();
    const active = all.filter(r => r.status === 'reserved').length;
    const committed = all.filter(r => r.status === 'committed').length;
    const expired = all.filter(r => r.status === 'expired').length;
    const released = all.filter(r => r.status === 'released').length;

    const committedWithReservations = all.filter(r => r.status === 'committed' && r.reserved_usd > 0);
    const avgRatio = committedWithReservations.length > 0
      ? committedWithReservations.reduce((sum, r) => sum + (r.committed_usd / r.reserved_usd), 0) / committedWithReservations.length
      : 0;

    return {
      total_reservations: all.length,
      active_reservations: active,
      committed_reservations: committed,
      expired_reservations: expired,
      released_reservations: released,
      average_commit_vs_reserve_ratio: avgRatio,
    };
  }
}

/**
 * Create a BudgetLedger instance
 */
export function createBudgetLedger(config: BudgetLedgerConfig): BudgetLedger {
  return new BudgetLedger(config);
}
