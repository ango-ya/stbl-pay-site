// dist/docs/ の HTML にあるインラインスクリプトの sha256 を集め、dist/_headers の
// __DOCS_SCRIPT_HASHES__ を置き換える。Docusaurus はテーマの切り替えにインラインの
// スクリプトを使うので、'unsafe-inline' を使わずに許可するにはハッシュが要る。
// ビルドのたびに中身が変わりうるため、手で書かずにビルド結果から計算する。
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2];
if (!dist) {
  console.error("usage: node scripts/docs-csp.mjs <dist>");
  process.exit(1);
}

const PLACEHOLDER = "__DOCS_SCRIPT_HASHES__";

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

const hashes = new Set();
for (const file of htmlFiles(join(dist, "docs"))) {
  const html = readFileSync(file, "utf8");
  // 実行される、src の無い <script> だけを対象にする。src 付きは 'self' で許可され、
  // JSON-LD（type=application/ld+json）などデータの script は CSP の対象外
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs) || body.length === 0) continue;
    const type = attrs.match(/\btype=["']?([^"'\s>]+)/)?.[1];
    if (type && !/^(text|application)\/javascript$|^module$/.test(type)) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}

if (hashes.size === 0) {
  console.error("docs のインラインスクリプトが見つからない。ビルド結果を確認すること");
  process.exit(1);
}

const headersPath = join(dist, "_headers");
const headers = readFileSync(headersPath, "utf8");
if (!headers.includes(PLACEHOLDER)) {
  console.error(`${headersPath} に ${PLACEHOLDER} が無い`);
  process.exit(1);
}
writeFileSync(headersPath, headers.replaceAll(PLACEHOLDER, [...hashes].sort().join(" ")));
console.log(`docs の CSP に ${hashes.size} 件のスクリプトのハッシュを書き込んだ`);
