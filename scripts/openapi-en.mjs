// 英語版の仕様書 docs-site/i18n/en/openapi.yaml を、英語版のビルド結果（dist/docs/en/openapi.yaml）に入れる。
// static/ は日英の両方に同じものが写るので、英語版だけここで差し替える。
// 入力は openapi/handwritten.{ja,en}.yaml と backend 生成 JSON、生成部分の英訳は scripts/openapi-en/translations.json。
// 出力同士の構造が食い違っていたら、配信物へのコピーを止める（openapi-parity.mjs）。
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { diffSpecs } from "./openapi-parity.mjs";

const yaml = createRequire(new URL("../docs-site/package.json", import.meta.url))("js-yaml");

const dist = process.argv[2];
if (!dist) {
  console.error("usage: node scripts/openapi-en.mjs <dist>");
  process.exit(1);
}

const jaText = readFileSync(new URL("../docs-site/static/openapi.yaml", import.meta.url), "utf8");
const enText = readFileSync(new URL("../docs-site/i18n/en/openapi.yaml", import.meta.url), "utf8");
const ja = yaml.load(jaText);
const en = yaml.load(enText);

const errors = diffSpecs(ja, en);
if (errors.length) {
  console.error("docs-site/i18n/en/openapi.yaml が日本語版（static/openapi.yaml）と食い違っている:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

if (dist === "--check") {
  console.log("openapi-en: 日英parity OK");
  process.exit(0);
}

writeFileSync(join(dist, "docs/en/openapi.yaml"), enText);
console.log("openapi-en: dist/docs/en/openapi.yaml を英語版に差し替えた");

// 仕様書のビューア（static/openapi/index.html）も日英で同じものが写るので、英語版の OGP をここで英語にする
const viewer = join(dist, "docs/en/openapi/index.html");
const OGP_EN = [
  ['content="ja_JP"', 'content="en_US"'],
  ['content="すてぶるペイ / STBLpay"', 'content="STBLpay"'],
  ["STBLpay API（OpenAPI）", "STBLpay API (OpenAPI)"],
  ["STBLpay API の仕様書（OpenAPI 3.1）です。プログラムや AI エージェントは、本体の openapi.yaml を読めます。", "STBLpay API specification (OpenAPI 3.1). Programs and AI agents can read the source openapi.yaml."],
  ["og-stblpay-docs-1200x630.png", "og-stblpay-docs-en-1200x630.png"],
  ["すてぶるペイ — 加盟店向けドキュメント", "STBLpay — Merchant Docs"],
];
let html = readFileSync(viewer, "utf8");
for (const [ja, en] of OGP_EN) {
  if (!html.includes(ja)) {
    console.error(`openapi-en: ${viewer} に「${ja}」が無い（static/openapi/index.html の OGP と合わせる）`);
    process.exit(1);
  }
  html = html.replaceAll(ja, en);
}
// 置き換えの漏れ（static 側だけ文言を変えたときなど）で英語版に日本語が残らないよう、<head> 全体（題と OGP）を見る。
// 属性の順序や引用符の書き方に左右されないよう、タグを読まずに文字で確かめる
const leftover = html.slice(0, html.indexOf("</head>")).split("\n").filter((line) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(line));
if (leftover.length) {
  console.error(`openapi-en: ${viewer} の <head> に日本語が残っている：\n${leftover.map((l) => `  ${l.trim()}`).join("\n")}`);
  process.exit(1);
}
writeFileSync(viewer, html);
console.log("openapi-en: dist/docs/en/openapi/index.html の OGP を英語にした");
