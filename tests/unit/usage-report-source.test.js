"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");

describe("usage reporting", () => {
  it("sends only the saved project count from production web origins", () => {
    const source = fs.readFileSync(path.join(root, "app/js/usage-report.js"), "utf8");
    assert.match(source, /PRODUCTION_HOSTS/);
    assert.match(source, /dbCountProjects\(\)/);
    assert.match(source, /JSON\.stringify\(\{ projectCount \}\)/);
    assert.doesNotMatch(source, /navigator\.userAgent/);
  });

  it("takes client metadata from edge headers and uses a prepared D1 upsert", () => {
    const source = fs.readFileSync(path.join(root, "worker/src/index.ts"), "utf8");
    assert.match(source, /c\.req\.header\("cf-connecting-ip"\)/);
    assert.match(source, /c\.req\.header\("user-agent"\)/);
    assert.match(source, /ON CONFLICT \(observed_date, ip_address, user_agent\)/);
    assert.match(source, /\.bind\(observedDate, ipAddress, userAgent, projectCount, now, now\)/);
  });

  it("declares the D1 binding, migration, and 30-day cleanup", () => {
    const config = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    const migration = fs.readFileSync(
      path.join(root, "migrations/0001_usage_daily.sql"),
      "utf8",
    );
    assert.match(config, /"binding": "USAGE_DB"/);
    assert.match(config, /"crons": \["17 3 \* \* \*"\]/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS usage_daily/);
    assert.match(migration, /UNIQUE \(observed_date, ip_address, user_agent\)/);
    assert.match(fs.readFileSync(path.join(root, "worker/src/index.ts"), "utf8"), /RAW_IP_RETENTION_DAYS = 30/);
  });
});
