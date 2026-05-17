/**
 * NOUS schema migration framework.
 *
 * Additive-only migrations through v1.x. Each migration:
 *   - Has a version number (integer)
 *   - Has a migrate() function that transforms the graph
 *   - Is registered in the MIGRATIONS array
 *
 * When loading a graph, if its schema_version is less than the latest,
 * apply migrations sequentially.
 */
import type { MentalizationGraph } from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// Migration interface
// ════════════════════════════════════════════════════════════════════════════

export interface Migration {
  version: number;
  description: string;
  migrate(graph: MentalizationGraph): MentalizationGraph;
}

// ════════════════════════════════════════════════════════════════════════════
// Migrations (additive-only)
// ════════════════════════════════════════════════════════════════════════════

// v1 → v1.1: Add embedding field to nodes (optional, zero migration needed)
const migration_1_1: Migration = {
  version: 1,
  description: 'Add embedding field support to BeliefNode',
  migrate: (graph: MentalizationGraph): MentalizationGraph => {
    // No transformation needed — embedding is optional and defaults to undefined
    // Just bump the updated_at
    return {
      ...graph,
      updated_at: new Date().toISOString(),
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Migration registry
// ════════════════════════════════════════════════════════════════════════════

const MIGRATIONS: Migration[] = [
  migration_1_1,
  // Add future migrations here
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length > 0 
  ? MIGRATIONS[MIGRATIONS.length - 1].version 
  : 1;
// ════════════════════════════════════════════════════════════════════════════
// Migration runner
// ════════════════════════════════════════════════════════════════════════════

export class SchemaMigrator {
  /**
   * Apply pending migrations to a graph.
   * Returns the migrated graph or the original if no migrations needed.
   */
  static migrate(graph: MentalizationGraph): MentalizationGraph {
    const currentVersion = graph.schema_version;
    
    if (currentVersion >= LATEST_SCHEMA_VERSION) {
      return graph; // Already up to date
    }
    
    let migratedGraph = graph;
    
    // Apply migrations sequentially from current version to latest
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[SchemaMigrator] Applying migration v${currentVersion} → v${migration.version}: ${migration.description}`);
        migratedGraph = migration.migrate(migratedGraph);
      }
    }
    
    return migratedGraph;
  }

  /**
   * Check if a graph needs migration.
   */
  static needsMigration(graph: MentalizationGraph): boolean {
    return graph.schema_version < LATEST_SCHEMA_VERSION;
  }
}
