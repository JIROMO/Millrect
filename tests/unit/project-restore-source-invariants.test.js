"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const autosaveSource = fs.readFileSync(
  path.join(ROOT, "app/js/autosave.js"),
  "utf8",
);
const tabsSource = fs.readFileSync(path.join(ROOT, "app/js/tabs.js"), "utf8");
const uiSource = fs.readFileSync(path.join(ROOT, "app/js/ui.js"), "utf8");

test("reload restores the last active saved project with a safe fallback", () => {
  assert.match(
    autosaveSource,
    /const LAST_OPENED_PROJECT_STORAGE_KEY = "millrect-last-opened-project-id"/,
  );
  assert.match(autosaveSource, /function getLastOpenedProjectId\(\)/);
  assert.match(autosaveSource, /localStorage\.setItem\(LAST_OPENED_PROJECT_STORAGE_KEY, id\)/);

  assert.match(tabsSource, /async function restoreLastOpenedProjectTab\(\)/);
  assert.match(tabsSource, /const row = await dbLoadProject\(projectId\)/);
  assert.match(tabsSource, /await openProjectInNewTab\(\{/);
  assert.match(tabsSource, /clearLastOpenedProjectId\(\)/);
  assert.match(tabsSource, /await openUntitledProjectTab\(\)/);

  assert.match(uiSource, /restoreLastOpenedProjectTab\(\)\s*\.then/);
  assert.doesNotMatch(uiSource, /openUntitledProjectTab\(\)\s*\.then/);
});
