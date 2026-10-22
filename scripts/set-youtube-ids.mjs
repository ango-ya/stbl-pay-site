#!/usr/bin/env node
// つかいかた動画の YouTube の動画 ID を、index.html と en/index.html に書き込む。ほかの行は触らない。
//
//   node scripts/set-youtube-ids.mjs <JSON ファイル>
//
// - JSON ファイルは、次の 9 件を持つオブジェクト（例は scripts/youtube-ids.example.json）。
//     { "how-01": "<ID か YouTube の URL>", …, "how-08": "…", "how-08en": "…" }
//   how-01〜how-08 は第1〜8回、how-08en は第8回の英語字幕版。予告（how-00）は LP に載せないので入れない。
//   番外編（how-sp・how-pk）は index.html に ID を直接書いている（このスクリプトの対象外。正規表現 how-NN に当たらない）。
// - 値は次のどれでもよい。そこから 11 文字の ID（[A-Za-z0-9_-]{11}）を取り出す。
//     https://youtu.be/<ID>
//     https://www.youtube.com/watch?v=<ID>
//     https://www.youtube.com/shorts/<ID>
//     https://www.youtube.com/embed/<ID>
//     <ID> だけ
// - 9 件そろわない・キーが違う・値から ID を取り出せない、のどれかがあれば、何も書かずに止まる。
// - index.html は一覧 8 件（how-01〜how-08）の data-youtube と href を書き換える。
//   ポスターのリンク（[data-video-poster]）は、そのリンクの data-video の回（今の回）の ID に合わせる。
// - en/index.html はポスターのリンク 1 件（how-08en）だけを書き換える。
// - href は https://www.youtube.com/watch?v=<ID>（JS が無いときに開く先）。
// - 書き換える件数が決まっている（index.html は一覧 8 件＋ポスター 1 件、en/index.html はポスター 1 件）。
//   ずれていたら、どちらも書き込まずに止まる。
// - Node の標準モジュールだけを使う。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const EPISODES = [
  'how-01', 'how-02', 'how-03', 'how-04', 'how-05', 'how-06', 'how-07', 'how-08', 'how-08en',
];
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

// 書き換える場所。items は一覧の件数、posters はポスターのリンクの件数
const targets = [
  { file: 'index.html', items: 8, posters: 1 },
  { file: 'en/index.html', items: 0, posters: 1 },
];

// 一覧の各回：<a class="video-item" href="…" data-video="how-NN" data-youtube="…"
const ITEM = /(<a class="video-item" href=")[^"]*(" data-video=")(how-\d\d(?:en)?)(" data-youtube=")[^"]*(")/g;
// ポスターのリンク：<a class="video-poster" href="…" data-video="how-NN" data-youtube="…" data-video-poster
const POSTER = /(<a class="video-poster" href=")[^"]*(" data-video=")(how-\d\d(?:en)?)(" data-youtube=")[^"]*(" data-video-poster)/g;

