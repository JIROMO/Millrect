"use strict";

// App usage is reported only from the production web app. The Electron build
// and local development never send telemetry. Project contents and names are
// not included; counters are batched and one record per IP is updated in D1.
(function initializeUsageReporting(global) {
  const PRODUCTION_HOSTS = new Set(["millrect.com", "www.millrect.com"]);
  const REPORT_DELAY_MS = 1500;
  const ACTIVITY_REPORT_DELAY_MS = 5000;
  const ACTIVE_TICK_MS = 10000;
  const RECENT_INTERACTION_MS = 60000;
  const ALLOWED_EXPORT_FORMATS = new Set([
    "json",
    "svg",
    "dxf",
    "pdf",
    "stl",
    "3mf",
  ]);

  let reportTimer = null;
  let reportInFlight = false;
  let visitPending = true;
  let meaningfulActionDelta = 0;
  let exportDelta = 0;
  let activeSecondsDelta = 0;
  let lastAction = null;
  let actionSequence = 0;
  let lastInteractionAt = 0;

  function canReportUsage() {
    return (
      global.location?.protocol === "https:" &&
      PRODUCTION_HOSTS.has(global.location.hostname)
    );
  }

  function markInteraction() {
    lastInteractionAt = Date.now();
  }

  function hasRecentInteraction() {
    return Date.now() - lastInteractionAt <= RECENT_INTERACTION_MS;
  }

  async function reportUsageNow() {
    if (
      !canReportUsage() ||
      reportInFlight ||
      typeof dbCountProjects !== "function"
    ) {
      return;
    }

    reportInFlight = true;
    const snapshot = {
      visitDelta: visitPending ? 1 : 0,
      meaningfulActionDelta,
      exportDelta,
      activeSecondsDelta,
      lastAction,
      actionSequence,
    };

    let succeeded = false;
    try {
      const projectCount = await dbCountProjects();
      const response = await fetch("/api/usage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectCount,
          visitDelta: snapshot.visitDelta,
          meaningfulActionDelta: snapshot.meaningfulActionDelta,
          exportDelta: snapshot.exportDelta,
          activeSecondsDelta: snapshot.activeSecondsDelta,
          lastAction: snapshot.lastAction,
        }),
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      if (snapshot.visitDelta) visitPending = false;
      meaningfulActionDelta = Math.max(
        0,
        meaningfulActionDelta - snapshot.meaningfulActionDelta,
      );
      exportDelta = Math.max(0, exportDelta - snapshot.exportDelta);
      activeSecondsDelta = Math.max(
        0,
        activeSecondsDelta - snapshot.activeSecondsDelta,
      );
      if (actionSequence === snapshot.actionSequence) lastAction = null;
      succeeded = true;
    } catch (error) {
      // Telemetry must never interfere with drawing or local persistence.
      console.debug("[usage] report skipped", error);
    } finally {
      reportInFlight = false;
      if (
        succeeded &&
        (meaningfulActionDelta > 0 ||
          exportDelta > 0 ||
          activeSecondsDelta > 0)
      ) {
        scheduleUsageReport(ACTIVITY_REPORT_DELAY_MS);
      }
    }
  }

  function scheduleUsageReport(delay = REPORT_DELAY_MS) {
    if (!canReportUsage()) return;
    if (reportTimer !== null) return;
    reportTimer = setTimeout(() => {
      reportTimer = null;
      void reportUsageNow();
    }, delay);
  }

  function noteUsageMeaningfulAction() {
    if (!canReportUsage() || !hasRecentInteraction()) return;
    meaningfulActionDelta += 1;
    lastAction = "edit";
    actionSequence += 1;
    scheduleUsageReport(ACTIVITY_REPORT_DELAY_MS);
  }

  function noteUsageExport(format) {
    if (!canReportUsage()) return;
    const normalized = String(format || "").toLowerCase();
    if (!ALLOWED_EXPORT_FORMATS.has(normalized)) return;
    exportDelta += 1;
    lastAction = `export:${normalized}`;
    actionSequence += 1;
    scheduleUsageReport(ACTIVITY_REPORT_DELAY_MS);
  }

  if (canReportUsage()) {
    for (const eventName of ["pointerdown", "keydown", "wheel", "touchstart"]) {
      global.addEventListener(eventName, markInteraction, {
        capture: true,
        passive: true,
      });
    }

    global.setInterval(() => {
      if (document.visibilityState !== "visible" || !hasRecentInteraction()) {
        return;
      }
      activeSecondsDelta += ACTIVE_TICK_MS / 1000;
      scheduleUsageReport(ACTIVE_TICK_MS);
    }, ACTIVE_TICK_MS);
  }

  global.scheduleUsageReport = scheduleUsageReport;
  global.noteUsageMeaningfulAction = noteUsageMeaningfulAction;
  global.noteUsageExport = noteUsageExport;
})(window);
