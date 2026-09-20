SELECT
  COUNT(*) AS tracked_clients,
  SUM(visit_count) AS app_opens,
  SUM(
    CASE
      WHEN project_count > 0
        OR export_count > 0
        OR meaningful_action_count >= 3
        OR active_seconds >= 120
      THEN 1 ELSE 0
    END
  ) AS likely_human_clients,
  SUM(meaningful_action_count) AS meaningful_actions,
  SUM(export_count) AS exports,
  ROUND(SUM(active_seconds) / 3600.0, 1) AS active_hours,
  ROUND(AVG(project_count), 1) AS average_saved_projects,
  MAX(project_count) AS maximum_saved_projects
FROM usage_daily;

SELECT
  last_seen_at,
  ip_address,
  user_agent,
  project_count,
  visit_count,
  meaningful_action_count,
  export_count,
  active_seconds,
  active_days,
  last_action,
  last_action_at
FROM usage_daily
ORDER BY last_seen_at DESC
LIMIT 50;
