// @ts-check
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const artifactRoot =
  process.env.PLAYWRIGHT_ARTIFACTS_DIR ||
  path.join(__dirname, ".playwright-artifacts");

const staticPort = process.env.MILLRECT_STATIC_PORT || "4173";
const baseURL = `http://127.0.0.1:${staticPort}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.join(artifactRoot, "test-results"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: "node scripts/static-server.js",
    url: `${baseURL}/app/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: path.join(artifactRoot, "playwright-report"),
      },
    ],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
