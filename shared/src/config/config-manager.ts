/**
 * Centralized Configuration Manager
 * 
 * Provides unified configuration management across all g-stack tools.
 * Supports environment variables, config files, and runtime overrides.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

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
      const content = await fs.readFile(this.configPath, 'utf8');
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
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
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
