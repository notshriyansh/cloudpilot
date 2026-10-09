
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_started_at
  ON reconciliation_runs(started_at DESC);
