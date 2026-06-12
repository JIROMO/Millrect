"use strict";

const {
  outlineTextNative,
  measureTextLayoutNative,
} = require("./text-outline-native");
const {
  outlineTextCoreText,
  isCoreTextOutlineAvailable,
} = require("./text-outline-coretext");

function measureTextLayout(payload) {
  if (process.platform === "darwin" && isCoreTextOutlineAvailable()) {
    try {
      const result = outlineTextCoreText({ ...payload, mode: "layout" });
      if (result?.layout) {
        return { ...result, engine: "coretext" };
      }
    } catch (err) {
      console.warn(
        "[layout] Core Text failed, falling back to fontkit:",
        err.message,
      );
    }
  }
  const result = measureTextLayoutNative(payload);
  return { ...result, engine: "fontkit" };
}

function outlineText(payload) {
  if (process.platform === "darwin" && isCoreTextOutlineAvailable()) {
    try {
      const result = outlineTextCoreText(payload);
      if (result?.children?.length) {
        return { ...result, engine: "coretext" };
      }
    } catch (err) {
      console.warn(
        "[outline] Core Text failed, falling back to fontkit:",
        err.message,
      );
    }
  }
  const result = outlineTextNative(payload);
  return { ...result, engine: "fontkit" };
}

module.exports = {
  outlineText,
  measureTextLayout,
  isCoreTextOutlineAvailable,
};
