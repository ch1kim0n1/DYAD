/**
 * Custom error classes for GMirror
 */

export type ErrorSeverity = 'recoverable' | 'fatal' | 'transient';

export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  requestId?: string;
  timestamp: string;
}

export class GMirrorError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500,
    public severity: ErrorSeverity = 'fatal'
  ) {
    super(message);
    this.name = 'GMirrorError';
  }

  toJSON(): ErrorResponse {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      timestamp: new Date().toISOString(),
    };
  }
}

export class ValidationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, 'recoverable');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, 'recoverable');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, 'fatal');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends GMirrorError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404, 'recoverable');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends GMirrorError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409, 'recoverable');
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends GMirrorError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500, 'fatal');
    this.name = 'DatabaseError';
  }
}

export class RubricError extends GMirrorError {
  constructor(message: string) {
    super(message, 'RUBRIC_ERROR', 500, 'fatal');
    this.name = 'RubricError';
  }
}

export class EvaluationError extends GMirrorError {
  constructor(message: string) {
    super(message, 'EVALUATION_ERROR', 500, 'fatal');
    this.name = 'EvaluationError';
  }
}

export class VerdictError extends GMirrorError {
  constructor(message: string) {
    super(message, 'VERDICT_ERROR', 500, 'fatal');
    this.name = 'VerdictError';
  }
}

export class BudgetExceededError extends GMirrorError {
  constructor(message: string) {
    super(message, 'BUDGET_EXCEEDED', 429, 'fatal');
    this.name = 'BudgetExceededError';
  }
}

export class RateLimitError extends GMirrorError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT', 429, 'transient');
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends GMirrorError {
  constructor(message: string) {
    super(message, 'TIMEOUT', 504, 'transient');
    this.name = 'TimeoutError';
  }
}
