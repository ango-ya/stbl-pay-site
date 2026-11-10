// 解説ページの図（GIF・アニメ WebP）を描く共通部品。stage.html が読み、図のファイル（<slug>/<name>.js）が FX.figure({...}) で登録する。
// 決まり：絵は時刻 t の純粋関数（window.seek(t)）。CSS トランジション・setTimeout・Math.random は使わない（同じ t なら同じ絵）。
// 画面は 960×540 固定。書き出しで幅 720 に縮める。図の文字は 1 画面 3 か所まで、40px 前後（スマホで 1/3 ほどに縮むため）。
(function () {
  "use strict";
  const W = 960, H = 540;
  // 青は サイトの青（#2775ca。2026-11-06 に統一）。ほかはキャラクターの配色。gray は背景 #F6F7FB に対して 3.5:1（線・矢印に使う。3:1 以上）
  const C = { blue: "#2775ca", light: "#7EC6FF", silver: "#EBEEF7", navy: "#0F206B", white: "#FFFFFF", bg: "#F6F7FB", gray: "#7a8399" };
  const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

  // ---------- 動き ----------
  // 閉じた式のばね（質量 1、0 → 1）。k：硬さ、d：減衰
  function spring(t, k = 170, d = 26) {
    if (t <= 0) return 0;
    const w = Math.sqrt(k), z = d / (2 * w);
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const s = w * Math.sqrt(z * z - 1), r1 = -z * w + s, r2 = -z * w - s;
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }
  const SNAP = [320, 30], STD = [170, 26], HEAVY = [120, 24], PLAY = [220, 14];
  // start 秒から動き出すばね。preset は上の 4 つ
  const track = (t, start, preset = STD) => spring(t - start, preset[0], preset[1]);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  // a〜b 秒で 0 → 1 に（なめらか）
  const ramp = (t, a, b) => { const p = clamp((t - a) / (b - a)); return p * p * (3 - 2 * p); };

  // ---------- 図形 ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shape(ctx, fill, stroke = C.navy, lw = 5) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = "round"; ctx.stroke(); }
  }
  function text(ctx, str, x, y, { size = 40, weight = 700, color = C.navy, align = "center", base = "middle" } = {}) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    String(str).split("\n").forEach((line, i, all) => ctx.fillText(line, x, y + (i - (all.length - 1) / 2) * size * 1.2));
  }
  // (x, y) を中心に、拡大 s・透明度 a で fn を描く
  function at(ctx, x, y, s, a, fn) {
    if (a <= 0 || s <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.translate(x, y);
    ctx.scale(s, s);
    fn();
    ctx.restore();
  }

  // ---------- アイコン（中心 0,0、だいたい 100px 四方。at() の中で呼ぶ） ----------
  const ICON = {
    phone(ctx) {
      rr(ctx, -30, -50, 60, 100, 12); shape(ctx, C.white);
      rr(ctx, -20, -36, 40, 62, 4); shape(ctx, C.light, null);
      ctx.beginPath(); ctx.arc(0, 38, 5, 0, Math.PI * 2); shape(ctx, C.navy, null);
    },
    bank(ctx) {
      ctx.beginPath(); ctx.moveTo(-52, -16); ctx.lineTo(0, -50); ctx.lineTo(52, -16); ctx.closePath(); shape(ctx, C.blue);
      for (const x of [-34, -12, 12, 34]) { rr(ctx, x - 6, -12, 12, 46, 2); shape(ctx, C.white, C.navy, 4); }
      rr(ctx, -56, 34, 112, 14, 3); shape(ctx, C.white);
    },
    shop(ctx) {
      rr(ctx, -46, -14, 92, 62, 4); shape(ctx, C.white);
      rr(ctx, -12, 12, 24, 36, 2); shape(ctx, C.light, C.navy, 4);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.rect(-54 + i * 27, -46, 27, 30); shape(ctx, i % 2 ? C.white : C.blue, null);
      }
      rr(ctx, -54, -46, 108, 30, 6); shape(ctx, null);
    },
    card(ctx) {
      rr(ctx, -50, -32, 100, 64, 8); shape(ctx, C.blue);
      ctx.beginPath(); ctx.rect(-50, -16, 100, 12); shape(ctx, C.navy, null);
      rr(ctx, -38, 10, 28, 10, 3); shape(ctx, C.light, null);
    },
    // 時計。p は 0〜1 で針が 1 周
    clock(ctx, p = 0) {
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); shape(ctx, C.white);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); shape(ctx, null, C.navy, 6);
      const a = p * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * 30, -Math.cos(a) * 30); shape(ctx, null, C.blue, 6);
    },
    check(ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); shape(ctx, C.blue, C.white, 5);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-13, 1); ctx.lineTo(-4, 11); ctx.lineTo(14, -10); shape(ctx, null, C.white, 7);
    },
    magnifier(ctx) {
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(34, 34); shape(ctx, null, C.navy, 10);
      ctx.beginPath(); ctx.arc(-4, -4, 26, 0, Math.PI * 2); shape(ctx, C.white, C.navy, 6);
    },
    // ブロックチェーン：つながった 3 つの箱。n は見えている箱の数（小数で途中まで）
    chain(ctx, n = 3) {
      for (let i = 0; i < 3; i++) {
        const p = clamp(n - i);
        if (p <= 0) continue;
        const x = (i - 1) * 40;
        if (i > 0) { ctx.beginPath(); ctx.moveTo(x - 26, 0); ctx.lineTo(x - 14, 0); shape(ctx, null, C.navy, 5); }
        at(ctx, x, 0, 0.6 + 0.4 * p, p, () => { rr(ctx, -14, -14, 28, 28, 5); shape(ctx, i === 2 ? C.blue : C.light); });
      }
    },
    lock(ctx) {
      ctx.beginPath(); ctx.arc(0, -10, 14, Math.PI, 0); shape(ctx, null, C.navy, 6);
      rr(ctx, -22, -10, 44, 34, 6); shape(ctx, C.navy, null);
    },
  };
  // お金の絵。yen：円（銀色のお札）、stable：日本円のステーブルコイン（青いコイン）、crypto：ほかの暗号資産（紺のコイン）
  const COIN = {
    yen(ctx) {
      rr(ctx, -36, -24, 72, 48, 6); shape(ctx, C.silver);
      text(ctx, "¥", 0, 2, { size: 34, weight: 800 });
    },
    stable(ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); shape(ctx, C.blue);
      ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); shape(ctx, null, C.light, 3);
      text(ctx, "¥", 0, 2, { size: 28, weight: 800, color: C.white });
    },
    crypto(ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); shape(ctx, C.navy);
      // 実在の暗号資産の印に似ないよう、図のブロックチェーンと同じ「箱」を 1 つ
      rr(ctx, -12, -12, 24, 24, 5); shape(ctx, C.light, null);
      rr(ctx, -5, -5, 10, 10, 2); shape(ctx, C.navy, null);
    },
  };

  // 矢印：pts の折れ線（またはなめらかな 2 次曲線 [a, ctrl, b]）を p（0〜1）まで引く
  function arrow(ctx, a, b, p, { ctrl = null, color = C.navy, width = 5, dash = null, head = true } = {}) {
    if (p <= 0) return;
    const pt = (u) => ctrl
      ? [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * ctrl[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * ctrl[1] + u * u * b[1]]
      : [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    const N = 40;
    for (let i = 0; i <= N * p; i++) { const [x, y] = pt(i / N); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    const [ex, ey] = pt(p);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    if (head && p > 0.15) {
      const [px, py] = pt(Math.max(0, p - 0.02));
      const ang = Math.atan2(ey - py, ex - px);
      ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-14, -10); ctx.lineTo(-14, 10); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.restore();
  }
  // 2 次曲線（または直線）の上の位置
  const along = (a, b, u, ctrl = null) => ctrl
    ? [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * ctrl[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * ctrl[1] + u * u * b[1]]
    : [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

  // 吹き出し：(x, y) は吹き出しの下端中央。しっぽは下向きに tail だけずらす
  function bubble(ctx, str, x, y, { size = 34, tail = 0 } = {}) {
    ctx.font = `700 ${size}px ${FONT}`;
    const w = ctx.measureText(str).width + size * 1.1, h = size * 1.9;
    rr(ctx, x - w / 2, y - h, w, h, h / 2);
    shape(ctx, C.white, C.navy, 4);
    ctx.beginPath(); ctx.moveTo(x + tail - 10, y - 2); ctx.lineTo(x + tail, y + 16); ctx.lineTo(x + tail + 12, y - 2); shape(ctx, C.white, null);
    ctx.beginPath(); ctx.moveTo(x + tail - 10, y); ctx.lineTo(x + tail, y + 16); ctx.lineTo(x + tail + 12, y); shape(ctx, null, C.navy, 4);
    text(ctx, str, x, y - h / 2 + 1, { size });
  }

  // ---------- キャラクター ----------
  const IMG = {};
  const CHAN = ["normal", "proud", "palm", "point"].flatMap((p) => [0, 1, 2].map((m) => `${p}-${m}`))
    .concat(["blink-half", "blink-normal", "side-glance", "look-camera", "fist"]);
  const KUN = ["foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks", "eyes-open", "eyes-half", "eyes-closed", "eyes-left", "eyes-right", "eyes-wide",
    "mouth-rest", "mouth-dot", "mouth-o", "mouth-talk-a", "mouth-talk-i", "mouth-talk-o", "mouth-talk-n"];
  const load = (key, src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { IMG[key] = img; res(); };
    img.onerror = () => rej(new Error(`読めない：${src}`));
    img.src = src;
  });
  const ROOT = "../../assets/char/";
  const imagesReady = Promise.all([
    ...CHAN.map((n) => load(`chan/${n}`, `${ROOT}chan/${n}.webp`)),
    ...KUN.map((n) => load(`kun/${n}`, `${ROOT}kun/${n}.webp`)),
  ]);

  // まばたき：times の各時刻から 0.2 秒、半目 → 閉じる → 半目
  const blink = (t, times) => {
    for (const b of times) { const d = t - b; if (d >= 0 && d < 0.2) return d < 0.05 || d >= 0.15 ? "half" : "closed"; }
    return null;
  };
  // すてぶるちゃん（上半身 400×388、左向き。左右反転しない）。(x, y) は絵の下端中央、h は高さ
  // pose：normal / proud / palm / point / side-glance / look-camera / fist。mouth：0〜2（既定は 2＝口を開けた笑顔。なるべく笑顔にする）。blinkAt：まばたきの時刻
  function drawChan(ctx, t, { pose = "normal", mouth = 2, x = 830, y = H, h = 300, blinkAt = [] } = {}) {
    let key = ["normal", "proud", "palm", "point"].includes(pose) ? `chan/${pose}-${mouth}` : `chan/${pose}`;
    const b = pose === "normal" ? blink(t, blinkAt) : null; // 目を閉じたコマは normal の形だけある
    if (b) key = b === "half" ? "chan/blink-half" : "chan/blink-normal";
    const w = h * 400 / 388;
    ctx.drawImage(IMG[key], x - w / 2, y - h, w, h);
  }
  // すてぶるくん（部品 374×261 を左上そろえで重ねる）。起きているときは足を床に付けて立つ（浮くのは寝ているときだけ。README「キャラクターの素材と動き」）。
  // x は中心、floor は床の高さ（足の裏がここに来る）、w は幅。eyes：open / left / right / wide / half / closed。床の線も一緒に描く
  const KUN_SOLE = 252 / 261; // 部品の絵の中で、足の裏がある高さ
  function drawKun(ctx, t, { eyes = "open", mouth = "rest", x = 120, floor = 530, w = 130, blinkAt = [] } = {}) {
    const h = w * 261 / 374, top = floor - h * KUN_SOLE;
    ctx.save(); ctx.strokeStyle = C.gray; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - w * 0.62, floor); ctx.lineTo(x + w * 0.62, floor); ctx.stroke(); ctx.restore();
    const b = blink(t, blinkAt);
    const e = b === "closed" ? "closed" : b === "half" ? "half" : eyes;
    for (const part of ["foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks", `eyes-${e}`, `mouth-${mouth}`]) ctx.drawImage(IMG[`kun/${part}`], x - w / 2, top, w, h);
  }

  // ---------- 図の登録 ----------
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  let fig = null;
  let figureLoaded, figureFailed;
  const figureReady = new Promise((res, rej) => { figureLoaded = res; figureFailed = rej; });
  window.figureFailed = (msg) => figureFailed(new Error(msg)); // stage.html が図のファイルを読めなかったときに呼ぶ
  function figure(def) {
    if (!(def.duration >= 6 && def.duration <= 12)) throw new Error("duration は 6〜12 秒");
    fig = def;
    window.FIG = { duration: def.duration, hold: def.hold };
    figureLoaded();
  }
  window.seek = (t) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    fig.draw(ctx, clamp(t, 0, fig.duration));
  };
  window.ready = Promise.all([imagesReady, document.fonts.ready, figureReady]).then(() => { window.seek(0); return true; });

  window.FX = { W, H, C, FONT, spring, track, SNAP, STD, HEAVY, PLAY, clamp, lerp, ramp, rr, shape, text, at, ICON, COIN, arrow, along, bubble, drawChan, drawKun, figure };
})();
