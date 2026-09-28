CREATE TABLE IF NOT EXISTS execution_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  summary_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_execution_runs_started_at
  ON execution_runs(started_at DESC);