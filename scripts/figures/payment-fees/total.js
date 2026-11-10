// 決済手数料は料率だけで比べない（本文「決済手数料は、料率だけで比べない」「比べる項目と見るポイント」）。
// 料率の分だけの棒に比べて、月額・初期費用、振込手数料、チャージバックの負担を積んだ「総コスト」の棒は高い。
// 数字は描かない（料率の数字・金額を新しく足さない）。文字は 3 か所（料率だけ・総コスト・ほかの費用）。すてぶるくんは右下の床に立つ。
FX.figure({
  duration: 8,
  draw(ctx, t) {
    const { C, ICON, at, text, rr, shape, arrow, track, ramp, SNAP, STD, PLAY, drawChan, drawKun } = FX;
    const BASE = 440, W = 132, XL = 120, XR = 360;
    const H0 = 100, HS = 72; // 料率の分の高さ、ほかの費用 1 段の高さ
    // 棒の 1 段。底から s（0〜1）だけ伸びる
    const seg = (x, bottom, h, s, fill) => {
      if (s <= 0) return;
      rr(ctx, x - W / 2, bottom - h * s, W, h * s, 8); shape(ctx, fill);
    };
    const calendar = () => { // 月額・初期費用
      rr(ctx, -24, -22, 48, 46, 6); shape(ctx, C.white);
      ctx.beginPath(); ctx.rect(-24, -22, 48, 14); shape(ctx, C.blue, C.navy, 4);
      for (const [x, y] of [[-10, 4], [4, 4], [-10, 16], [4, 16]]) { rr(ctx, x - 3, y - 3, 8, 8, 1); shape(ctx, C.navy, null); }
    };
    const back = () => { // チャージバック：売上が戻っていく矢印
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.arc(2, 2, 20, -Math.PI * 0.9, Math.PI * 0.45); shape(ctx, null, C.white, 7);
      ctx.beginPath(); ctx.moveTo(-26, -20); ctx.lineTo(-20, -4); ctx.lineTo(-6, -14); ctx.closePath(); shape(ctx, C.white, C.white, 3);
    };

    // 左：料率の分だけの棒
    const a = track(t, 0.3, STD);
    seg(XL, BASE, H0, a, C.blue);
    at(ctx, XL, BASE + 44, 1, ramp(t, 0.5, 0.8), () => text(ctx, "料率だけ", 0, 0, { size: 40 }));

    // 右：総コストの棒。料率の分の上に、ほかの費用を積む
    const b = track(t, 1.4, STD);
    seg(XR, BASE, H0, b, C.blue);
    const EXTRA = [
      { start: 2.4, fill: C.light, icon: calendar, s: 1.0 },
      { start: 3.2, fill: C.silver, icon: () => ICON.bank(ctx), s: 0.52 },
      { start: 4.0, fill: C.navy, icon: back, s: 1.0 },
    ];
    EXTRA.forEach((e, i) => {
      const bottom = BASE - H0 - HS * i, k = track(t, e.start, SNAP);
      seg(XR, bottom, HS, k, e.fill);
      const p = track(t, e.start + 0.2, PLAY);
      at(ctx, XR, bottom - HS / 2, p * e.s, p, e.icon);
    });
    // ほかの費用のかっこ
    const top = BASE - H0 - HS * 3, mid = BASE - H0 - HS * 1.5, bt = BASE - H0 - 6;
    const br = ramp(t, 4.9, 5.3);
    if (br > 0) {
      ctx.save(); ctx.globalAlpha = br;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(XR + W / 2 + 14, top + 4); ctx.quadraticCurveTo(XR + W / 2 + 30, top + 4, XR + W / 2 + 30, top + 24);
      ctx.lineTo(XR + W / 2 + 30, mid - 16); ctx.quadraticCurveTo(XR + W / 2 + 30, mid, XR + W / 2 + 46, mid);
      ctx.quadraticCurveTo(XR + W / 2 + 30, mid, XR + W / 2 + 30, mid + 16); ctx.lineTo(XR + W / 2 + 30, bt - 20);
      ctx.quadraticCurveTo(XR + W / 2 + 30, bt, XR + W / 2 + 14, bt);
      shape(ctx, null, C.gray, 5);
      ctx.restore();
    }
    at(ctx, XR + W / 2 + 62, mid, 1, ramp(t, 5.0, 5.4), () => text(ctx, "ほかの費用", 0, 0, { size: 40, align: "left" }));
    at(ctx, XR, BASE + 44, 1, ramp(t, 1.6, 1.9), () => text(ctx, "総コスト", 0, 0, { size: 40 }));

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 610, floor: 532, w: 112, eyes: t > 5.6 ? "open" : t > 1.4 ? "left" : "open", mouth: t > 2.4 && t < 3.2 ? "o" : "rest", blinkAt: [0.9, 6.6] });
  },
});
