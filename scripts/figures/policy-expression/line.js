// 表現に関する方針の線引き（本文「この方針の意味」「扱えないもの」「この方針の範囲」）。
// 1 段目：日本の法律で違法でない表現は、内容を理由に断らない（すてぶるペイの約束。青い段）。図の文字は方針の言葉に寄せ、「合法なら」とは書かない。
// 2 段目：違法なものは扱えない（法律に反するものは、どの決済手段でも違法）。
// 3 段目：受け取る JPYC の利用は、JPYC 株式会社の利用規約に従う（同規約により利用が停止される場合がある）。
// 作品は本・額縁の絵で表し、内容（成人向け・暴力・政治など）は描かない。文字は 3 か所（各段）。すてぶるくんは右下の床に立つ。
FX.figure({
  duration: 9,
  draw(ctx, t) {
    const { C, COIN, ICON, at, text, rr, shape, track, ramp, SNAP, PLAY, drawChan, drawKun } = FX;
    const book = () => {
      rr(ctx, -30, -34, 52, 68, 5); shape(ctx, C.light);
      ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(-18, 34); shape(ctx, null, C.navy, 4);
      for (const y of [-14, -2]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(12, y); shape(ctx, null, C.white, 4); }
    };
    const frame = () => {
      rr(ctx, -30, -28, 60, 56, 5); shape(ctx, C.white);
      rr(ctx, -21, -19, 42, 38, 2); shape(ctx, C.light, null);
      ctx.beginPath(); ctx.moveTo(-21, 19); ctx.lineTo(-6, 0); ctx.lineTo(4, 11); ctx.lineTo(12, 3); ctx.lineTo(21, 19); ctx.closePath(); shape(ctx, C.blue, null);
    };
    const scale = () => { // 法律のはかり
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 34); shape(ctx, null, C.navy, 6);
      ctx.beginPath(); ctx.moveTo(-26, 34); ctx.lineTo(26, 34); shape(ctx, null, C.navy, 6);
      ctx.beginPath(); ctx.moveTo(-34, -22); ctx.lineTo(34, -22); shape(ctx, null, C.navy, 6);
      for (const x of [-34, 34]) {
        ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x - 12, 6); ctx.lineTo(x + 12, 6); ctx.closePath(); shape(ctx, null, C.navy, 3.5);
        ctx.beginPath(); ctx.arc(x, 6, 12, 0, Math.PI); shape(ctx, C.white, C.navy, 4);
      }
    };
    const stop = () => { // 「扱えない」の印（×）
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); shape(ctx, C.navy, C.white, 5);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); shape(ctx, null, C.white, 7);
    };
    const doc = () => { // 利用規約
      rr(ctx, -28, -38, 56, 76, 6); shape(ctx, C.white);
      for (const y of [-20, -8, 4]) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); shape(ctx, null, C.light, 5); }
    };

    const CW = 690, CH = 120, X0 = 36;
    const ROWS = [
      { y: 84, start: 0.2, fill: "#eaf2ff", label: "違法でない表現は断らない",
        icons: [{ x: 96, f: book, s: 1.0 }, { x: 166, f: frame, s: 1.0 }, { x: 226, f: () => ICON.check(ctx), s: 1.1 }] },
      { y: 232, start: 2.7, fill: C.white, label: "違法なものは扱えない",
        icons: [{ x: 104, f: scale, s: 1.0 }, { x: 188, f: stop, s: 1.0 }] },
      { y: 380, start: 5.0, fill: C.white, label: "JPYC の規約に従う",
        icons: [{ x: 104, f: doc, s: 1.0 }, { x: 190, f: () => COIN.stable(ctx), s: 1.3 }] },
    ];
    const END = 6.8;
    ROWS.forEach((r, i) => {
      const next = i < ROWS.length - 1 ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      const c = track(t, r.start, SNAP);
      at(ctx, X0 + CW / 2, r.y, c, c, () => { rr(ctx, -CW / 2, -CH / 2, CW, CH, 16); shape(ctx, r.fill); });
      r.icons.forEach((ic, k) => {
        const s = track(t, r.start + 0.2 + 0.18 * k, PLAY);
        at(ctx, ic.x, r.y, s * ic.s, s, ic.f);
      });
      at(ctx, 276, r.y, 1, ramp(t, r.start + 0.3, r.start + 0.6), () => text(ctx, r.label, 0, 0, { size: 36, align: "left" }));
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 620, floor: 532, w: 100, eyes: t > END ? "open" : t > 2.5 ? "left" : "open", mouth: t > 5.0 && t < 5.7 ? "o" : "rest", blinkAt: [1.8, 7.8] });
  },
});
