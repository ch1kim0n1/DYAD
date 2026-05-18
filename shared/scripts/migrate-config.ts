#!/usr/bin/env node
/**
 * Configuration Migration Script
 * 
 * Migrates configuration files between versions.
 * Usage: node migrate-config.ts --from <version> --to <version> [--config <path>]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface Migration {
  from: string;
  to: string;
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;
}

const migrations: Migration[] = [
  {
    from: '0.1.0',
    to: '0.2.0',
    migrate: (config) => {
      // Migration from 0.1.0 to 0.2.0
      // Add new fields with defaults
      const migrated = { ...config };
      
      // Add logging configuration if not present
      if (!migrated.log_level) {
        migrated.log_level = 'INFO';
      }
      if (!migrated.log_format) {
        migrated.log_format = 'json';
      }
      
      // Add timeout configurations
      if (!migrated.gbrain_timeout_ms) {
        migrated.gbrain_timeout_ms = 30000;
      }
      if (!migrated.sandbox_timeout_ms) {
        migrated.sandbox_timeout_ms = 120000;
      }
      
      return migrated;
    },
  },
  {
    from: '0.2.0',
    to: '0.3.0',
    migrate: (config) => {
      // Migration from 0.2.0 to 0.3.0
      const migrated = { ...config };
      
      // Add security configuration
      if (!migrated.secret_backend) {
        migrated.secret_backend = 'env';
      }
      
      // Add NODE_ENV if not present
      if (!migrated.NODE_ENV) {
        migrated.NODE_ENV = 'development';
      }
      
      return migrated;
    },
  },
  {
    from: '0.3.0',
    to: '0.4.0',
    migrate: (config) => {
      // Migration from 0.3.0 to 0.4.0
      const migrated = { ...config };
      
      // Add tool-specific configurations
      if (!migrated.SANDBOX_BACKEND) {
        migrated.SANDBOX_BACKEND = 'docker';
      }
      if (!migrated.SANDBOX_MAX_CONCURRENCY) {
        migrated.SANDBOX_MAX_CONCURRENCY = 5;
      }
      
      return migrated;
    },
  },
  {
    from: '0.4.0',
    to: '0.5.0',
    migrate: (config) => {
      // Migration from 0.4.0 to 0.5.0
      const migrated = { ...config };
      
      // Add audit and secret directory configurations
      const toolName = process.env.TOOL_NAME || 'gorchestrator';
      const toolPrefix = toolName.toUpperCase();
      
      if (!migrated[`${toolPrefix}_AUDIT_DIR`]) {
        migrated[`${toolPrefix}_AUDIT_DIR`] = `~/.${toolName}/audit`;
      }
      if (!migrated[`${toolPrefix}_SECRET_DIR`]) {
        migrated[`${toolPrefix}_SECRET_DIR`] = `~/.${toolName}/secrets`;
      }
      
      return migrated;
    },
  },
];

async function findMigrationPath(from: string, to: string): Migration[] {
  const path: Migration[] = [];
  let currentVersion = from;
  
  while (currentVersion !== to) {
    const migration = migrations.find(m => m.from === currentVersion);
    if (!migration) {
      throw new Error(`No migration found from version ${currentVersion}`);
    }
    path.push(migration);
    currentVersion = migration.to;
  }
  
  return path;
}

async function loadConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function saveConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function getCurrentVersion(config: Record<string, unknown>): string {
  return (config._version as string) || '0.1.0';
}

async function main() {
  const args = process.argv.slice(2);
  const fromArg = args.indexOf('--from');
  const toArg = args.indexOf('--to');
  const configArg = args.indexOf('--config');
  
  const from = fromArg !== -1 ? args[fromArg + 1] : '0.1.0';
  const to = toArg !== -1 ? args[toArg + 1] : '0.5.0';
  const configPath = configArg !== -1 ? args[configArg + 1] : path.join(process.cwd(), '.gstack', 'config.json');
  
  console.log(`Migrating configuration from ${from} to ${to}...`);
  
  // Load current configuration
  const config = await loadConfig(configPath);
  const currentVersion = getCurrentVersion(config);
  
  console.log(`Current configuration version: ${currentVersion}`);
  
  if (currentVersion === to) {
    console.log('Configuration is already at target version');
    return;
  }
  
  // Find migration path
  const migrationPath = await findMigrationPath(currentVersion, to);
  
  console.log(`Migration path: ${migrationPath.map(m => `${m.from} -> ${m.to}`).join(', ')}`);
  
  // Apply migrations
  let migratedConfig = { ...config };
  for (const migration of migrationPath) {
    console.log(`Applying migration: ${migration.from} -> ${migration.to}`);
    migratedConfig = migration.migrate(migratedConfig);
  }
  
  // Update version
  migratedConfig._version = to;
  
  // Save migrated configuration
  await saveConfig(configPath, migratedConfig);
  
  console.log(`Configuration migrated successfully to version ${to}`);
  console.log(`Configuration saved to: ${configPath}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { migrations, findMigrationPath, loadConfig, saveConfig };
