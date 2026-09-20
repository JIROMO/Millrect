ALTER TABLE usage_daily
  ADD COLUMN meaningful_action_count INTEGER NOT NULL DEFAULT 0
  CHECK (meaningful_action_count >= 0);

ALTER TABLE usage_daily
  ADD COLUMN export_count INTEGER NOT NULL DEFAULT 0
  CHECK (export_count >= 0);

ALTER TABLE usage_daily
  ADD COLUMN active_seconds INTEGER NOT NULL DEFAULT 0
  CHECK (active_seconds >= 0);

ALTER TABLE usage_daily
  ADD COLUMN active_days INTEGER NOT NULL DEFAULT 0
  CHECK (active_days >= 0);

ALTER TABLE usage_daily ADD COLUMN last_active_date TEXT;
ALTER TABLE usage_daily ADD COLUMN last_action TEXT;
ALTER TABLE usage_daily ADD COLUMN last_action_at TEXT;
