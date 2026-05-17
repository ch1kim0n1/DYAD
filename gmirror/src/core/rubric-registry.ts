/**
 * Rubric Registry for GMirror
 * Manages quality rubrics
 */

import { logger } from './logger.js';

export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: Array<{
    id: string;
    name: string;
    weight: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class RubricRegistry {
  private rubrics: Map<string, Rubric> = new Map();

  register(rubric: Rubric): void {
    this.rubrics.set(rubric.id, rubric);
    logger.info('Rubric registered', { id: rubric.id, name: rubric.name });
  }

  unregister(rubricId: string): void {
    this.rubrics.delete(rubricId);
    logger.info('Rubric unregistered', { id: rubricId });
  }

  get(rubricId: string): Rubric | undefined {
    return this.rubrics.get(rubricId);
  }

  list(): Rubric[] {
    return Array.from(this.rubrics.values());
  }

  findByName(name: string): Rubric[] {
    return this.list().filter(r => r.name === name);
  }

  update(rubricId: string, updates: Partial<Rubric>): void {
    const rubric = this.rubrics.get(rubricId);
    if (rubric) {
      const updated = { ...rubric, ...updates, updatedAt: new Date() };
      this.rubrics.set(rubricId, updated);
      logger.info('Rubric updated', { id: rubricId });
    }
  }

  clear(): void {
    this.rubrics.clear();
    logger.info('RubricRegistry cleared');
  }

  count(): number {
    return this.rubrics.size;
  }
}
