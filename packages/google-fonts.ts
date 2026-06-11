"use strict";

// Google Fonts CSS URL → family name + font file URL (browser).

interface GoogleFontsCssParse {
  cssUrl: string;
  families: string[];
}

function _familyNameFromParam(param: unknown): string {
  return decodeURIComponent(String(param || "").split(":")[0])
    .replace(/\+/g, " ")
    .trim();
}

function parseGoogleFontsCssUrlFamilies(input: unknown): GoogleFontsCssParse {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("URL を入力してください");
  let url: URL;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new Error("URL の形式が正しくありません");
  }
  const host = url.hostname.replace(/^www\./i, "");
  if (host !== "fonts.googleapis.com") {
    throw new Error("Google Fonts の CSS URL を入力してください");
  }
  const familyParams = url.searchParams.getAll("family");
  if (!familyParams.length) {
    throw new Error("family パラメータが見つかりません");
  }
  const families: string[] = [];
  const seen = new Set<string>();
  for (const param of familyParams) {
    const family = _familyNameFromParam(param);
    if (!family) continue;
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    families.push(family);
  }
  if (!families.length) throw new Error("フォント名を取得できませんでした");
  return { cssUrl: url.href, families };
}

/** @deprecated use parseGoogleFontsCssUrlFamilies */
function parseGoogleFontsCssUrl(input: unknown): {
  family: string;
  cssUrl: string;
} {
  const { cssUrl, families } = parseGoogleFontsCssUrlFamilies(input);
  return { family: families[0], cssUrl };
}

function _pickFontFileUrlFromCss(css: string): string {
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) =>
    m[1].replace(/['"]/g, ""),
  );
  if (!urls.length) {
    throw new Error("フォントファイル URL を CSS から取得できませんでした");
  }
  const ttf = urls.find((u) => /\.ttf(?:\?|$)/i.test(u));
  if (ttf) return ttf;
  const otf = urls.find((u) => /\.otf(?:\?|$)/i.test(u));
  if (otf) return otf;
  const woff2 = urls.filter((u) => /\.woff2(?:\?|$)/i.test(u));
  if (woff2.length === 1) return woff2[0];
  if (woff2.length > 1) {
    throw new Error(
      "CSS が subset 分割のみです。Fontsource 経由で解決してください",
    );
  }
  return urls[urls.length - 1];
}

async function resolveFontsourceFileUrl(
  family: string,
  weight = 400,
): Promise<string> {
  const slug = family.toLowerCase().trim().replace(/\s+/g, "-");
  const metaRes = await fetch(
    `https://api.fontsource.org/v1/fonts/${encodeURIComponent(slug)}`,
  );
  if (!metaRes.ok) {
    throw new Error(`Fontsource に「${family}」が見つかりません`);
  }
  // FontsourceMeta は fontsource-api.ts が global script スコープに定義。
  const meta: FontsourceMeta = await metaRes.json();
  const ver = meta.npmVersion || "5.0.0";
  const subsets: string[] = meta.subsets || ["latin"];
  const subset = subsets.includes("japanese")
    ? "japanese"
    : subsets.includes("latin")
      ? "latin"
      : subsets[0];
  const weights: number[] = meta.weights || [400];
  const w = weights.includes(weight) ? weight : weights[0];
  const style = (meta.styles || ["normal"])[0];
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@${ver}/${subset}-${w}-${style}.ttf`;
}

async function resolveGoogleFontFileUrl(
  cssUrl: string,
  family?: string,
): Promise<string> {
  const res = await fetch(cssUrl);
  if (!res.ok) {
    throw new Error(`CSS の取得に失敗しました (${res.status})`);
  }
  const css = await res.text();
  try {
    return _pickFontFileUrlFromCss(css);
  } catch (err) {
    if (family) {
      return resolveFontsourceFileUrl(family);
    }
    throw err;
  }
}

async function resolveOutlineFontFileUrl(
  family: string,
  cssUrl: string,
): Promise<string> {
  try {
    return await resolveFontsourceFileUrl(family);
  } catch (_) {
    return resolveGoogleFontFileUrl(cssUrl, family);
  }
}

// バンドル時の global 面。script タグ時代のトップレベル宣言によるグローバル
// 公開と同等の面を明示的に維持する（ブラウザ専用モジュール・module.exports なし）。
if (typeof window !== "undefined") {
  Object.assign(window, {
    parseGoogleFontsCssUrlFamilies,
    parseGoogleFontsCssUrl,
    resolveFontsourceFileUrl,
    resolveGoogleFontFileUrl,
    resolveOutlineFontFileUrl,
  });
}
