// 解説ページのサムネイルを書き出す。scripts/learn-thumbs/thumb.html を 1200×630 で撮り、
// assets/learn/<slug>/og.png（OGP 用）と thumb.webp（記事の冒頭の画像）にする。
//
//   node scripts/learn-thumbs/make.mjs                        → TITLES にある全部の記事（日本語）
//   node scripts/learn-thumbs/make.mjs stablecoin-payments    → 1 記事
//   node scripts/learn-thumbs/make.mjs stablecoin-payments en → 英語の題名で og-en.png・thumb-en.webp（英語のページ用。今は使っていない）
//
// 絵は marketing/thumbnails/in/<slug>.png（Astra の絵）があればそれ、無ければコードで描いた仮の絵。
// Astra の絵が届いたら、in/ に置いて流し直すだけで差し替わる（記事の HTML は変えなくてよい）。
// 必要なツール：cwebp・webpinfo（brew install webp）、ffmpeg・ffprobe（brew install ffmpeg。絵を最後までデコードして確かめる）。
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publish, withTemp } from "../figures/outputs.mjs";

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
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const slug of slugs.length ? slugs : Object.keys(TITLES)) {
    try {
      await withTemp("learn-thumb-", async (tmp) => {
        const { t, sub } = TITLES[slug][lang];
        const art = existsSync(new URL(`marketing/thumbnails/in/${slug}.png`, ROOT));
        const q = new URLSearchParams({ slug, t, sub, lang, ...(art ? { art: "1" } : {}) });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${new URL("thumb.html", import.meta.url).href}?${q}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 15000 })
          .catch(() => { throw new Error("15 秒待っても絵が読めない（Astra の絵・キャラクター・ロゴのどれか）"); });
        // 一時フォルダで両方を作って確かめてから、まとめて差し替える（失敗したら前の絵が残る）
        const suffix = lang === "en" ? "-en" : "";
        const png = join(tmp, `og${suffix}.png`), webp = join(tmp, `thumb${suffix}.webp`);
        await page.locator("#thumb").screenshot({ path: png });
        execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", "-metadata", "none", png, "-o", webp], { stdio: "pipe" });
        // 変換のあいだに届いたページのエラーも拾う（evaluate を 1 回往復させて、たまったイベントを処理させてから確かめる）
        await page.evaluate(() => 0);
        if (errors.length) throw new Error(`ページのエラー：${errors.join("／")}`);
        const dir = fileURLToPath(new URL(`assets/learn/${slug}/`, ROOT));
        mkdirSync(dir, { recursive: true });
        // サムネイルの 2 形式を 1 つの単位として、全部を検査してから差し替える
        publish([png, webp].map((f) => ({ from: f, to: join(dir, f.slice(tmp.length + 1)), w: 1200, h: 630, anim: false })));
        console.log(`${slug}${suffix}: ${art ? "Astra の絵" : "仮の絵"} → og${suffix}.png・thumb${suffix}.webp`);
      });
    } catch (e) {
      e.message = `サムネイル ${slug} の書き出しに失敗（前の絵はそのまま）：${e.message}`;
      throw e;
    } finally {
      page.removeAllListeners("pageerror");
    }
  }
} finally {
  await browser.close();
}
