// 解説ページのサムネイルを書き出す。scripts/learn-thumbs/thumb.html を 1200×630 で撮り、
// assets/learn/<slug>/og.png（OGP 用）と thumb.webp（記事の冒頭の画像）にする。
//
//   node scripts/learn-thumbs/make.mjs                        → TITLES にある全部の記事（日本語）
//   node scripts/learn-thumbs/make.mjs stablecoin-payments    → 1 記事
//   node scripts/learn-thumbs/make.mjs en                     → TITLES に en がある全部（英語のページ用の og-en.png・thumb-en.webp）
//
// 絵は記事ごとの場面（scenes.js）を、図と同じ部品でコードで描く。記事を足すときは TITLES と scenes.js の両方に足す。
// 必要なツール：cwebp・webpinfo（brew install webp）、ffmpeg・ffprobe（brew install ffmpeg。絵を最後までデコードして確かめる）。
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publish, withTemp } from "../figures/outputs.mjs";

// 題名は記事の h1 を短くしたもの（2〜3 行。行は | で区切る）と、小さな副題
const TITLES = {
  // /learn/ と /en/learn/ の一覧（assets/learn/hub/）。英語の一覧の場面は scenes.js の "hub-en"
  "hub": {
    ja: { t: "お店のための|決済の解説", sub: "ステーブルコイン・カード決済・手数料" },
    en: { t: "Guides to payments|in Japan and|stablecoins", sub: "For shops selling to Japan" },
  },
  "stablecoin-payments": {
    ja: { t: "ステーブルコイン|決済とは？", sub: "仕組み・手数料・メリットと日本の現状" },
  },
  "what-is-stablecoin": {
    ja: { t: "ステーブルコイン|とは？", sub: "仕組み・種類・ビットコインとの違い" },
  },
  "jpyc-payments": {
    ja: { t: "JPYC 決済の|導入方法", sub: "EC サイト・店舗の手順・手数料・サービス比較" },
  },
  "glossary": {
    ja: { t: "ステーブルコイン決済|の用語集", sub: "電子決済手段・JPYC・チャージバックほか" },
  },
  "payment-gateway": {
    ja: { t: "決済代行|とは？", sub: "仕組み・収納代行との違い・選び方" },
  },
  "accept-credit-cards": {
    ja: { t: "クレジットカード決済を|導入するには？", sub: "方法・費用・審査" },
  },
  "card-merchant-screening": {
    ja: { t: "クレジットカード決済の|加盟店審査に|落ちた・通らない", sub: "理由と対処法" },
  },
  "no-screening-payments": {
    ja: { t: "決済代行に|審査なしはある？", sub: "理由と、審査のいらない受け取り方" },
  },
  "chargeback": {
    ja: { t: "チャージバック|とは？", sub: "EC サイトの負担と、泣き寝入りを避ける対策" },
  },
  "card-expression-restrictions": {
    ja: { t: "クレカ・カード会社の|表現規制は|なぜ？", sub: "理由と同人・成人向け作品の決済の備え" },
  },
  "online-payment-methods": {
    ja: { t: "ネットショップの|決済方法 9 種類を比較", sub: "選び方とおすすめの組み合わせ" },
  },
  "payment-fees": {
    ja: { t: "決済手数料の|比較と計算方法", sub: "総コストの計算ツール付き" },
  },
  "payment-reconciliation": {
    ja: { t: "入金消込|とは？", sub: "やり方と、銀行振込で手間がかかる理由" },
  },
  "reconciliation-automation": {
    ja: { t: "入金消込は|自動化できる？", sub: "銀行 API・バーチャル口座でも残る手作業" },
  },
  "bank-transfer-payments": {
    ja: { t: "銀行振込|決済とは？", sub: "消込のいらない受け取り方" },
  },
  "policy-expression": {
    ja: { t: "表現に関する|すてぶるペイの方針", sub: "どこまでを約束するか", label: "方針" },
  },
  // 英語の解説（/en/learn/<slug>/）。slug は en/learn/ のフォルダ名
  "japan-payment-methods": {
    en: { t: "Payment methods|in Japan", sub: "How customers pay online" },
  },
  "konbini-payment": {
    en: { t: "What is|konbini payment?", sub: "Cash at a convenience store" },
  },
  "stablecoin-payments-japan": {
    en: { t: "Stablecoin|payments in Japan", sub: "A guide for overseas shops" },
  },
  "jpy-stablecoin": {
    en: { t: "What is a yen|stablecoin?", sub: "JPYC and Japan's rules" },
  },
  "accept-stablecoin-payments": {
    en: { t: "How to accept|stablecoin payments", sub: "Wallet or payment gateway" },
  },
  "high-risk-merchant-account": {
    en: { t: "What is a|high-risk|merchant account?", sub: "Why it happens, and the alternatives" },
  },
};

const ROOT = new URL("../../", import.meta.url);
const args = process.argv.slice(2);
const lang = args.includes("en") ? "en" : "ja";
const slugs = args.filter((a) => a !== "en");
for (const s of slugs) if (!TITLES[s]) throw new Error(`TITLES に無い記事：${s}`);
// 引数に slug が無いときは、その言語の題名がある記事だけを対象にする（en なら TITLES に en がある記事だけ）
const targets = slugs.length ? slugs : Object.keys(TITLES).filter((s) => TITLES[s][lang]);
const noLang = targets.filter((s) => !TITLES[s][lang]);
if (noLang.length) { console.error(`TITLES に ${lang} の題名が無い記事：${noLang.join("・")}`); process.exit(1); }

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const slug of targets) {
    try {
      await withTemp("learn-thumb-", async (tmp) => {
        const { t, sub, label } = TITLES[slug][lang];
        // 英語の一覧は日本語の一覧と出力先（hub）が同じで、場面だけ別（scenes.js の "hub-en"）
        const scene = slug === "hub" && lang === "en" ? "hub-en" : slug;
        const q = new URLSearchParams({ slug: scene, t, sub, lang, ...(label ? { label } : {}) });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${new URL("thumb.html", import.meta.url).href}?${q}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 15000 })
          .catch(() => { throw new Error("15 秒待っても絵が読めない（キャラクター・座布団・ロゴのどれか）"); });
        await page.evaluate(() => Promise.race([window.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("15 秒待っても場面を描けない")), 15000))]));
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
        console.log(`${slug}${suffix} → og${suffix}.png・thumb${suffix}.webp`);
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
