/**
 * Pipeline Registry for Orchestrator
 * Manages available pipelines
 */

import { logger } from './logger.js';

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  workflows: string[];
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class PipelineRegistry {
  private pipelines: Map<string, Pipeline> = new Map();

  register(pipeline: Pipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
    logger.info('Pipeline registered', { id: pipeline.id, name: pipeline.name });
  }

  unregister(pipelineId: string): void {
    this.pipelines.delete(pipelineId);
    logger.info('Pipeline unregistered', { id: pipelineId });
  }

  get(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  list(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  findByName(name: string): Pipeline[] {
    return this.list().filter(p => p.name === name);
  }

  update(pipelineId: string, updates: Partial<Pipeline>): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (pipeline) {
      const updated = { ...pipeline, ...updates, updatedAt: new Date() };
      this.pipelines.set(pipelineId, updated);
      logger.info('Pipeline updated', { id: pipelineId });
    }
  }

  clear(): void {
    this.pipelines.clear();
    logger.info('PipelineRegistry cleared');
  }

  count(): number {
    return this.pipelines.size;
  }
}
