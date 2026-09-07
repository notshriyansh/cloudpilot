CREATE TABLE observation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE observed_resources (
  observation_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  relationships_json TEXT,
  PRIMARY KEY (observation_id, resource_type, resource_id),
  FOREIGN KEY (observation_id) REFERENCES observation_runs(id)
);

CREATE INDEX idx_observation_runs_completed_at
  ON observation_runs(completed_at);

CREATE INDEX idx_observed_resources_resource
  ON observed_resources(resource_type, resource_id);