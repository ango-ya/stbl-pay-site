// 英語版の仕様書 docs-site/i18n/en/openapi.yaml を、英語版のビルド結果（dist/docs/en/openapi.yaml）に入れる。
// static/ は日英の両方に同じものが写るので、英語版だけここで差し替える。
// 正本は日本語版（static/openapi.yaml）。訳してよいのは説明の文とタグの名前だけで、
// それ以外（キー・型・列挙・例の値など）が日本語版とずれていたらビルドを止める。
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// js-yaml は docs-site の依存（Docusaurus が使う）にある
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

const TEXT_KEYS = new Set(["description", "summary", "title"]);
// タグの名前は訳すので、操作の tags は対応表で日本語の名前に戻して比べる
const tagName = new Map((ja.tags ?? []).map((t, i) => [en.tags?.[i]?.name, t.name]));

const errors = [];
function compare(a, b, path, key) {
  if (typeof a === "string" && typeof b === "string" && (TEXT_KEYS.has(key) || path === "/info/contact/name" || /^\/tags\/\d+\/name$/.test(path))) return;
  if (Array.isArray(a) && Array.isArray(b) && key === "tags" && path !== "/tags") b = b.map((n) => tagName.get(n) ?? n);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== b) errors.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return errors.push(`${path}: 配列かどうかが違う`);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in a)) errors.push(`${path}/${k}: 日本語版に無い`);
    else if (!(k in b)) errors.push(`${path}/${k}: 英語版に無い`);
    else compare(a[k], b[k], `${path}/${k}`, Array.isArray(a) ? key : k);
  }
}
compare(ja, en, "", "");

if (errors.length) {
  console.error("docs-site/i18n/en/openapi.yaml が日本語版（static/openapi.yaml）と食い違っている:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

writeFileSync(join(dist, "docs/en/openapi.yaml"), enText);
console.log("openapi-en: dist/docs/en/openapi.yaml を英語版に差し替えた");
