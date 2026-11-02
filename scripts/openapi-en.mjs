// 英語版の仕様書 docs-site/i18n/en/openapi.yaml を、英語版のビルド結果（dist/docs/en/openapi.yaml）に入れる。
// static/ は日英の両方に同じものが写るので、英語版だけここで差し替える。
// 正本は日本語版（static/openapi.yaml）。訳してよい文以外が日本語版とずれていたら、ビルドを止める（openapi-parity.mjs）。
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { diffSpecs } from "./openapi-parity.mjs";

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

const errors = diffSpecs(ja, en);
if (errors.length) {
  console.error("docs-site/i18n/en/openapi.yaml が日本語版（static/openapi.yaml）と食い違っている:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

writeFileSync(join(dist, "docs/en/openapi.yaml"), enText);
console.log("openapi-en: dist/docs/en/openapi.yaml を英語版に差し替えた");