// 値（ID か URL）から 11 文字の ID を取り出す。取り出せなければ null
function extractId(value) {
  const v = value.trim();
  if (ID_RE.test(v)) return v;
  let u;
  try {
    u = new URL(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const segs = u.pathname.split('/').filter(Boolean);
  let candidate = null;
  if (host === 'youtu.be') {
    candidate = segs[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segs[0] === 'watch') candidate = u.searchParams.get('v');
    else if (segs[0] === 'shorts' || segs[0] === 'embed') candidate = segs[1];
  }
  return candidate && ID_RE.test(candidate) ? candidate : null;
}

function usage() {
  console.error(
    [
      '使いかた:',
      '  node scripts/set-youtube-ids.mjs <JSON ファイル>',
      '',
      'JSON ファイルは、次の 9 件を持つオブジェクトです（例：scripts/youtube-ids.example.json）。',
      `  キー：${EPISODES.join(' ')}`,
      '  値：YouTube の動画 ID か URL（youtu.be/<ID>・watch?v=<ID>・/shorts/<ID>・/embed/<ID>）',
    ].join('\n'),
  );
}

function fail(lines) {
  for (const l of lines) console.error(l);
  console.error('何も書き込まずに止めます。');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  usage();
  process.exit(1);
}

// --- JSON を読んで、9 件と ID の形を確かめる（ここまでは何も書かない） ---
const jsonPath = resolve(args[0]);
let data;
try {
  data = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (error) {
  fail([`NG: ${jsonPath} を JSON として読めません（${error.message}）`]);
}
if (data === null || typeof data !== 'object' || Array.isArray(data)) {
  fail([`NG: ${jsonPath} の中身がオブジェクトではありません（{"how-01": "…", …} の形にしてください）`]);
}

const problems = [];
const keys = Object.keys(data);
const missing = EPISODES.filter((k) => !keys.includes(k));
const extra = keys.filter((k) => !EPISODES.includes(k));
if (missing.length > 0) problems.push(`足りないキー（${missing.length} 件）: ${missing.join(' ')}`);
if (extra.length > 0) problems.push(`余計なキー: ${extra.join(' ')}`);
if (keys.length !== EPISODES.length) problems.push(`件数が ${keys.length} 件です（${EPISODES.length} 件のはず）`);

const ids = {};
for (const k of EPISODES) {
  if (!keys.includes(k)) continue;
  const raw = data[k];
  if (typeof raw !== 'string') {
    problems.push(`${k}: 値が文字列ではありません`);
    continue;
  }
  const id = extractId(raw);
  if (id === null) {
    problems.push(`${k}: 11 文字の ID を取り出せません（値: 「${raw}」）`);
    continue;
  }
  ids[k] = id;
}
if (problems.length > 0) {
  fail([`NG: ${jsonPath} が使えません`, ...problems.map((p) => `  - ${p}`)]);
}

// 同じ ID が複数の回に入っているのは、貼り間違いかもしれない（止めはしない）
// （ID が "constructor" などでも継承したプロパティとぶつからないよう Map で数える）
const seen = new Map();
for (const k of EPISODES) {
  if (!seen.has(ids[k])) seen.set(ids[k], []);
  seen.get(ids[k]).push(k);
}
for (const [id, list] of seen) {
  if (list.length > 1) console.warn(`注意: 同じ ID（${id}）が複数の回に入っています: ${list.join(' ')}`);
}

// --- HTML の書き換えを先に全部作って、件数が合わなければ何も書かない ---
const plans = [];
for (const t of targets) {
  const path = join(root, t.file);
  const before = readFileSync(path, 'utf8');
  let items = 0;
  let posters = 0;
  const unknown = [];
  const replacer = (counter) => (_all, a, b, name, c, d) => {
    if (!(name in ids)) {
      unknown.push(name);
      return _all;
    }
    counter();
    return `${a}${watchUrl(ids[name])}${b}${name}${c}${ids[name]}${d}`;
  };
  const after = before
    .replace(ITEM, replacer(() => { items += 1; }))
    .replace(POSTER, replacer(() => { posters += 1; }));
  if (unknown.length > 0) {
    fail([`NG: ${t.file} に、JSON に無い回があります（${unknown.join(' ')}）`]);
  }
  if (items !== t.items || posters !== t.posters) {
    fail([
      `NG: ${t.file} の書き換え対象が、一覧 ${items} 件・ポスター ${posters} 件でした` +
        `（一覧 ${t.items} 件・ポスター ${t.posters} 件のはず）。`,
    ]);
  }
  plans.push({ ...t, path, before, after, foundItems: items, foundPosters: posters });
}

for (const p of plans) {
  if (p.after !== p.before) writeFileSync(p.path, p.after);
  const parts = [];
  if (p.foundItems > 0) parts.push(`一覧 ${p.foundItems} 件`);
  parts.push(`ポスター ${p.foundPosters} 件`);
  console.log(`${p.file}: ${parts.join('・')}を${p.after === p.before ? '確かめました（もう同じ）' : '書き換えました'}`);
}
console.log('');
for (const k of EPISODES) console.log(`  ${k.padEnd(8)} ${ids[k]}`);
