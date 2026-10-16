#!/usr/bin/env node
// index.html と en/index.html にある mp4 への href（how-NN.mp4 / how-NNen.mp4）の
// 置き場の部分だけを、指定したベース URL に書き換える。ほかの行は触らない。
//
//   node scripts/set-video-base.mjs <ベース URL>
//   node scripts/set-video-base.mjs --local
//
// - ベース URL は https:// で始まり、/ で終わること。
//     例）node scripts/set-video-base.mjs https://media.stbl-pay.com/how/2026-10-16-1a2b3c4d5e6f7a8b/
//   正規表現で形を確かめたうえで、new URL() で解析して次も確かめる。どれか外れたら何も書かずに止まる。
//     protocol が https:、port が空か 1〜65535、パスが / で終わる、パスに . や .. のセグメントが無い
//     （%2e のような書き方も含む）、username・password・search・hash が空。
// - --local は、サイトの中の置き場（assets/video/）に戻す。
//   index.html は assets/video/、en/index.html は /assets/video/。
//   手元で mp4 を再生して確かめたいときに使う。戻した HTML はコミットしない。
// - 書き換える件数が決まっている（index.html は 10 件＝一覧 9 件＋ポスターのリンク 1 件、
//   en/index.html は 1 件）。ずれていたら、どちらも書き込まずに止まる。
// - Node の標準モジュールだけを使う。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// local は --local のときの値（今の値と同じ）
const targets = [
  { file: 'index.html', expected: 10, local: 'assets/video/' },
  { file: 'en/index.html', expected: 1, local: '/assets/video/' },
];

// href="<パス>/how-NN.mp4" と href="<パス>/how-NNen.mp4"。パス部分は何でもよい
const HREF = /href="(?:[^"]*\/)?(how-\d\d(?:en)?\.mp4)"/g;

// https://ホスト(:ポート)/ のあとに、英数字などの名前を / でつないだもの。最後は /
const BASE_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/(?:[A-Za-z0-9._~%+-]+\/)*$/;

// ベース URL の外れたところの一覧（空なら問題なし）。正規表現で形を見てから、new URL() で解析して確かめる
function baseUrlProblems(value) {
  if (!BASE_URL.test(value)) {
    return ['https:// で始まり、ホスト名のあとに英数字などの名前を / でつないだ形で、最後が / になっていません'];
  }
  let u;
  try {
    u = new URL(value);
  } catch {
    return ['URL として解析できません（ポート番号が 65535 を超えている、など）'];
  }
  const problems = [];
  if (u.protocol !== 'https:') problems.push(`protocol が ${u.protocol} です（https: のはず）`);
  if (u.port !== '') {
    const port = Number(u.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push(`port が ${u.port} です（空か 1〜65535 のはず）`);
  }
  if (!u.pathname.endsWith('/')) problems.push(`パス ${u.pathname} が / で終わっていません`);
  // 解析で . や .. は畳まれてしまうので、書かれたままのパスで見る。%2e も . と同じ扱い
  const rawPath = value.slice(value.indexOf('/', 'https://'.length));
  const dotted = rawPath.split('/').filter((seg) => ['.', '..'].includes(seg.replace(/%2e/gi, '.')));
  if (dotted.length > 0) problems.push(`パスに . か .. のセグメントがあります（${dotted.join(' ')}）`);
  else if (u.pathname !== rawPath) problems.push(`解析するとパスが ${u.pathname} に変わります（書かれたパス: ${rawPath}）`);
  if (u.username !== '' || u.password !== '') problems.push('username か password が入っています');
  if (u.search !== '') problems.push(`search が入っています（${u.search}）`);
  if (u.hash !== '') problems.push(`hash が入っています（${u.hash}）`);
  return problems;
}

function usage() {
  console.error(
    [
      '使いかた:',
      '  node scripts/set-video-base.mjs <ベース URL>   例）https://media.stbl-pay.com/how/2026-10-16-1a2b3c4d5e6f7a8b/',
      '  node scripts/set-video-base.mjs --local        サイトの中の置き場（assets/video/）に戻す',
      '',
      'ベース URL は https:// で始まり、/ で終わること。',
      '--local は、手元で mp4 を再生して確かめたいときに使う（戻した HTML はコミットしない）。',
    ].join('\n'),
  );
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  usage();
  process.exit(1);
}
const arg = args[0];
const isLocal = arg === '--local';
if (!isLocal) {
  const problems = baseUrlProblems(arg);
  if (problems.length > 0) {
    console.error(`NG: ベース URL が使えません（指定: ${arg}）`);
    for (const p of problems) console.error(`  - ${p}`);
    usage();
    process.exit(1);
  }
}

// 先に全部を調べて、件数が合わなければ何も書かない
const plans = [];
for (const t of targets) {
  const path = join(root, t.file);
  const before = readFileSync(path, 'utf8');
  const base = isLocal ? t.local : arg;
  let count = 0;
  const after = before.replace(HREF, (_all, name) => {
    count += 1;
    return `href="${base}${name}"`;
  });
  if (count !== t.expected) {
    console.error(`NG: ${t.file} の mp4 の href が ${count} 件でした（${t.expected} 件のはず）。何も書き込まずに止めます。`);
    process.exit(1);
  }
  plans.push({ ...t, path, before, after, count, base });
}

for (const p of plans) {
  if (p.after !== p.before) writeFileSync(p.path, p.after);
  console.log(`${p.file}: ${p.count} 件を ${p.base} に${p.after === p.before ? '（もう同じ）' : '書き換えました'}`);
}
