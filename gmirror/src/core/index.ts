/**
 * Core module exports for GMirror
 */

export type { BrainEngine, EngineConfig, QueryOptions, QueryResult, DatabaseStats, Migration } from './engine.js';
export { SQLiteEngine } from './sqlite-engine.js';
export { createEngine, createDefaultEngine } from './engine-factory.js';
export { Migrator, createMigrator } from './migrate.js';

export { RubricRegistry } from './rubric-registry.js';
export type { Rubric } from './rubric-registry.js';
export { GMIRROR_RUBRIC_V1, getRubricHash } from './gmirror-rubric.js';
export type { RubricFramework, RubricDimension } from '../types/quality-rubric.js';
export { GMirror } from './gmirror.js';
export { EvaluationRegistry } from './evaluation-registry.js';
export type { Evaluation } from './evaluation-registry.js';
export { CalibrationManager } from './calibration-manager.js';
export type { CalibrationMetrics } from './calibration-manager.js';
export { FailureAnalyzer } from './failure-analyzer.js';
export type { FailurePattern } from './failure-analyzer.js';
export { VerdictRegistry } from './verdict-registry.js';
export type { Verdict } from './verdict-registry.js';
export { GStackGBrainSync } from './gstack-gbrain-sync.js';
export type { SyncMode, SyncOptions, SyncResult, SyncStageResult, GBrainSourceAttachment } from './gstack-gbrain-sync.js';

export { defaultConfig, loadConfig, mergeConfig } from './config.js';
export type { GMirrorConfig } from './config.js';
export { generateId, hashString, sleep, retry } from './utils.js';
export { Logger, LogLevel, logger } from './logger.js';
export type { LogEntry } from './logger.js';
export {
  GMirrorError,
  DatabaseError,
  ValidationError,
  RubricError,
  EvaluationError,
  VerdictError,
} from './errors.js';
