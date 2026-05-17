/**
 * Workflow Executor for Orchestrator
 * Executes workflows across multiple tools
 */

import { logger } from './logger.js';
import { ToolClient } from './tool-client.js';
import { Workflow } from './workflow-registry.js';

export interface ExecutionStatus {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  results: Map<string, unknown>;
  errors: string[];
}

export class WorkflowExecutor {
  private toolClient: ToolClient;
  private activeExecutions: Map<string, ExecutionStatus> = new Map();

  constructor(toolClient: ToolClient) {
    this.toolClient = toolClient;
    logger.info('WorkflowExecutor initialized');
  }

  async execute(workflow: Workflow, input: unknown): Promise<ExecutionStatus> {
    logger.info('Executing workflow', { id: workflow.id, name: workflow.name });
    
    const status: ExecutionStatus = {
      workflowId: workflow.id,
      status: 'running',
      currentStep: 0,
      totalSteps: workflow.steps.length,
      results: new Map(),
      errors: [],
    };
    
    this.activeExecutions.set(workflow.id, status);
    
    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        status.currentStep = i + 1;
        
        logger.info('Executing workflow step', { step: step.name, tool: step.tool });
        
        const result = await this.toolClient.callTool(step.tool, 'execute', {
          ...step.config,
          input,
        });
        
        status.results.set(step.id, result);
      }
      
      status.status = 'completed';
      logger.info('Workflow completed', { id: workflow.id });
    } catch (error) {
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      logger.error('Workflow failed', { id: workflow.id, error });
    }
    
    return status;
  }

  getStatus(workflowId: string): ExecutionStatus | undefined {
    return this.activeExecutions.get(workflowId);
  }

  cancel(workflowId: string): boolean {
    const status = this.activeExecutions.get(workflowId);
    if (status && status.status === 'running') {
      status.status = 'failed';
      status.errors.push('Workflow cancelled');
      logger.info('Workflow cancelled', { id: workflowId });
      return true;
    }
    return false;
  }

  clearCompleted(): void {
    for (const [id, status] of this.activeExecutions.entries()) {
      if (status.status === 'completed' || status.status === 'failed') {
        this.activeExecutions.delete(id);
      }
    }
    logger.info('Cleared completed executions');
  }
}
