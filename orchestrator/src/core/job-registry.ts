/**
 * Job Registry for Orchestrator
 * Manages job execution
 */

import { logger } from './logger.js';

export interface Job {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt: Date | null;
  result: unknown;
  error: string | null;
}

export class JobRegistry {
  private jobs: Map<string, Job> = new Map();

  register(job: Job): void {
    this.jobs.set(job.id, job);
    logger.info('Job registered', { id: job.id, pipelineId: job.pipelineId });
  }

  unregister(jobId: string): void {
    this.jobs.delete(jobId);
    logger.info('Job unregistered', { id: jobId });
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  list(): Job[] {
    return Array.from(this.jobs.values());
  }

  findByPipeline(pipelineId: string): Job[] {
    return this.list().filter(j => j.pipelineId === pipelineId);
  }

  findByStatus(status: string): Job[] {
    return this.list().filter(j => j.status === status);
  }

  update(jobId: string, updates: Partial<Job>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      const updated = { ...job, ...updates };
      this.jobs.set(jobId, updated);
      logger.info('Job updated', { id: jobId });
    }
  }

  clear(): void {
    this.jobs.clear();
    logger.info('JobRegistry cleared');
  }

  count(): number {
    return this.jobs.size;
  }

  getRunningCount(): number {
    return this.list().filter(j => j.status === 'running').length;
  }

  getCompletedCount(): number {
    return this.list().filter(j => j.status === 'completed').length;
  }
}
