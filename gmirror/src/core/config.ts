/**
 * Configuration management for GMirror
 */

export interface GMirrorConfig {
  database: {
    type: 'sqlite' | 'postgres' | 'memory';
    dbPath?: string;
    connectionString?: string;
  };
  rubrics: {
    enabled: boolean;
    rubricPath: string;
  };
  evaluation: {
    enabled: boolean;
  };
  server: {
    port: number;
    host: string;
  };
}

export const defaultConfig: GMirrorConfig = {
  database: {
    type: 'sqlite',
    dbPath: './gmirror.db',
  },
  rubrics: {
    enabled: true,
    rubricPath: './rubrics',
  },
  evaluation: {
    enabled: true,
  },
  server: {
    port: 8082,
    host: 'localhost',
  },
};

export function loadConfig(configPath?: string): GMirrorConfig {
  return defaultConfig;
}

export function mergeConfig(base: GMirrorConfig, override: Partial<GMirrorConfig>): GMirrorConfig {
  return {
    ...base,
    ...override,
    database: { ...base.database, ...override.database },
    rubrics: { ...base.rubrics, ...override.rubrics },
    evaluation: { ...base.evaluation, ...override.evaluation },
    server: { ...base.server, ...override.server },
  };
}
