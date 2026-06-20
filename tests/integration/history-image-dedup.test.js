"use strict";

// 参照画像の de-dup（state.js）が undo/redo を壊さないことの回帰テスト。
//
// 設計: referenceImage.dataUrl（base64）は履歴文字列から外し（_historyReplacer）、
// セッション内 _imageStore に imageId 単位で 1 コピーだけ持つ。復元時に
// _rehydrateImages で戻す。ここでは「履歴をまたいでも dataUrl が失われない」
// という外形的な正しさを検証する（メモリ削減そのものは実装内部）。

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

const BIG = "data:image/jpeg;base64," + "A".repeat(5000);

describe("reference image history de-dup", () => {
  let app;
  beforeEach(() => {
    app = bootApp();
  });

  it("pushHistory で imageId が付与され、移動/不透明度の undo でも dataUrl が保たれる", () => {
    const page = app.getCurrentPage();
    page.referenceImage = {
      dataUrl: BIG,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 0.45,
    };
    app.pushHistory("画像追加");

    // de-dup 経路が走り imageId が振られている（履歴文字列には dataUrl が入らない）
    assert.ok(
      app.getCurrentPage().referenceImage.imageId,
      "imageId が付与される",
    );

    app.getCurrentPage().referenceImage.opacity = 0.6;
    app.pushHistory("不透明度変更");

    app.undo();
    assert.equal(app.getCurrentPage().referenceImage.opacity, 0.45);
    assert.equal(
      app.getCurrentPage().referenceImage.dataUrl,
      BIG,
      "undo 後も画像 dataUrl が復元される",
    );

    app.redo();
    assert.equal(app.getCurrentPage().referenceImage.opacity, 0.6);
    assert.equal(app.getCurrentPage().referenceImage.dataUrl, BIG);
  });

  it("画像削除を undo すると dataUrl ごと復活する", () => {
    const page = app.getCurrentPage();
    page.referenceImage = {
      dataUrl: BIG,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 0.45,
    };
    app.pushHistory("画像追加");

    app.getCurrentPage().referenceImage = null;
    app.pushHistory("画像削除");
    assert.equal(app.getCurrentPage().referenceImage, null);

    app.undo();
    const img = app.getCurrentPage().referenceImage;
    assert.ok(img, "削除を undo すると画像が戻る");
    assert.equal(img.dataUrl, BIG, "戻った画像に dataUrl が再注入されている");
  });
});
