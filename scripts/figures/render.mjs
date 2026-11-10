// 解説ページの図を書き出す。scripts/figures/<slug>/<name>.js（1 図）を stage.html で開き、seek(t) を 1/15 秒ごとに撮って、
// assets/learn/<slug>/ に <name>.gif（受け皿）・<name>.webp（アニメ）・<name>-still.webp（完成図）を書き出す。
//
//   node scripts/figures/render.mjs                         → 全部の図
//   node scripts/figures/render.mjs stablecoin-payments     → その記事の図
//   node scripts/figures/render.mjs stablecoin-payments/flow → 1 図
//   CONTACT_DIR=<フォルダ> を付けると、採点用のコンタクトシート（1/3 秒ごとのコマを並べた PNG）もそこに出す
//
// 3 つの形式を一時フォルダで作り、最後までデコードできること・寸法・アニメかどうかを確かめてから、1 図の 3 形式を 1 つの単位として
// 差し替える（途中で失敗したら 3 つとも前の絵に戻る。outputs.mjs）。図の読み込みに失敗したとき・FX.figure() が呼ばれないとき・
// ページでエラーが出たときは、図の名前を付けて異常終了する（終了コード 1）。
// 同じ環境（同じフォント・同じ版のツール）なら毎回同じバイト列になる。使った版は README.md。
// 必要なツール：ffmpeg・ffprobe、img2webp・cwebp・webpinfo（brew install webp ffmpeg）。
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publish, withTemp } from "./outputs.mjs";

const FPS = 15, OUT_W = 720, OUT_H = 405, READY_MS = 20000;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "../..");
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "pipe" }); // 失敗したら stderr ごと例外になる

const all = readdirSync(HERE).filter((d) => statSync(join(HERE, d)).isDirectory())
  .flatMap((slug) => readdirSync(join(HERE, slug)).filter((f) => f.endsWith(".js")).map((f) => `${slug}/${f.slice(0, -3)}`));
const want = process.argv.slice(2);
const figs = want.length ? all.filter((f) => want.some((w) => f === w || f.startsWith(`${w}/`))) : all;
if (!figs.length) throw new Error(`図が見つからない：${want.join(" ")}（ある図：${all.join(" ")}）`);

async function renderOne(page, fig, tmp) {
  const big = join(tmp, "big"), small = join(tmp, "small"), made = join(tmp, "out");
  for (const d of [big, small, made]) mkdirSync(d);

  // ページのエラーは書き出しの終わりまで集め、1 件でもあれば（準備ができていても）止める
  const errors = [];
  const onError = (e) => errors.push(e.message);
  page.on("pageerror", onError);
  try {
    await renderFrames(page, fig, big, small, made, errors);
  } catch (e) {
    throw new Error(`${e.message.split("\n")[0]}${errors.length ? `／ページのエラー：${errors.join("／")}` : ""}`);
  } finally {
    page.off("pageerror", onError);
  }
}

async function renderFrames(page, fig, big, small, made, errors) {
  const [slug, name] = fig.split("/");
  const pageErrors = () => { if (errors.length) throw new Error("ページでエラーが出た"); };
  await page.goto(`file://${HERE}stage.html?fig=${fig}`);
  await page.evaluate((ms) => {
    if (!window.ready) throw new Error("engine.js が読めていない");
    return Promise.race([window.ready, new Promise((_, rej) => setTimeout(() => rej(new Error(`${ms}ms 待っても準備ができない（FX.figure() が呼ばれていない、または絵が読めない）`)), ms))]);
  }, READY_MS);
  pageErrors();
  const { duration } = await page.evaluate(() => window.FIG);
  const n = Math.round(duration * FPS);
  // ファイルは完成図（最後の 1 秒）から始める。読み込み中・動きが始まる前・サムネイルに出る最初のコマが空の図にならないように。
  // 1 周の中身は同じ（完成図 → 頭から組み立て → 完成図で止まる → …）
  const offset = n - FPS;
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate((t) => { window.seek(t); return document.getElementById("stage").toDataURL("image/png"); }, ((i + offset) % n) / FPS);
    writeFileSync(join(big, `f${String(i).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  pageErrors();

  const frames = join(big, "f%04d.png");
  const gif = join(made, `${name}.gif`), webp = join(made, `${name}.webp`), still = join(made, `${name}-still.webp`);
  // 縮小（lanczos）した PNG を、アニメ WebP と静止画の元にする
  run("ffmpeg", ["-v", "error", "-y", "-i", frames, "-vf", `scale=${OUT_W}:-1:flags=lanczos`, join(small, "f%04d.png")]);
  // GIF：全コマから 1 枚のパレット。bayer で色帯を抑え、変わった矩形だけ描き直す
  run("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", frames, "-vf",
    `scale=${OUT_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=full:reserve_transparent=0[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", gif]);
  // アニメ WebP：各コマ 1/15 秒（67ms）。止める長さは図の側で持つ。記事では「動きを止める」ボタンで完成図に替えられる（assets/learn-fig.js）
  const list = readdirSync(small).sort().map((f) => join(small, f));
  run("img2webp", ["-loop", "0", "-lossy", "-q", "50", "-m", "6", "-d", String(Math.round(1000 / FPS)), ...list, "-o", webp]);
  // 完成図（タイムラインの最後のコマ。ファイルでは FPS 枚目）
  run("cwebp", ["-quiet", "-q", "82", "-m", "6", "-metadata", "none", list[FPS - 1], "-o", still]);

  // コンタクトシート（採点用）は差し替えの前に作る（作れなければ絵も差し替えない）。検査は publish() の中
  if (process.env.CONTACT_DIR) {
    mkdirSync(process.env.CONTACT_DIR, { recursive: true });
    const step = 5; // 1/3 秒ごと
    run("ffmpeg", ["-v", "error", "-y", "-i", frames, "-vf",
      `select='not(mod(n\\,${step}))',scale=320:-1,tile=6x${Math.ceil(n / step / 6)}:padding=4:color=white`,
      "-frames:v", "1", join(process.env.CONTACT_DIR, `${slug}-${name}.png`)]);
  }
  const dest = join(ROOT, "assets/learn", slug);
  mkdirSync(dest, { recursive: true });
  // 1 図の 3 形式を 1 つの単位として、全部を検査してから差し替える
  publish([[gif, true], [webp, true], [still, false]].map(([f, anim]) => ({ from: f, to: join(dest, f.slice(made.length + 1)), w: OUT_W, h: OUT_H, anim })));

  const kb = (f) => (statSync(join(dest, f)).size / 1024).toFixed(0);
  console.log(`${fig}: ${n} コマ  gif ${kb(`${name}.gif`)}KB  webp ${kb(`${name}.webp`)}KB  still ${kb(`${name}-still.webp`)}KB`);
}

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] }); // file:// の絵を描いた canvas を toDataURL で読むため
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  for (const fig of figs) {
    try {
      await withTemp("learn-fig-", (tmp) => renderOne(page, fig, tmp));
    } catch (e) {
      e.message = `図 ${fig} の書き出しに失敗（前の絵はそのまま）：${e.message}`;
      throw e;
    }
  }
} finally {
  await browser.close();
}
