SELECT
  observed_date,
  COUNT(*) AS unique_clients,
  SUM(visit_count) AS app_opens,
  ROUND(AVG(project_count), 1) AS average_saved_projects,
  MAX(project_count) AS maximum_saved_projects
FROM usage_daily
GROUP BY observed_date
ORDER BY observed_date DESC
LIMIT 30;

SELECT
  last_seen_at,
  ip_address,
  user_agent,
  project_count,
  visit_count
FROM usage_daily
ORDER BY last_seen_at DESC
LIMIT 50;
