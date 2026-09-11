CREATE TABLE usage_daily_by_ip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL UNIQUE,
  user_agent TEXT NOT NULL,
  project_count INTEGER NOT NULL CHECK (project_count >= 0),
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

-- Preserve the most recent values for each IP while consolidating counters and
-- the original first-seen time from any rows written by the previous schema.
INSERT INTO usage_daily_by_ip (
  ip_address,
  user_agent,
  project_count,
  visit_count,
  first_seen_at,
  last_seen_at
)
SELECT
  latest.ip_address,
  latest.user_agent,
  latest.project_count,
  totals.visit_count,
  totals.first_seen_at,
  latest.last_seen_at
FROM usage_daily AS latest
JOIN (
  SELECT
    ip_address,
    SUM(visit_count) AS visit_count,
    MIN(first_seen_at) AS first_seen_at,
    MAX(last_seen_at) AS last_seen_at
  FROM usage_daily
  GROUP BY ip_address
) AS totals
  ON totals.ip_address = latest.ip_address
 AND totals.last_seen_at = latest.last_seen_at
WHERE latest.id = (
  SELECT candidate.id
  FROM usage_daily AS candidate
  WHERE candidate.ip_address = latest.ip_address
  ORDER BY candidate.last_seen_at DESC, candidate.id DESC
  LIMIT 1
);

DROP TABLE usage_daily;
ALTER TABLE usage_daily_by_ip RENAME TO usage_daily;

CREATE INDEX idx_usage_daily_last_seen_at
  ON usage_daily (last_seen_at);
