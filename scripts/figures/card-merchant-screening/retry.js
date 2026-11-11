// 審査に落ちたときの進め方（本文「もう一度申し込む前に見直すこと」「カード以外の選択肢」）。
// 落ちたら、表記・規約・申込内容とサイトの一致などを見直す。そのうえで、申し込み直す／申込先を変える／カード以外の方法にする。
// 文字は 4 か所（見直す・申し込み直す・申込先を変える・カード以外）。すてぶるペイ・運営は出さない。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, at, text, arrow, rr, shape, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const list = () => { // 見直すことの一覧（3 行にチェック）
      rr(ctx, -36, -48, 72, 96, 9); shape(ctx, C.white);
      ctx.lineCap = "round";
      for (const y of [-26, 0, 26]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(22, y); shape(ctx, null, C.light, 6); }
    };
    const tick = (y) => { // 一覧の行のチェック
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(-26, y); ctx.lineTo(-20, y + 6); ctx.lineTo(-10, y - 6); shape(ctx, null, C.blue, 5);
    };
    const cross = () => { // 落ちた（✕の印）
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); shape(ctx, C.navy, C.white, 5);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); shape(ctx, null, C.white, 7);
    };
    const redo = () => { // 申し込み直す（回る矢印）
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI * 0.15, Math.PI * 1.45); shape(ctx, null, C.blue, 9);
      ctx.beginPath(); ctx.moveTo(28, -26); ctx.lineTo(36, 8); ctx.lineTo(8, -10); ctx.closePath(); shape(ctx, C.blue, C.blue, 3);
    };
    const notCard = () => { // カード以外（カードに斜線）
      ICON.card(ctx);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-50, 44); ctx.lineTo(50, -44); shape(ctx, null, C.white, 14);
      ctx.beginPath(); ctx.moveTo(-50, 44); ctx.lineTo(50, -44); shape(ctx, null, C.navy, 7);
    };

    const SHOP = [96, 222], LIST = [270, 222], OUT_X = 432;
    const OUTS = [
      { y: 92, label: "申し込み直す", icon: redo, at: 4.0 },
      { y: 222, label: "申込先を変える", icon: () => ICON.bank(ctx), at: 5.5 },
      { y: 352, label: "カード以外", icon: notCard, at: 7.0 },
    ];
    const END = 8.2;
    const fade = (from) => t >= from ? 1 - 0.6 * ramp(t, from, from + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;

    // 1. 落ちた
    const s = track(t, 0.2, SNAP);
    at(ctx, SHOP[0], SHOP[1], s * 1.0, s, () => ICON.shop(ctx));
    const x = track(t, 0.8, FX.PLAY);
    at(ctx, SHOP[0] + 50, SHOP[1] - 52, x, x, cross);
    // 2. 見直す（一覧の 3 行に、順にチェック）
    const l = track(t, 1.7, SNAP);
    ctx.save(); ctx.globalAlpha = fade(OUTS[0].at);
    arrow(ctx, [SHOP[0] + 62, SHOP[1]], [LIST[0] - 52, SHOP[1]], track(t, 1.4, HEAVY), { color: C.blue, width: 6 });
    at(ctx, LIST[0], LIST[1], l * 1.1, l, list);
    [0, 1, 2].forEach((k) => {
      const c = track(t, 2.3 + k * 0.5, PLAY);
      at(ctx, LIST[0] * 1.0, LIST[1], c * 1.1, c, () => tick(-26 + k * 26));
    });
    at(ctx, LIST[0], LIST[1] + 92, 1, ramp(t, 1.9, 2.2), () => text(ctx, "見直す", 0, 0, { size: 40 }));
    ctx.restore();
    // 3. そのうえで 3 つの進め方（1 つずつ。見ているものだけ濃く）
    OUTS.forEach((o, i) => {
      const next = OUTS[i + 1] ? OUTS[i + 1].at : Infinity;
      ctx.save(); ctx.globalAlpha = fade(next);
      arrow(ctx, [LIST[0] + 50, LIST[1] + (o.y - LIST[1]) * 0.12], [OUT_X - 52, o.y - (o.y - LIST[1]) * 0.05], track(t, o.at - 0.3, HEAVY), { color: C.blue, width: 6 });
      const p = track(t, o.at, SNAP);
      at(ctx, OUT_X, o.y, p * 0.85, p, o.icon);
      at(ctx, OUT_X + 62, o.y, 1, ramp(t, o.at + 0.1, o.at + 0.4), () => text(ctx, o.label, 0, 0, { size: 40, align: "left" }));
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 884, h: 250, blinkAt: [0.3, 9.4] });
  },
});
