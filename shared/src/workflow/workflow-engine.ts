/**
 * Workflow Engine
 * 
 * Orchestrates complex tasks with conditional logic, parallel execution, and error handling.
 */

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'task' | 'condition' | 'parallel' | 'sequence' | 'loop';
  tool?: string;
  input?: any;
  condition?: (context: any) => boolean;
  steps?: WorkflowStep[];
  onFail?: 'stop' | 'continue' | 'retry';
  retryCount?: number;
  timeout?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  context: any;
  results: Map<string, any>;
  errors: Array<{ stepId: string; error: Error }>;
  currentStep?: string;
}

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition>;
  private executions: Map<string, WorkflowExecution>;

  constructor() {
    this.workflows = new Map();
    this.executions = new Map();
  }

  /**
   * Register a workflow
   */
  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Unregister a workflow
   */
  unregister(workflowId: string): void {
    this.workflows.delete(workflowId);
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Execute a workflow
   */
  async execute(workflowId: string, initialContext: any = {}): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      startTime: new Date().toISOString(),
      context: { ...workflow.variables, ...initialContext },
      results: new Map(),
      errors: [],
    };

    this.executions.set(executionId, execution);

    try {
      execution.status = 'running';
      await this.executeSteps(workflow.steps, execution);
      execution.status = 'completed';
      execution.endTime = new Date().toISOString();
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date().toISOString();
      execution.errors.push({
        stepId: execution.currentStep || 'unknown',
        error: error as Error,
      });
    }

    return execution;
  }

  /**
   * Execute workflow steps
   */
  private async executeSteps(steps: WorkflowStep[], execution: WorkflowExecution): Promise<void> {
    for (const step of steps) {
      execution.currentStep = step.id;
      await this.executeStep(step, execution);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (step.type) {
        case 'task':
          result = await this.executeTask(step, execution);
          break;
        case 'condition':
          result = await this.executeCondition(step, execution);
          break;
        case 'parallel':
          result = await this.executeParallel(step, execution);
          break;
        case 'sequence':
          result = await this.executeSteps(step.steps || [], execution);
          break;
        case 'loop':
          result = await this.executeLoop(step, execution);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      execution.results.set(step.id, result);
    } catch (error) {
      if (step.onFail === 'retry' && step.retryCount && step.retryCount > 0) {
        step.retryCount--;
        await this.delay(1000);
        await this.executeStep(step, execution);
      } else if (step.onFail === 'continue') {
        execution.errors.push({ stepId: step.id, error: error as Error });
      } else {
        throw error;
      }
    }
  }

  /**
   * Execute a task step
   */
  private async executeTask(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    if (!step.tool) {
      throw new Error('Task step requires a tool');
    }

    // In a real implementation, this would use the tool registry
    // For now, return a mock result
    return {
      tool: step.tool,
      input: step.input,
      output: {},
    };
  }

  /**
   * Execute a condition step
   */
  private async executeCondition(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    if (!step.condition) {
      throw new Error('Condition step requires a condition function');
    }

    const result = step.condition(execution.context);
    
    if (result && step.steps) {
      await this.executeSteps(step.steps, execution);
    }

    return { conditionMet: result };
  }

  /**
   * Execute a parallel step
   */
  private async executeParallel(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    if (!step.steps || step.steps.length === 0) {
      return {};
    }

    const promises = step.steps.map(s => this.executeStep(s, execution));
    const results = await Promise.all(promises);

    return results;
  }

  /**
   * Execute a loop step
   */
  private async executeLoop(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    if (!step.steps || step.steps.length === 0) {
      return { iterations: 0 };
    }

    let iterations = 0;
    const maxIterations = step.input?.maxIterations || 10;

    while (iterations < maxIterations) {
      await this.executeSteps(step.steps, execution);
      iterations++;

      if (step.input?.condition && !step.input.condition(execution.context)) {
        break;
      }
    }

    return { iterations };
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel an execution
   */
  cancel(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date().toISOString();
    }
  }

  /**
   * List all executions for a workflow
   */
  listExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(e => e.workflowId === workflowId);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    totalWorkflows: number;
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const executions = Array.from(this.executions.values());
    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: executions.length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
    };
  }
}

/**
 * Global workflow engine instance
 */
let globalWorkflowEngine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!globalWorkflowEngine) {
    globalWorkflowEngine = new WorkflowEngine();
  }
  return globalWorkflowEngine;
}

export function resetWorkflowEngine(): void {
  globalWorkflowEngine = null;
}
