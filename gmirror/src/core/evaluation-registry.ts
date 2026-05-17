/**
 * Evaluation Registry for GMirror
 * Manages quality evaluations
 */

import { logger } from './logger.js';

export interface Evaluation {
  id: string;
  rubricId: string;
  target: string;
  scores: Record<string, number>;
  overallScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EvaluationRegistry {
  private evaluations: Map<string, Evaluation> = new Map();

  register(evaluation: Evaluation): void {
    this.evaluations.set(evaluation.id, evaluation);
    logger.info('Evaluation registered', { id: evaluation.id, target: evaluation.target });
  }

  unregister(evaluationId: string): void {
    this.evaluations.delete(evaluationId);
    logger.info('Evaluation unregistered', { id: evaluationId });
  }

  get(evaluationId: string): Evaluation | undefined {
    return this.evaluations.get(evaluationId);
  }

  list(): Evaluation[] {
    return Array.from(this.evaluations.values());
  }

  findByRubric(rubricId: string): Evaluation[] {
    return this.list().filter(e => e.rubricId === rubricId);
  }

  findByTarget(target: string): Evaluation[] {
    return this.list().filter(e => e.target === target);
  }

  update(evaluationId: string, updates: Partial<Evaluation>): void {
    const evaluation = this.evaluations.get(evaluationId);
    if (evaluation) {
      const updated = { ...evaluation, ...updates, updatedAt: new Date() };
      this.evaluations.set(evaluationId, updated);
      logger.info('Evaluation updated', { id: evaluationId });
    }
  }

  clear(): void {
    this.evaluations.clear();
    logger.info('EvaluationRegistry cleared');
  }

  count(): number {
    return this.evaluations.size;
  }
}
