/**
 * Configuration management for Orchestrator
 */

export interface OrchestratorConfig {
  database: {
    type: 'sqlite' | 'postgres' | 'memory';
    dbPath?: string;
    connectionString?: string;
  };
  workflows: {
    enabled: boolean;
    workflowPath: string;
  };
  pipelines: {
    enabled: boolean;
  };
  tools: {
    gbrainEndpoint: string;
    glearnEndpoint: string;
    gagentEndpoint: string;
    gmirrorEndpoint: string;
    gtomEndpoint: string;
  };
  server: {
    port: number;
    host: string;
  };
}

export const defaultConfig: OrchestratorConfig = {
  database: {
    type: 'sqlite',
    dbPath: './orchestrator.db',
  },
  workflows: {
    enabled: true,
    workflowPath: './workflows',
  },
  pipelines: {
    enabled: true,
  },
  tools: {
    gbrainEndpoint: 'http://localhost:8080',
    glearnEndpoint: 'http://localhost:8080',
    gagentEndpoint: 'http://localhost:8081',
    gmirrorEndpoint: 'http://localhost:8082',
    gtomEndpoint: 'http://localhost:8083',
  },
  server: {
    port: 8084,
    host: 'localhost',
  },
};

export function loadConfig(configPath?: string): OrchestratorConfig {
  return defaultConfig;
}

export function mergeConfig(base: OrchestratorConfig, override: Partial<OrchestratorConfig>): OrchestratorConfig {
  return {
    ...base,
    ...override,
    database: { ...base.database, ...override.database },
    workflows: { ...base.workflows, ...override.workflows },
    pipelines: { ...base.pipelines, ...override.pipelines },
    tools: { ...base.tools, ...override.tools },
    server: { ...base.server, ...override.server },
  };
}
