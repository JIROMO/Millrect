"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  HELP_INDEX,
  HELP_INDEX_EN,
  helpEntryKey,
  localizeHelpEntry,
  searchHelpIndex,
} = require("../../packages/help-index");

describe("help-index", () => {
  it("全トピックに英語索引がある", () => {
    for (const entry of HELP_INDEX) {
      const key = helpEntryKey(entry);
      assert.ok(HELP_INDEX_EN[key], `missing English index for ${key}`);
    }
  });

  it("英語ロケールで layer を検索できる", () => {
    const results = searchHelpIndex("layer", 5, "en");
    assert.ok(results.length > 0);
    assert.ok(
      results.some((entry) => /layer|page/i.test(entry.title + entry.summary)),
    );
  });

  it("英語ロケールで export を検索できる", () => {
    const results = searchHelpIndex("export", 5, "en");
    assert.ok(results.length > 0);
    assert.ok(
      results.some((entry) => /export|save|STL|PDF/i.test(entry.title)),
    );
  });

  it("日本語ロケールでは英語のみの語でヒットしにくい", () => {
    const results = searchHelpIndex("layer", 5, "ja");
    assert.equal(results.length, 0);
  });

  it("localizeHelpEntry — 英語タイトルを返す", () => {
    const entry = HELP_INDEX.find((item) => item.page === "interface.html");
    assert.ok(entry);
    const localized = localizeHelpEntry(entry, "en");
    assert.equal(localized.title, "Interface");
    assert.match(localized.summary, /Toolbar/i);
  });
});
