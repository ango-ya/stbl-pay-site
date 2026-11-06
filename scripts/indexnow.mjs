// 変わったページの URL を IndexNow（Bing・Yandex などが共有する更新通知）へ送る。
//   node scripts/indexnow.mjs [--dry-run] <変わったファイル ...>   （git diff --name-only の出力を渡す）
//   node scripts/indexnow.mjs [--dry-run] --all                     （サイトマップの全 URL。初回や大きな作り直しのとき）
// URL は dist/ のサイトマップから取る（build-dist.sh のあとに動かす）。
// 鍵はリポジトリ直下の 42b3dbeb8d5fb387bf414cb3d4d719af.txt で公開する（IndexNow の仕様で、鍵は秘密ではない）。
import { readFileSync } from "node:fs";

const HOST = "stbl-pay.com";
const KEY = "42b3dbeb8d5fb387bf414cb3d4d719af";
const dist = new URL("../dist/", import.meta.url);
const locs = (path) => [...readFileSync(new URL(path, dist), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));
const urls = new Set();
if (args.includes("--all")) {
  for (const path of ["sitemap.xml", "docs/sitemap.xml", "docs/en/sitemap.xml"]) locs(path).forEach((u) => urls.add(u));
} else {
  if (files.includes("index.html")) urls.add(`https://${HOST}/`);
  if (files.includes("en/index.html")) urls.add(`https://${HOST}/en/`);
  // 解説（learn/…/index.html と en/learn/…/index.html）とプレスキット（press/index.html と en/press/index.html）は、置き場所がそのまま URL になる
  for (const f of files) if (/^(en\/)?(learn\/([a-z-]+\/)?|press\/)index\.html$/.test(f)) urls.add(`https://${HOST}/${f.replace(/index\.html$/, "")}`);
  // docs はどの原稿がどの URL になるかを辿らず、docs-site が変わったら docs の全 URL を送る（いまは日英 76 件）
  if (files.some((f) => f.startsWith("docs-site/"))) {
    for (const path of ["docs/sitemap.xml", "docs/en/sitemap.xml"]) locs(path).forEach((u) => urls.add(u));
  }
}

if (urls.size === 0) {
  console.log("IndexNow: 送る URL なし");
  process.exit(0);
}
if (dryRun) {
  console.log([...urls].join("\n"));
  process.exit(0);
}

// デプロイ直後で新しい版がまだ届いていないと、鍵の確認が通らないので、鍵ファイルが返るまで待つ（最大 2 分）
const keyServed = async () => {
  try {
    const res = await fetch(`https://${HOST}/${KEY}.txt`, { signal: AbortSignal.timeout(10_000) });
    return res.ok && (await res.text()) === KEY;
  } catch {
    return false;
  }
};
const deadline = Date.now() + 120_000;
while (!(await keyServed())) {
  if (Date.now() + 15_000 > deadline) throw new Error("鍵ファイルが本番に出ていない");
  await new Promise((r) => setTimeout(r, 15_000));
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: [...urls] }),
  signal: AbortSignal.timeout(30_000),
});
// 200 は受け付け、202 は鍵の確認待ち（初回）。それ以外は失敗
console.log(`IndexNow: ${urls.size} URL → ${res.status}`);
if (res.status !== 200 && res.status !== 202) process.exit(1);
