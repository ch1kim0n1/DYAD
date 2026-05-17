CREATE TABLE IF NOT EXISTS frustration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  frustration REAL NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_records (
  run_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  synthetic_user_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  frustration REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_frustration_history_run ON frustration_history(run_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_frustration_history_timestamp ON frustration_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_run_records_timestamp ON run_records(timestamp);
