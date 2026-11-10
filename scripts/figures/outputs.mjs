// 書き出した絵の検査と差し替え（render.mjs と ../learn-thumbs/make.mjs で共通）。
// 一時フォルダで全部の形式を作り、check() で確かめてから replace() でまとめて置き換える。途中で失敗したら、前の成果物はそのまま残る。
import { copyFileSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const out = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe" });

// 絵が読めて、寸法が w×h で、アニメかどうか（anim）が期待どおりか。違えば例外
export function check(file, { w, h, anim }) {
  if (!(statSync(file).size > 0)) throw new Error(`${file} が空`);
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
    const b = readFileSync(file);
    if (b.subarray(1, 4).toString() !== "PNG") throw new Error(`${file} が PNG でない`);
    size = [b.readUInt32BE(16), b.readUInt32BE(20)]; animated = false;
  } else throw new Error(`検査できない形式：${file}`);
  if (size[0] !== w || size[1] !== h) throw new Error(`${file} の寸法が ${size.join("×")}（${w}×${h} のはず）`);
  if (animated !== anim) throw new Error(`${file} が${anim ? "アニメでない" : "アニメになっている"}`);
}

// [[一時ファイル, 置き場所], ...] を置き換える。先に全部を置き場所の隣（.new）に写してから名前を変える
export function replace(pairs) {
  const staged = [];
  try {
    for (const [from, to] of pairs) { copyFileSync(from, `${to}.new`); staged.push(to); }
  } catch (e) {
    for (const to of staged) rmSync(`${to}.new`, { force: true });
    throw e;
  }
  for (const to of staged) renameSync(`${to}.new`, to);
}
