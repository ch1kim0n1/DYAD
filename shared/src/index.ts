/**
 * @gstack/shared
 * 
 * Shared utilities and core modules for the G-Stack.
 * 
 * This package provides common functionality used across all G-Tools:
 * - Budget tracking and cost management
 * - Structured logging
 * - Security utilities (PII redaction, rate limiting)
 * - Performance optimization (caching, batching)
 * - Persistence and database management
 * - LLM client abstractions
 * - Health checking
 * - Workflow orchestration primitives
 * 
 * Usage:
 * import { BudgetLedger } from '@gstack/shared/core';
 * import { PiiRedactor } from '@gstack/shared/security';
 * import { CostCalculator } from '@gstack/shared/cost/cost-calculator';
 * import { TokenAuthenticator } from '@gstack/shared/security/auth';
 */

// Core exports (most commonly used, no conflicts)
export * from './core';
export * from './cost';
export * from './security';
export * from './performance';
export * from './persistence';
export * from './llm';
export * from './health';
export * from './config';
export * from './observability';
export * from './tools';
export * from './workflow';

// Re-export specific types that have conflicts with explicit paths
export type { ModelPricing } from './cost/cost-calculator';
export type { TokenInfo, AuthResult } from './security/auth';
