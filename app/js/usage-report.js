"use strict";

// App usage is reported only from the production web app. The Electron build
// and local development never send telemetry. Project contents and names are
// not included; only the number of records stored in IndexedDB is sent.
(function initializeUsageReporting(global) {
  const PRODUCTION_HOSTS = new Set(["millrect.com", "www.millrect.com"]);
  const REPORT_DELAY_MS = 1500;
  let reportTimer = null;

  function canReportUsage() {
    return (
      global.location?.protocol === "https:" &&
      PRODUCTION_HOSTS.has(global.location.hostname)
    );
  }

  async function reportUsageNow() {
    if (!canReportUsage() || typeof dbCountProjects !== "function") return;

    try {
      const projectCount = await dbCountProjects();
      await fetch("/api/usage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectCount }),
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      });
    } catch (error) {
      // Telemetry must never interfere with drawing or local persistence.
      console.debug("[usage] report skipped", error);
    }
  }

  function scheduleUsageReport(delay = REPORT_DELAY_MS) {
    if (!canReportUsage()) return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      reportTimer = null;
      void reportUsageNow();
    }, delay);
  }

  global.scheduleUsageReport = scheduleUsageReport;
})(window);
