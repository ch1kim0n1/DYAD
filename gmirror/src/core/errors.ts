/**
 * Custom error classes for GMirror
 */

export class GMirrorError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'GMirrorError';
  }
}

export class DatabaseError extends GMirrorError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class RubricError extends GMirrorError {
  constructor(message: string) {
    super(message, 'RUBRIC_ERROR');
    this.name = 'RubricError';
  }
}

export class EvaluationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'EVALUATION_ERROR');
    this.name = 'EvaluationError';
  }
}

export class VerdictError extends GMirrorError {
  constructor(message: string) {
    super(message, 'VERDICT_ERROR');
    this.name = 'VerdictError';
  }
}

export class BudgetExceededError extends GMirrorError {
  constructor(message: string) {
    super(message, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
  }
}
