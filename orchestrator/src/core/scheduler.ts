/**
 * Scheduler for Orchestrator
 * Schedules workflow and pipeline executions
 */

import { logger } from './logger.js';

export interface ScheduledTask {
  id: string;
  type: 'workflow' | 'pipeline';
  targetId: string;
  scheduledFor: Date;
  priority: number;
  recurring?: {
    interval: string;
    endDate?: Date;
  };
}

export class Scheduler {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private running = false;

  schedule(task: Omit<ScheduledTask, 'id'>): string {
    const id = `schedule-${Date.now()}`;
    const fullTask: ScheduledTask = {
      ...task,
      id,
    };
    
    this.scheduledTasks.set(id, fullTask);
    logger.info('Task scheduled', { id, type: task.type, targetId: task.targetId });
    
    return id;
  }

  unschedule(taskId: string): boolean {
    const removed = this.scheduledTasks.delete(taskId);
    if (removed) {
      logger.info('Task unscheduled', { id: taskId });
    }
    return removed;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.scheduledTasks.get(taskId);
  }

  listTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  getDueTasks(): ScheduledTask[] {
    const now = new Date();
    return this.listTasks().filter(task => task.scheduledFor <= now);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    
    this.running = true;
    logger.info('Scheduler started');
    
    // In a real implementation, this would start a background process
    // to execute due tasks
  }

  async stop(): Promise<void> {
    this.running = false;
    logger.info('Scheduler stopped');
  }

  clear(): void {
    this.scheduledTasks.clear();
    logger.info('Scheduler cleared');
  }
}
