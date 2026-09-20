"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");

describe("usage reporting", () => {
  it("batches anonymous engagement counters only from production web origins", () => {
    const source = fs.readFileSync(path.join(root, "app/js/usage-report.js"), "utf8");
    assert.match(source, /PRODUCTION_HOSTS/);
    assert.match(source, /dbCountProjects\(\)/);
    assert.match(source, /meaningfulActionDelta/);
    assert.match(source, /exportDelta/);
    assert.match(source, /activeSecondsDelta/);
    assert.match(source, /document\.visibilityState !== "visible"/);
    assert.doesNotMatch(source, /navigator\.userAgent/);
  });

  it("takes client metadata from edge headers and uses a prepared D1 upsert", () => {
    const source = fs.readFileSync(path.join(root, "worker/src/index.ts"), "utf8");
    assert.match(source, /c\.req\.header\("cf-connecting-ip"\)/);
    assert.match(source, /c\.req\.header\("user-agent"\)/);
    assert.match(source, /ON CONFLICT \(ip_address\)/);
    assert.match(source, /user_agent = excluded\.user_agent/);
    assert.match(source, /meaningful_action_count = usage_daily\.meaningful_action_count/);
    assert.match(source, /export_count = usage_daily\.export_count/);
    assert.match(source, /active_days = usage_daily\.active_days/);
    assert.match(source, /visit_count = usage_daily\.visit_count \+ \?/);
    assert.doesNotMatch(source, /const observedDate/);
  });

  it("declares the D1 binding, migration, and 30-day cleanup", () => {
    const config = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    const initialMigration = fs.readFileSync(
      path.join(root, "migrations/0001_usage_daily.sql"),
      "utf8",
    );
    const uniqueIpMigration = fs.readFileSync(
      path.join(root, "migrations/0002_usage_unique_ip.sql"),
      "utf8",
    );
    const engagementMigration = fs.readFileSync(
      path.join(root, "migrations/0003_usage_engagement.sql"),
      "utf8",
    );
    assert.match(config, /"binding": "USAGE_DB"/);
    assert.match(config, /"crons": \["17 3 \* \* \*"\]/);
    assert.match(initialMigration, /CREATE TABLE IF NOT EXISTS usage_daily/);
    assert.match(uniqueIpMigration, /ip_address TEXT NOT NULL UNIQUE/);
    assert.match(uniqueIpMigration, /GROUP BY ip_address/);
    assert.doesNotMatch(uniqueIpMigration, /observed_date/);
    assert.match(engagementMigration, /meaningful_action_count/);
    assert.match(engagementMigration, /export_count/);
    assert.match(engagementMigration, /active_seconds/);
    assert.match(engagementMigration, /active_days/);
    const worker = fs.readFileSync(path.join(root, "worker/src/index.ts"), "utf8");
    assert.match(worker, /RAW_IP_RETENTION_DAYS = 30/);
    assert.match(worker, /WHERE last_seen_at < datetime\('now', \?\)/);
  });
});
