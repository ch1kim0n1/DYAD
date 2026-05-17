/**
 * Verdict Registry for GMirror
 * Manages evaluation verdicts
 */

import { logger } from './logger.js';

export interface Verdict {
  id: string;
  evaluationId: string;
  approved: boolean;
  notes: string;
  reviewer?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class VerdictRegistry {
  private verdicts: Map<string, Verdict> = new Map();

  register(verdict: Verdict): void {
    this.verdicts.set(verdict.id, verdict);
    logger.info('Verdict registered', { id: verdict.id, approved: verdict.approved });
  }

  unregister(verdictId: string): void {
    this.verdicts.delete(verdictId);
    logger.info('Verdict unregistered', { id: verdictId });
  }

  get(verdictId: string): Verdict | undefined {
    return this.verdicts.get(verdictId);
  }

  list(): Verdict[] {
    return Array.from(this.verdicts.values());
  }

  findByEvaluation(evaluationId: string): Verdict[] {
    return this.list().filter(v => v.evaluationId === evaluationId);
  }

  update(verdictId: string, updates: Partial<Verdict>): void {
    const verdict = this.verdicts.get(verdictId);
    if (verdict) {
      const updated = { ...verdict, ...updates, updatedAt: new Date() };
      this.verdicts.set(verdictId, updated);
      logger.info('Verdict updated', { id: verdictId });
    }
  }

  clear(): void {
    this.verdicts.clear();
    logger.info('VerdictRegistry cleared');
  }

  count(): number {
    return this.verdicts.size;
  }

  getApprovalRate(): number {
    const verdicts = this.list();
    if (verdicts.length === 0) return 0;
    const approved = verdicts.filter(v => v.approved).length;
    return approved / verdicts.length;
  }
}
