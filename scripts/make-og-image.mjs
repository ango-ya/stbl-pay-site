// OGP 画像を scripts/og/og-image.html から撮り直して assets/ に書き出す。
//   node scripts/make-og-image.mjs           → assets/og-stblpay-generative-1200x630.png（日本語版）
//   node scripts/make-og-image.mjs en        → assets/og-stblpay-generative-en-1200x630.png（英語版）
//   node scripts/make-og-image.mjs docs [en] → assets/og-stblpay-docs[-en]-1200x630.png（docs 用。ロゴと題名だけ）
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const html = new URL("./og/og-image.html", import.meta.url);
const args = process.argv.slice(2);
if (!["", "en", "docs", "docs en"].includes(args.join(" "))) throw new Error(`引数は [docs] [en] だけ（${args.join(" ")}）`);
const en = args.includes("en"), docs = args[0] === "docs";
const out = fileURLToPath(new URL(`../assets/og-stblpay-${docs ? "docs" : "generative"}${en ? "-en" : ""}-1200x630.png`, import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`${html.href}?${docs ? "page=docs&" : ""}${en ? "lang=en" : ""}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
await page.locator("#og").screenshot({ path: out });
await browser.close();
// /learn/ の末尾のカードに出す WebP（同じ絵。必要なツール：cwebp。brew install webp）
execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", "-metadata", "none", out, "-o", out.replace(/\.png$/, ".webp")], { stdio: "pipe" });
console.log(out);
