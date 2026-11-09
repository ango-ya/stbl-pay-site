// 解説ページの図を書き出す。scripts/figures/<slug>/<name>.js（1 図）を stage.html で開き、seek(t) を 1/15 秒ごとに撮って、
// assets/learn/<slug>/ に <name>.gif（受け皿）・<name>.webp（アニメ）・<name>-still.webp（完成図＝最後のコマ）を書き出す。
//
//   node scripts/figures/render.mjs                         → 全部の図
//   node scripts/figures/render.mjs stablecoin-payments     → その記事の図
//   node scripts/figures/render.mjs stablecoin-payments/flow → 1 図
//   CONTACT_DIR=<フォルダ> を付けると、採点用のコンタクトシート（1/3 秒ごとのコマを並べた PNG）もそこに出す
//
// 同じ入力・同じ版の Chromium / ffmpeg / img2webp / cwebp なら、毎回同じバイト列になる（乱数・時計を使わない）。
// 必要なツール：ffmpeg、img2webp・cwebp（brew install webp ffmpeg）。
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FPS = 15, OUT_W = 720;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "../..");
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "pipe" }); // 失敗したら stderr ごと例外になる

const all = readdirSync(HERE).filter((d) => statSync(join(HERE, d)).isDirectory())
  .flatMap((slug) => readdirSync(join(HERE, slug)).filter((f) => f.endsWith(".js")).map((f) => `${slug}/${f.slice(0, -3)}`));
const want = process.argv.slice(2);
const figs = want.length ? all.filter((f) => want.some((w) => f === w || f.startsWith(`${w}/`))) : all;
if (!figs.length) throw new Error(`図が見つからない：${want.join(" ")}（ある図：${all.join(" ")}）`);

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] }); // file:// の絵を描いた canvas を toDataURL で読むため
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => { throw e; });

for (const fig of figs) {
  const [slug, name] = fig.split("/");
  const tmp = mkdtempSync(join(tmpdir(), "learn-fig-"));
  const big = join(tmp, "big"), small = join(tmp, "small");
  mkdirSync(big); mkdirSync(small);

  await page.goto(`file://${HERE}stage.html?fig=${fig}`);
  await page.evaluate(() => window.ready);
  const { duration } = await page.evaluate(() => window.FIG);
  const n = Math.round(duration * FPS);
  // ファイルは完成図（最後の 1 秒）から始める。読み込み中・動きが始まる前・サムネイルに出る最初のコマが空の図にならないように。
  // 1 周の中身は同じ（完成図 → 頭から組み立て → 完成図で止まる → …）
  const offset = n - FPS;
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate((t) => { window.seek(t); return document.getElementById("stage").toDataURL("image/png"); }, ((i + offset) % n) / FPS);
    writeFileSync(join(big, `f${String(i).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }

  const out = join(ROOT, "assets/learn", slug);
  mkdirSync(out, { recursive: true });
  const frames = join(big, "f%04d.png");
  // 縮小（lanczos）した PNG を、アニメ WebP と静止画の元にする
  run("ffmpeg", ["-v", "error", "-y", "-i", frames, "-vf", `scale=${OUT_W}:-1:flags=lanczos`, join(small, "f%04d.png")]);
  // GIF：全コマから 1 枚のパレット。bayer で色帯を抑え、変わった矩形だけ描き直す
  run("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", frames, "-vf",
    `scale=${OUT_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=full:reserve_transparent=0[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", join(out, `${name}.gif`)]);
  // アニメ WebP：各コマ 1/15 秒（67ms）。最後のコマの長さはそのまま（止める長さは図の側で持つ）
  const list = readdirSync(small).sort().map((f) => join(small, f));
  run("img2webp", ["-loop", "0", "-lossy", "-q", "50", "-m", "6", "-d", String(Math.round(1000 / FPS)), ...list, "-o", join(out, `${name}.webp`)]);
  // 完成図（タイムラインの最後のコマ。ファイルでは FPS 枚目）
  run("cwebp", ["-quiet", "-q", "82", "-m", "6", "-metadata", "none", list[FPS - 1], "-o", join(out, `${name}-still.webp`)]);

  if (process.env.CONTACT_DIR) {
    mkdirSync(process.env.CONTACT_DIR, { recursive: true });
    const step = 5; // 1/3 秒ごと
    const rows = Math.ceil(n / step / 6);
    run("ffmpeg", ["-v", "error", "-y", "-i", frames, "-vf",
      `select='not(mod(n\\,${step}))',scale=320:-1,tile=6x${rows}:padding=4:color=white`,
      "-frames:v", "1", join(process.env.CONTACT_DIR, `${slug}-${name}.png`)]);
  }
  rmSync(tmp, { recursive: true, force: true });
  const kb = (f) => (statSync(join(out, f)).size / 1024).toFixed(0);
  console.log(`${fig}: ${n} コマ  gif ${kb(`${name}.gif`)}KB  webp ${kb(`${name}.webp`)}KB  still ${kb(`${name}-still.webp`)}KB`);
}
await browser.close();
