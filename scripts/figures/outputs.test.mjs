// outputs.mjs（書き出した絵の検査と差し替え）の異常系。node --test scripts/figures/（npm run test:figures）
// どの失敗でも、前のファイルの中身が変わらず、.new・.bak・一時フォルダが残らないこと。
// 必要なツール：ffmpeg・ffprobe、cwebp・img2webp・webpinfo（書き出しと同じ）
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { publish, withTemp } from "./outputs.mjs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "pipe" });

// 本物の小さな絵（16×8）を作る：PNG・静止画 WebP・アニメ GIF・アニメ WebP
function makeImages(dir) {
  const png = join(dir, "a.png"), png2 = join(dir, "b.png");
  run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=16x8", "-frames:v", "1", png]);
  run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=16x8", "-frames:v", "1", png2]);
  const still = join(dir, "x-still.webp"), anim = join(dir, "x.webp"), gif = join(dir, "x.gif");
  run("cwebp", ["-quiet", png, "-o", still]);
  run("img2webp", ["-loop", "0", "-lossy", png, png2, "-o", anim]);
  run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=s=16x8:r=5", "-t", "0.6", gif]);
  return { png, still, anim, gif };
}

// 置き場所に「前のファイル」を置き、1 図分の items を作る
function setup(work) {
  const made = join(work, "made"), dest = join(work, "dest");
  fs.mkdirSync(made); fs.mkdirSync(dest);
  const img = makeImages(made);
  const names = ["x.gif", "x.webp", "x-still.webp"];
  for (const n of names) fs.writeFileSync(join(dest, n), `前の ${n}`);
  const items = [[img.gif, true], [img.anim, true], [img.still, false]]
    .map(([from, anim], i) => ({ from, to: join(dest, names[i]), w: 16, h: 8, anim }));
  return { dest, names, items, img };
}

const assertUntouched = (dest, names) => {
  for (const n of names) assert.equal(fs.readFileSync(join(dest, n), "utf8"), `前の ${n}`, `${n} は前のまま`);
  assert.deepEqual(fs.readdirSync(dest).filter((f) => /\.(new|bak)$/.test(f)), [], ".new・.bak が残らない");
};

// withTemp の中で fn を呼び、失敗することと、一時フォルダが消えることを確かめる
async function failsAndCleansUp(fn, pattern) {
  let tmp;
  await assert.rejects(withTemp("outputs-test-", (dir) => { tmp = dir; return fn(dir); }), pattern);
  assert.equal(fs.existsSync(tmp), false, "一時フォルダが残らない");
}

test("うまくいけば 3 形式とも新しくなり、.new・.bak・一時フォルダが残らない", async () => {
  let tmp, dest;
  await withTemp("outputs-test-", (dir) => {
    tmp = dir;
    const s = setup(dir);
    dest = s.dest;
    publish(s.items);
    for (const it of s.items) assert.deepEqual(fs.readFileSync(it.to), fs.readFileSync(it.from));
    assert.deepEqual(fs.readdirSync(dest).sort(), [...s.names].sort());
  });
  assert.equal(fs.existsSync(tmp), false);
});

test("rename の途中（2 件目を置くところ）で失敗したら、1 件目も前のファイルに戻る", async () => {
  await failsAndCleansUp((dir) => {
    const { dest, names, items } = setup(dir);
    let placed = 0;
    const broken = { ...fs, renameSync: (from, to) => {
      if (from.endsWith(".new") && ++placed === 2) throw new Error("わざと失敗（rename）");
      return fs.renameSync(from, to);
    } };
    try {
      publish(items, broken);
    } finally {
      assertUntouched(dest, names);
    }
  }, /わざと失敗（rename）/);
});

test(".new に写す途中で失敗しても、前のファイルのまま", async () => {
  await failsAndCleansUp((dir) => {
    const { dest, names, items } = setup(dir);
    let n = 0;
    const broken = { ...fs, copyFileSync: (a, b) => { if (++n === 3) throw new Error("わざと失敗（copy）"); return fs.copyFileSync(a, b); } };
    try { publish(items, broken); } finally { assertUntouched(dest, names); }
  }, /わざと失敗（copy）/);
});

test("差し替えの前の検査で失敗したら（寸法違い）、何も差し替えない", async () => {
  await failsAndCleansUp((dir) => {
    const { dest, names, items } = setup(dir);
    items[2] = { ...items[2], w: 720 };
    try { publish(items); } finally { assertUntouched(dest, names); }
  }, /寸法/);
});

test("壊れた PNG（ヘッダーだけの 24 バイト）はデコードの検査で落ち、何も差し替えない", async () => {
  await failsAndCleansUp((dir) => {
    const { dest, img } = setup(dir);
    const bad = join(dir, "made", "bad.png");
    fs.writeFileSync(bad, fs.readFileSync(img.png).subarray(0, 24)); // 寸法（IHDR）は読めるが、絵のデータが無い
    fs.writeFileSync(join(dest, "og.png"), "前の og.png");
    fs.writeFileSync(join(dest, "thumb.webp"), "前の thumb.webp");
    try {
      publish([{ from: img.still, to: join(dest, "thumb.webp"), w: 16, h: 8, anim: false }, { from: bad, to: join(dest, "og.png"), w: 16, h: 8, anim: false }]);
    } finally {
      assertUntouched(dest, ["og.png", "thumb.webp"]);
    }
  }, /デコードできない/);
});

test("途中で切れたアニメ WebP・GIF もデコードの検査で落ちる", async () => {
  for (const key of ["anim", "gif"]) {
    await failsAndCleansUp((dir) => {
      const { dest, names, items, img } = setup(dir);
      const i = key === "anim" ? 1 : 0;
      const cut = join(dir, "made", `cut-${names[i]}`);
      const b = fs.readFileSync(img[key]);
      fs.writeFileSync(cut, b.subarray(0, Math.floor(b.length * 0.6)));
      items[i] = { ...items[i], from: cut };
      try { publish(items); } finally { assertUntouched(dest, names); }
    }, /デコードできない|webpinfo|寸法/);
  }
});

test("前の実行の .bak が残っていたら（強制終了の跡）、何も触らずに止まり、.bak も消さない", async () => {
  await failsAndCleansUp((dir) => {
    const { dest, names, items } = setup(dir);
    fs.rmSync(join(dest, names[0]));
    fs.writeFileSync(join(dest, `${names[0]}.bak`), "唯一の前のファイル");
    const broken = { ...fs, copyFileSync: () => { throw new Error("呼ばれないはず"); } };
    try { publish(items, broken); } finally {
      assert.equal(fs.readFileSync(join(dest, `${names[0]}.bak`), "utf8"), "唯一の前のファイル");
      for (const n of names.slice(1)) assert.equal(fs.readFileSync(join(dest, n), "utf8"), `前の ${n}`);
      assert.equal(fs.existsSync(join(dest, names[0])), false);
    }
  }, /前の書き出しの跡が残っている/);
});

test("差し替えたあとに .bak を消せなくても失敗にはしない（新しい絵は置けている）", async () => {
  await withTemp("outputs-test-", (dir) => {
    const { items } = setup(dir);
    const broken = { ...fs, rmSync: (f, o) => { if (String(f).endsWith(".bak")) throw new Error("わざと失敗（rm）"); return fs.rmSync(f, o); } };
    const warn = console.warn; const warned = [];
    console.warn = (m) => warned.push(m);
    try { publish(items, broken); } finally { console.warn = warn; }
    for (const it of items) assert.deepEqual(fs.readFileSync(it.to), fs.readFileSync(it.from));
    assert.equal(warned.length, 3);
  });
});
