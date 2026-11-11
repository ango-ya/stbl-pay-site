// すてぶるペイの形：消込のいらない銀行振込（本文「すてぶるペイの場合」の流れ 2〜4）。
// 購入者の円が銀行振込で JPYC EX の窓口へ → JPYC（青いコイン）が購入者のウォレットへ → 注文の伝票と一緒にお店へ、注文ごとに届く → お店に通知（封筒）とチェック。
// お金の流れの線に運営は描かない。文字は 3 か所（銀行振込・JPYC EX・注文ごとに届く）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const BUY = [110, 130], WIN = [420, 130], WAL = [110, 380], SHOP = [520, 380];
    const S = 1.2;

    const wallet = () => {
      rr(ctx, -46, -30, 92, 66, 10); shape(ctx, C.blue);
      rr(ctx, -46, -30, 92, 24, 8); shape(ctx, C.light);
      rr(ctx, 12, 0, 36, 26, 8); shape(ctx, C.white);
      ctx.beginPath(); ctx.arc(30, 13, 4.5, 0, Math.PI * 2); shape(ctx, C.navy, null);
    };
    const slip = () => { // 番号つきの注文の伝票
      rr(ctx, -28, -36, 56, 72, 6); shape(ctx, C.white);
      ctx.beginPath(); ctx.rect(-25, -33, 50, 16); shape(ctx, C.blue, null);
      ctx.lineCap = "round";
      for (const y of [2, 16]) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); shape(ctx, null, C.light, 5); }
    };
    const mail = () => { // 成立の通知
      rr(ctx, -30, -22, 60, 44, 6); shape(ctx, C.white);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(-26, -16); ctx.lineTo(0, 4); ctx.lineTo(26, -16); shape(ctx, null, C.blue, 5);
    };

    const node = (p, start, draw, s = S) => { const k = track(t, start, SNAP); at(ctx, p[0], p[1], k * s, k, draw); };
    node(BUY, 0.0, () => ICON.phone(ctx));
    node(WIN, 0.35, () => ICON.bank(ctx));
    at(ctx, WIN[0] + 90, WIN[1] + 6, 1, ramp(t, 0.5, 0.8), () => text(ctx, "JPYC EX", 0, 0, { size: 40, align: "left" }));
    node(WAL, 0.7, wallet, 1.3);
    node(SHOP, 1.05, () => ICON.shop(ctx), 1.3);

    // 1. 円が、銀行振込で窓口へ
    const A1 = [[BUY[0] + 70, BUY[1]], [WIN[0] - 80, WIN[1]]];
    const u1 = track(t, 1.8, HEAVY);
    arrow(ctx, A1[0], A1[1], u1, { color: C.gray, width: 6 });
    at(ctx, 240, 190, 1, ramp(t, 2.0, 2.3), () => text(ctx, "銀行振込", 0, 0, { size: 40 }));
    const yenS = track(t, 1.6, PLAY) * (1 - ramp(t, 3.3, 3.5));
    const yp = along(A1[0], A1[1], u1);
    at(ctx, yp[0], yp[1] - 54, yenS * 1.0, 1, () => COIN.yen(ctx));

    // 2. 窓口で JPYC になり、購入者のウォレットへ
    const A2 = [[WIN[0] - 50, WIN[1] + 66], [WAL[0] + 66, WAL[1] - 54]];
    const u2 = track(t, 3.6, HEAVY);
    arrow(ctx, A2[0], A2[1], u2, { color: C.blue, width: 6 });
    const c2 = track(t, 3.4, PLAY);
    const p2 = along(A2[0], A2[1], u2);
    const c2s = c2 * (1 - ramp(t, 5.0, 5.2));
    at(ctx, p2[0] + 40, p2[1] - 8, c2s * 1.0, 1, () => COIN.stable(ctx));
    const rest = track(t, 5.0, PLAY);
    at(ctx, WAL[0] + 4, WAL[1] - 62, rest * 0.95, rest * (1 - ramp(t, 5.7, 5.9)), () => COIN.stable(ctx));

    // 3. 注文の伝票と一緒に、注文ごとにお店へ
    const A3 = [[WAL[0] + 72, WAL[1]], [SHOP[0] - 86, SHOP[1]]];
    const u3 = track(t, 5.6, HEAVY);
    arrow(ctx, A3[0], A3[1], u3, { color: C.blue, width: 6 });
    at(ctx, 310, 454, 1, ramp(t, 5.8, 6.1), () => text(ctx, "注文ごとに届く", 0, 0, { size: 40 }));
    const g = track(t, 5.5, PLAY) * (1 - ramp(t, 7.0, 7.2));
    const gp = along(A3[0], A3[1], u3);
    at(ctx, gp[0] - 26, gp[1] - 6, g * 0.8, 1, slip);
    at(ctx, gp[0] + 10, gp[1] + 8, g * 0.95, 1, () => COIN.stable(ctx));

    // 4. お店に通知が届き、成立
    const m = track(t, 7.0, PLAY);
    at(ctx, SHOP[0], SHOP[1] - 110, m * 0.85, m, mail);
    const ok = track(t, 7.6, PLAY);
    at(ctx, SHOP[0] + 74, SHOP[1] - 70, ok * 1.1, ok, () => ICON.check(ctx));

    drawChan(ctx, t, { mouth: 2, pose: t < 0.9 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.5] });
    const eye = u1 > 0.02 && u1 < 0.98 ? "right" : u3 > 0.02 && u3 < 0.98 ? "left" : "open";
    drawKun(ctx, t, { x: 650, floor: 532, w: 112, eyes: eye, mouth: t > 7.0 && t < 7.8 ? "o" : "rest", blinkAt: [1.2, 8.6] });
  },
});
