// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // 対象外: 生成物・vendor・依存・成果物・JSON データなど
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-site/**",
      "app/vendor/**",
      "native/**",
      "mcp/**",
      "docs/**",
      "site/**",
      "samples/**",
      ".playwright-artifacts/**",
      "playwright.config.js",
      "**/*.cjs",
      // tsc 生成 .js（gitignore 済みの build artifact）
      "packages/**/*.js",
      "electron/**/*.js",
      "scripts/**/*.js",
      "main.js",
      "preload.js",
      // 手書き JS（移行対象だが lint 対象外。型は tsc が見る .ts を正とする）
      "app/js/**/*.js",
      "app/js/text-engine-browser.js",
      "tests/**",
      "tmp-*.js",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 全 .ts 共通
  {
    files: ["**/*.ts"],
    languageOptions: {
      // ブラウザ + Node 両方の global を許可（packages はブラウザ/Node 両対応、
      // electron/scripts は Node、app/js はブラウザ）。
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // このプロジェクトはグローバルスクリプト形式で、render()/getState() 等の
      // bare global を多用する。未定義検出は tsc（+ ambient 宣言）の責務とし、
      // ESLint の no-undef は無効化する（typescript-eslint 推奨設定でも off だが明示）。
      "no-undef": "off",

      // require() は意図的な CommonJS interop（electron / scripts / main は CJS
      // 出力、packages は cross-package + node builtin で require）。Plan B
      // フェーズ 4 で import 化するまで許容する（ADR 0002）。
      "@typescript-eslint/no-require-imports": "off",

      // `declare var`（ambient な共有 global mutable）と一部の意図的な `var` を
      // 使う。style ルールのため off（ambient 宣言での誤検出も避ける）。
      "no-var": "off",

      // interaction.ts 等で `(a = x), (b = y)` のカンマ代入式を意図的に使う。
      // 実バグ（`a === b;` 等）検出より誤検出が多いため off。
      "@typescript-eslint/no-unused-expressions": "off",

      // 残存 any は移行方針として意図的に許容したもの（外部 API / THREE /
      // 動的 DSL 等）。エラーではなく警告に留める。
      "@typescript-eslint/no-explicit-any": "warn",

      // 慣用句として残る未使用引数・catch 変数を許容（_ 始まりは無視）。
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],

      // empty catch（try { ... } catch (_) {}）はフォールバック慣用句として多用。
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // app/js / app/src: ブラウザ実行（バンドル）。Node global は外す。
  {
    files: ["app/js/**/*.ts", "app/src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
