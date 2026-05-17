/**
 * Custom error classes for Orchestrator
 */

export class OrchestratorError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class DatabaseError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class WorkflowError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'WORKFLOW_ERROR');
    this.name = 'WorkflowError';
  }
}

export class PipelineError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'PIPELINE_ERROR');
    this.name = 'PipelineError';
  }
}

export class JobError extends OrchestratorError {
  constructor(message: string) {
    super(message, 'JOB_ERROR');
    this.name = 'JobError';
  }
}
