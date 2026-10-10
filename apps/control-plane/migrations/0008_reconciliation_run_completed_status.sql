UPDATE reconciliation_runs
SET status = 'completed'
WHERE status = 'succeeded';