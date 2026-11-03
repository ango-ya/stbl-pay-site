// OGP 画像を scripts/og/og-image.html から撮り直して assets/ に書き出す。
//   node scripts/make-og-image.mjs        → assets/og-stblpay-generative-1200x630.png（日本語版）
//   node scripts/make-og-image.mjs en     → assets/og-stblpay-generative-en-1200x630.png（英語版）
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const html = new URL("./og/og-image.html", import.meta.url);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "en")) throw new Error(`引数は en だけ（${args.join(" ")}）`);
const en = args[0] === "en";
const out = fileURLToPath(new URL(`../assets/og-stblpay-generative${en ? "-en" : ""}-1200x630.png`, import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(html.href + (en ? "?lang=en" : ""));
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
await page.locator("#og").screenshot({ path: out });
await browser.close();
console.log(out);
