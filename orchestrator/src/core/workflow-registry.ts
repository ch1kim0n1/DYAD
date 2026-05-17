/**
 * Workflow Registry for Orchestrator
 * Manages available workflows
 */

import { logger } from './logger.js';

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowRegistry {
  private workflows: Map<string, Workflow> = new Map();

  register(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    logger.info('Workflow registered', { id: workflow.id, name: workflow.name });
  }

  unregister(workflowId: string): void {
    this.workflows.delete(workflowId);
    logger.info('Workflow unregistered', { id: workflowId });
  }

  get(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  list(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  findByName(name: string): Workflow[] {
    return this.list().filter(w => w.name === name);
  }

  update(workflowId: string, updates: Partial<Workflow>): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      const updated = { ...workflow, ...updates, updatedAt: new Date() };
      this.workflows.set(workflowId, updated);
      logger.info('Workflow updated', { id: workflowId });
    }
  }

  clear(): void {
    this.workflows.clear();
    logger.info('WorkflowRegistry cleared');
  }

  count(): number {
    return this.workflows.size;
  }
}
