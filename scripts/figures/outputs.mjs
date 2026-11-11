// 書き出した絵の検査と差し替え（render.mjs と ../learn-thumbs/make.mjs で共通）。
// withTemp() の一時フォルダで全部の形式を作り、publish() で全部を check() してから replace() でまとめて置き換える。
// 守る単位は「1 図の 3 形式（.gif・.webp・-still.webp）」と「1 記事のサムネイルの 2 形式（og.png・thumb.webp）」。
// その単位の中で 1 件でも失敗したら、全部を前のファイルに戻す（新旧が混ざらない。.new・.bak も残さない）。
import * as nodeFs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe" });

// 絵が最後までデコードでき、寸法が w×h で、アニメかどうか（anim）が期待どおりか。違えば例外
export function check(file, { w, h, anim }) {
  if (!(nodeFs.statSync(file).size > 0)) throw new Error(`${file} が空`);
  // 全コマをデコードする。ffmpeg は壊れたファイルでも終了コード 0 のことがあるので、エラーの出力が空であることも見る
  const dec = spawnSync("ffmpeg", ["-v", "error", "-nostdin", "-i", file, "-f", "null", "-"], { encoding: "utf8" });
  if (dec.status !== 0 || dec.stderr.trim()) throw new Error(`${file} がデコードできない：${dec.stderr.trim().split("\n")[0] || `終了コード ${dec.status}`}`);
  let size, animated;
  if (file.endsWith(".gif")) {
    const [width, height, frames] = out("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,nb_read_frames", "-of", "csv=p=0", file]).trim().split(",").map(Number);
    size = [width, height]; animated = frames > 1;
  } else if (file.endsWith(".webp")) {
    const info = out("webpinfo", [file]); // 壊れていれば終了コード 1 で例外
    const m = info.match(/Canvas size (\d+) x (\d+)/) || info.match(/Width: (\d+)\s+Height: (\d+)/);
    if (!m) throw new Error(`${file} の寸法が読めない`);
    size = [Number(m[1]), Number(m[2])]; animated = /Animation: 1/.test(info);
  } else if (file.endsWith(".png")) {
    const b = nodeFs.readFileSync(file);
    if (b.subarray(1, 4).toString() !== "PNG") throw new Error(`${file} が PNG でない`);
    size = [b.readUInt32BE(16), b.readUInt32BE(20)]; animated = false;
  } else throw new Error(`検査できない形式：${file}`);
  if (size[0] !== w || size[1] !== h) throw new Error(`${file} の寸法が ${size.join("×")}（${w}×${h} のはず）`);
  if (animated !== anim) throw new Error(`${file} が${anim ? "アニメでない" : "アニメになっている"}`);
}

// [[一時ファイル, 置き場所], ...] を 1 つの単位として置き換える。fs はテストで差し替えられるようにしてある。
// 0. 前の実行の .new・.bak が残っていたら、何も触らずに止める（強制終了の跡。.bak が唯一の前のファイルのことがあるので消さない）
// 1. 全部を置き場所の隣に .new として写す  2. 1 件ずつ、今あるファイルを .bak に移してから .new を置き場所に移す
// 3. 全部できたら .bak を消す。途中で失敗したら、置いたものを消して .bak から戻し、今回作った .new・.bak だけを消してから例外を投げ直す
export function replace(pairs, fs = nodeFs) {
  const left = pairs.flatMap(([, to]) => [`${to}.new`, `${to}.bak`]).filter((f) => fs.existsSync(f));
  if (left.length) throw new Error(`前の書き出しの跡が残っている（中身を確かめて、手で戻すか消してから流し直す）：${left.join("、")}`);
  const copied = []; // 今回作った .new
  const moved = []; // { to, hadOld, placed }
  try {
    for (const [from, to] of pairs) {
      fs.copyFileSync(from, `${to}.new`);
      copied.push(`${to}.new`);
    }
    for (const [, to] of pairs) {
      const step = { to, hadOld: fs.existsSync(to), placed: false };
      moved.push(step);
      if (step.hadOld) fs.renameSync(to, `${to}.bak`);
      fs.renameSync(`${to}.new`, to);
      step.placed = true;
    }
  } catch (e) {
    const undo = [];
    for (const { to, hadOld, placed } of [...moved].reverse()) {
      try {
        if (placed) fs.rmSync(to, { force: true });
        if (hadOld && fs.existsSync(`${to}.bak`)) fs.renameSync(`${to}.bak`, to);
      } catch (u) { undo.push(`${to}：${u.message}`); }
    }
    for (const f of copied) fs.rmSync(f, { force: true });
    if (undo.length) e.message += `／元に戻せなかった（.bak を残した）：${undo.join("／")}`;
    throw e;
  }
  // ここまで来たら新しい絵は置けている。.bak を消せなくても失敗にはせず、知らせるだけ
  for (const { to, hadOld } of moved) {
    if (!hadOld) continue;
    try { fs.rmSync(`${to}.bak`, { force: true }); } catch (e) { console.warn(`新しい絵に差し替えたが、${to}.bak を消せなかった：${e.message}`); }
  }
}

// 1 つの単位（items：[{ from, to, w, h, anim }]）を、全部 check() してから replace() する。1 件でも検査に通らなければ何も差し替えない
export function publish(items, fs = nodeFs) {
  for (const it of items) check(it.from, it);
  replace(items.map((it) => [it.from, it.to]), fs);
}

// 一時フォルダを作って fn(フォルダ) を呼び、成功しても失敗しても消す
export async function withTemp(prefix, fn) {
  const dir = nodeFs.mkdtempSync(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  }
}
