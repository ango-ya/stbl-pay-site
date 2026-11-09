// 解説ページのサムネイルを書き出す。scripts/learn-thumbs/thumb.html を 1200×630 で撮り、
// assets/learn/<slug>/og.png（OGP 用）と thumb.webp（記事の冒頭の画像）にする。
//
//   node scripts/learn-thumbs/make.mjs                        → TITLES にある全部の記事（日本語）
//   node scripts/learn-thumbs/make.mjs stablecoin-payments    → 1 記事
//   node scripts/learn-thumbs/make.mjs stablecoin-payments en → 英語の題名で og-en.png・thumb-en.webp（英語のページ用。今は使っていない）
//
// 絵は marketing/thumbnails/in/<slug>.png（Astra の絵）があればそれ、無ければコードで描いた仮の絵。
// Astra の絵が届いたら、in/ に置いて流し直すだけで差し替わる（記事の HTML は変えなくてよい）。
// 必要なツール：cwebp（brew install webp）。
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 題名は記事の h1 を短くしたもの（2〜3 行。行は | で区切る）と、小さな副題
const TITLES = {
  "stablecoin-payments": {
    ja: { t: "ステーブルコイン|決済とは？", sub: "仕組み・メリット・日本での扱い" },
    en: { t: "Stablecoin|payments in Japan", sub: "How they work, and how the law treats them" },
  },
};

const ROOT = new URL("../../", import.meta.url);
const args = process.argv.slice(2);
const lang = args.includes("en") ? "en" : "ja";
const slugs = args.filter((a) => a !== "en");
for (const s of slugs) if (!TITLES[s]) throw new Error(`TITLES に無い記事：${s}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
page.on("pageerror", (e) => { throw e; });
for (const slug of slugs.length ? slugs : Object.keys(TITLES)) {
  const { t, sub } = TITLES[slug][lang];
  const art = existsSync(new URL(`marketing/thumbnails/in/${slug}.png`, ROOT));
  const q = new URLSearchParams({ slug, t, sub, lang, ...(art ? { art: "1" } : {}) });
  await page.goto(`${new URL("thumb.html", import.meta.url).href}?${q}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  const dir = fileURLToPath(new URL(`assets/learn/${slug}/`, ROOT));
  mkdirSync(dir, { recursive: true });
  const suffix = lang === "en" ? "-en" : "";
  const png = `${dir}og${suffix}.png`;
  await page.locator("#thumb").screenshot({ path: png });
  execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", "-metadata", "none", png, "-o", `${dir}thumb${suffix}.webp`]);
  console.log(`${slug}${suffix}: ${art ? "Astra の絵" : "仮の絵"} → og${suffix}.png・thumb${suffix}.webp`);
}
await browser.close();
