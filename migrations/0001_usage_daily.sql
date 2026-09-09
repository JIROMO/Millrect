CREATE TABLE IF NOT EXISTS usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_date TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  project_count INTEGER NOT NULL CHECK (project_count >= 0),
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (observed_date, ip_address, user_agent)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_observed_date
  ON usage_daily (observed_date);

CREATE INDEX IF NOT EXISTS idx_usage_daily_last_seen_at
  ON usage_daily (last_seen_at);
