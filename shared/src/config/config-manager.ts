/**
 * Centralized Configuration Manager
 * 
 * Provides unified configuration management across all g-stack tools.
 * Supports environment variables, config files, and runtime overrides.
 * Uses Zod for schema validation and type safety.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

// Zod schemas for configuration validation
export const CommonConfigSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Logging
  log_level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  log_format: z.enum(['json', 'text']).default('json'),
  
  // API
  API_PORT: z.coerce.number().min(1).max(65535).optional(),
  API_HOST: z.string().optional(),
  
  // Timeouts
  gbrain_timeout_ms: z.coerce.number().min(100).max(300000).optional(),
  sandbox_timeout_ms: z.coerce.number().min(1000).max(600000).optional(),
  
  // Security
  secret_backend: z.enum(['env', 'file', 'keyring']).default('env'),
});

export const GOrchestratorConfigSchema = CommonConfigSchema.extend({
  TOOL_NAME: z.literal('gorchestrator'),
  SANDBOX_BACKEND: z.enum(['docker', 'e2b', 'modal', 'daytona', 'firecracker', 'inprocess']).default('docker'),
  SANDBOX_MAX_CONCURRENCY: z.coerce.number().min(1).max(50).default(5),
  MOCK_SANDBOX: z.coerce.boolean().default(false),
  GORCHESTRATOR_MCP_TOKEN: z.string().optional(),
  GORCHESTRATOR_SECRET_DIR: z.string().default('~/.gorchestrator/secrets'),
  GORCHESTRATOR_AUDIT_DIR: z.string().default('~/.gorchestrator/audit'),
});

export const GAgentConfigSchema = CommonConfigSchema.extend({
  TOOL_NAME: z.literal('gagent'),
  PIPELINE_MAX_PARALLEL: z.coerce.number().min(1).max(20).default(3),
  GAGENT_MCP_TOKEN: z.string().optional(),
  GAGENT_SECRET_DIR: z.string().default('~/.gagent/secrets'),
  GAGENT_AUDIT_DIR: z.string().default('~/.gagent/audit'),
});

export const GLearnConfigSchema = CommonConfigSchema.extend({
  TOOL_NAME: z.literal('glearn'),
  LEARNING_ENABLED: z.coerce.boolean().default(true),
  GLEARN_MCP_TOKEN: z.string().optional(),
  GLEARN_SECRET_DIR: z.string().default('~/.glearn/secrets'),
  GLEARN_AUDIT_DIR: z.string().default('~/.glearn/audit'),
});

export const GMirrorConfigSchema = CommonConfigSchema.extend({
  TOOL_NAME: z.literal('gmirror'),
  EVALUATION_MODE: z.enum(['strict', 'lenient', 'balanced']).default('balanced'),
  GMIRROR_MCP_TOKEN: z.string().optional(),
  GMIRROR_SECRET_DIR: z.string().default('~/.gmirror/secrets'),
  GMIRROR_AUDIT_DIR: z.string().default('~/.gmirror/audit'),
});

export type GOrchestratorConfig = z.infer<typeof GOrchestratorConfigSchema>;
export type GAgentConfig = z.infer<typeof GAgentConfigSchema>;
export type GLearnConfig = z.infer<typeof GLearnConfigSchema>;
export type GMirrorConfig = z.infer<typeof GMirrorConfigSchema>;

export interface ConfigSchema {
  // LLM Configuration
  anthropic_api_key?: string;
  openai_api_key?: string;
  default_model?: string;
  max_tokens?: number;
  temperature?: number;
  
  // GBrain Configuration
  gbrain_endpoint?: string;
  gbrain_timeout_ms?: number;
  
  // Cost Configuration
  budget_usd?: number;
  cost_tracking_enabled?: boolean;
  
  // Logging Configuration
  log_level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  log_format?: 'json' | 'text';
  
  // Persistence Configuration
  sqlite_path?: string;
  persistence_enabled?: boolean;
  
  // Security Configuration
  secret_backend?: 'env' | 'file' | 'keyring';
  secret_file_path?: string;
  
  // Sandbox Configuration
  docker_host?: string;
  sandbox_timeout_ms?: number;
}

export interface ConfigValidationRule {
  key: keyof ConfigSchema;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
}

export class ConfigManager {
  private config: ConfigSchema;
  private configPath: string;
  private validationRules: ConfigValidationRule[];
  private watchers: fs.FSWatcher | null = null;
  private onReloadCallbacks: Array<(config: ConfigSchema) => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.gstack', 'config.json');
    this.config = {};
    this.validationRules = this.getDefaultValidationRules();
  }

  /**
   * Get default validation rules
   */
  private getDefaultValidationRules(): ConfigValidationRule[] {
    return [
      { key: 'anthropic_api_key', type: 'string' },
      { key: 'openai_api_key', type: 'string' },
      { key: 'default_model', type: 'string', enum: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'gpt-4o', 'gpt-4o-mini'] },
      { key: 'max_tokens', type: 'number', min: 1, max: 100000 },
      { key: 'temperature', type: 'number', min: 0, max: 2 },
      { key: 'gbrain_endpoint', type: 'string', pattern: /^https?:\/\/.+/ },
      { key: 'gbrain_timeout_ms', type: 'number', min: 100, max: 300000 },
      { key: 'budget_usd', type: 'number', min: 0.01 },
      { key: 'cost_tracking_enabled', type: 'boolean' },
      { key: 'log_level', type: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] },
      { key: 'log_format', type: 'string', enum: ['json', 'text'] },
      { key: 'sqlite_path', type: 'string' },
      { key: 'persistence_enabled', type: 'boolean' },
      { key: 'secret_backend', type: 'string', enum: ['env', 'file', 'keyring'] },
      { key: 'docker_host', type: 'string' },
      { key: 'sandbox_timeout_ms', type: 'number', min: 1000, max: 600000 },
    ];
  }

  /**
   * Load configuration from file and environment variables
   */
  async load(): Promise<void> {
    // Load from file
    await this.loadFromFile();
    
    // Override with environment variables
    this.loadFromEnv();
    
    // Validate configuration
    this.validate();
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<void> {
    try {
      const content = await fsp.readFile(this.configPath, 'utf8');
      const fileConfig = JSON.parse(content) as Partial<ConfigSchema>;
      this.config = { ...this.config, ...fileConfig };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to load config from ${this.configPath}:`, error);
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): void {
    const envMapping: Record<keyof ConfigSchema, string> = {
      anthropic_api_key: 'ANTHROPIC_API_KEY',
      openai_api_key: 'OPENAI_API_KEY',
      default_model: 'GSTACK_DEFAULT_MODEL',
      max_tokens: 'GSTACK_MAX_TOKENS',
      temperature: 'GSTACK_TEMPERATURE',
      gbrain_endpoint: 'GBRAIN_ENDPOINT',
      gbrain_timeout_ms: 'GBRAIN_TIMEOUT_MS',
      budget_usd: 'GSTACK_BUDGET_USD',
      cost_tracking_enabled: 'GSTACK_COST_TRACKING',
      log_level: 'GSTACK_LOG_LEVEL',
      log_format: 'GSTACK_LOG_FORMAT',
      sqlite_path: 'GSTACK_SQLITE_PATH',
      persistence_enabled: 'GSTACK_PERSISTENCE',
      secret_backend: 'GSTACK_SECRET_BACKEND',
      secret_file_path: 'GSTACK_SECRET_FILE',
      docker_host: 'GSTACK_DOCKER_HOST',
      sandbox_timeout_ms: 'GSTACK_SANDBOX_TIMEOUT_MS',
    };

    for (const [configKey, envKey] of Object.entries(envMapping)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.config as any)[configKey] = this.parseEnvValue(envValue);
      }
    }
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): string | number | boolean {
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Try to parse as number
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
    
    // Return as string
    return value;
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    const errors: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.config[rule.key];

      // Check required
      if (rule.required && value === undefined) {
        errors.push(`Required config key missing: ${rule.key}`);
        continue;
      }

      if (value === undefined) continue;

      // Check type
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`Config key ${rule.key} must be a number`);
      }
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`Config key ${rule.key} must be a string`);
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Config key ${rule.key} must be a boolean`);
      }

      // Check min/max for numbers
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Config key ${rule.key} must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Config key ${rule.key} must be <= ${rule.max}`);
        }
      }

      // Check pattern for strings
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(`Config key ${rule.key} does not match required pattern`);
      }

      // Check enum
      if (rule.enum && typeof value === 'string' && !rule.enum.includes(value)) {
        errors.push(`Config key ${rule.key} must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get a configuration value
   */
  get<T extends keyof ConfigSchema>(key: T): ConfigSchema[T] {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): ConfigSchema {
    return { ...this.config };
  }

  /**
   * Set a configuration value
   */
  set<T extends keyof ConfigSchema>(key: T, value: ConfigSchema[T]): void {
    this.config[key] = value;
  }

  /**
   * Save configuration to file
   */
  async save(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = {};
  }

  /**
   * Add a custom validation rule
   */
  addValidationRule(rule: ConfigValidationRule): void {
    this.validationRules.push(rule);
  }

  /**
   * Get configuration as environment variable mappings
   */
  getEnvVars(): Record<string, string> {
    const envMapping: Record<keyof ConfigSchema, string> = {
      anthropic_api_key: 'ANTHROPIC_API_KEY',
      openai_api_key: 'OPENAI_API_KEY',
      default_model: 'GSTACK_DEFAULT_MODEL',
      max_tokens: 'GSTACK_MAX_TOKENS',
      temperature: 'GSTACK_TEMPERATURE',
      gbrain_endpoint: 'GBRAIN_ENDPOINT',
      gbrain_timeout_ms: 'GBRAIN_TIMEOUT_MS',
      budget_usd: 'GSTACK_BUDGET_USD',
      cost_tracking_enabled: 'GSTACK_COST_TRACKING',
      log_level: 'GSTACK_LOG_LEVEL',
      log_format: 'GSTACK_LOG_FORMAT',
      sqlite_path: 'GSTACK_SQLITE_PATH',
      persistence_enabled: 'GSTACK_PERSISTENCE',
      secret_backend: 'GSTACK_SECRET_BACKEND',
      secret_file_path: 'GSTACK_SECRET_FILE',
      docker_host: 'GSTACK_DOCKER_HOST',
      sandbox_timeout_ms: 'GSTACK_SANDBOX_TIMEOUT_MS',
    };

    const envVars: Record<string, string> = {};
    for (const [configKey, envKey] of Object.entries(envMapping)) {
      const value = this.config[configKey as keyof ConfigSchema];
      if (value !== undefined) {
        envVars[envKey] = String(value);
      }
    }
    return envVars;
  }

  /**
   * Validate configuration on startup
   * Returns validation result with errors if any
   */
  validateStartup(toolName?: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Re-run validation
    try {
      this.validate();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }

    // Check for required secrets in production
    if (nodeEnv === 'production') {
      const config = this.config as any;
      if (toolName === 'gorchestrator' && !config.GORCHESTRATOR_MCP_TOKEN) {
        errors.push('GORCHESTRATOR_MCP_TOKEN is required in production');
      }
      if (toolName === 'gagent' && !config.GAGENT_MCP_TOKEN) {
        errors.push('GAGENT_MCP_TOKEN is required in production');
      }
      if (toolName === 'glearn' && !config.GLEARN_MCP_TOKEN) {
        errors.push('GLEARN_MCP_TOKEN is required in production');
      }
      if (toolName === 'gmirror' && !config.GMIRROR_MCP_TOKEN) {
        errors.push('GMIRROR_MCP_TOKEN is required in production');
      }
    }

    // Warn about missing optional but recommended configs
    if (!this.config.anthropic_api_key && !this.config.openai_api_key) {
      warnings.push('No LLM API keys configured. LLM features will not work.');
    }

    if (this.config.cost_tracking_enabled && !this.config.budget_usd) {
      warnings.push('Cost tracking enabled but no budget set. Set GSTACK_BUDGET_USD.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export configuration for debugging (with secrets redacted)
   */
  exportSafe(): Record<string, unknown> {
    const config = { ...this.config };
    const secretKeys = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'api_key'];
    
    for (const key in config) {
      if (secretKeys.some(secret => key.toLowerCase().includes(secret.toLowerCase()))) {
        (config as any)[key] = '[REDACTED]';
      }
    }

    return config;
  }

  /**
   * Enable hot-reload of configuration file
   */
  enableHotReload(): void {
    if (this.watchers) {
      return; // Already watching
    }

    try {
      this.watchers = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            await this.load();
            for (const callback of this.onReloadCallbacks) {
              callback(this.config);
            }
          } catch (error) {
            console.error('Failed to reload configuration:', error);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to enable hot-reload:', error);
    }
  }

  /**
   * Disable hot-reload of configuration file
   */
  disableHotReload(): void {
    if (this.watchers) {
      this.watchers.close();
      this.watchers = null;
    }
  }

  /**
   * Register a callback to be called when configuration is reloaded
   */
  onReload(callback: (config: ConfigSchema) => void): void {
    this.onReloadCallbacks.push(callback);
  }

  /**
   * Reload configuration from file and environment variables
   */
  async reload(): Promise<void> {
    await this.load();
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigManager | null = null;

export function getConfigManager(configPath?: string): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(configPath);
  }
  return globalConfigManager;
}

export function resetConfigManager(): void {
  globalConfigManager = null;
}
