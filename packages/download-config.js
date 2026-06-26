(function (global) {
  "use strict";

  /**
   * GitHub Releases のダウンロード URL（現状 macOS のみ配布）。
   * リリース時は version / releaseTag / assets を package.json と揃えて更新する。
   * 手順: docs/RELEASE.ja.md
   */
  global.MILLRECT_DOWNLOAD = {
    version: "0.1.13",
    githubRepo: "JIROMO/Millrect",
    releaseTag: "v0.1.13",
    platforms: ["mac"],
    get releasesUrl() {
      return "https://github.com/" + this.githubRepo + "/releases/latest";
    },
    get assetBaseUrl() {
      return (
        "https://github.com/" +
        this.githubRepo +
        "/releases/download/" +
        this.releaseTag +
        "/"
      );
    },
    assets: {
      macArm64: "Millrect-0.1.13-arm64.dmg",
      macX64: "Millrect-0.1.13.dmg",
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
