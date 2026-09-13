CREATE TABLE managed_resources (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (resource_type, resource_id)
);