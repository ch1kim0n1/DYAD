import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createEngine } from '../src/core/engine-factory';
import { PostgreSQLEngine } from '../src/core/postgres-engine';
import { VerdictPersistenceManager } from '../src/core/verdict-persistence';

describe('GMirror persistence parity', () => {
  it('requires SQLite, runs migrations, exports JSON, and restores backups', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmirror-persistence-'));
    const dbPath = path.join(dir, 'verdict.db');
    const manager = new VerdictPersistenceManager(dbPath);

    manager.transaction(() => {
      manager.addFrustrationData({
        run_id: 'run-1',
        request_id: 'request-1',
        scenario_id: 'scenario-1',
        frustration: 0.42,
      });
      manager.addRunRecord({
        run_id: 'run-1',
        request_id: 'request-1',
        synthetic_user_id: 'user-1',
        scenario_id: 'scenario-1',
        outcome: 'completed',
        frustration: 0.42,
        duration_ms: 120,
        cost_usd: 0.01,
      });
    });

    const backupPath = manager.backup(path.join(dir, 'backup.db'));
    const exported = manager.exportJson();
    expect(exported.schema_version).toBe(2);
    expect(exported.frustration_history).toHaveLength(1);
    expect(exported.run_records).toHaveLength(1);
    manager.close();

    const restored = new VerdictPersistenceManager(path.join(dir, 'restored.db'));
    restored.restore(backupPath);
    expect(restored.getFrustrationHistory('scenario-1')).toEqual([0.42]);
    expect(restored.getRunRecords('scenario-1')[0].run_id).toBe('run-1');
    restored.close();
  });

  it('wires the Postgres adapter and read-replica configuration through the engine factory', () => {
    const engine = createEngine({
      type: 'postgres',
      connectionString: 'postgresql://writer/gmirror',
      readConnectionString: 'postgresql://reader/gmirror',
    });
    expect(engine).toBeInstanceOf(PostgreSQLEngine);
  });
});
