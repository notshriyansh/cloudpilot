CREATE UNIQUE INDEX IF NOT EXISTS
  idx_one_running_reconciliation_run
ON reconciliation_runs (status)
WHERE status = 'running';