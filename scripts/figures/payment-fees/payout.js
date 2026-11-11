// 入金までの日数（本文「入金までの日数」「入金が遅ければ、仕入れの支払いに困ることもあります」）。
// 売上が決まってから入金までに日数があると、そのあいだに仕入れの支払いの日が来てしまうことがある。日数は描かない。
// 文字は 3 か所（売上・仕入れの支払い・入金）。時間は左から右へ流れる線で表す。すてぶるくんは右下の床に立つ。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = 262;
    const P = { sale: 130, pay: 410, get: 640 }; // 売上・仕入れの支払い・入金（支払いが入金より先に来る）
    const dot = (fill) => () => { ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); shape(ctx, fill, C.navy, 4); };

    // 時間の線
    const u = track(t, 0.3, HEAVY);
    arrow(ctx, [60, Y], [720, Y], u, { color: C.gray, width: 6 });

    // 売上
    const s1 = track(t, 0.9, SNAP);
    at(ctx, P.sale, Y, s1, s1, dot(C.blue));
    at(ctx, P.sale, Y - 100, s1 * 1.35, s1, () => ICON.shop(ctx));
    at(ctx, P.sale, Y + 62, 1, ramp(t, 1.0, 1.3), () => text(ctx, "売上", 0, 0, { size: 40 }));

    // 待つあいだ：時計の針が回る
    const w = track(t, 1.7, PLAY);
    at(ctx, 270, Y - 100, w * 1.1, w, () => ICON.clock(ctx, 0.2 + 1.6 * ramp(t, 1.9, 6.8)));

    // 仕入れの支払い：入金より先に来る
    const s2 = track(t, 4.6, SNAP);
    at(ctx, P.pay, Y, s2, s2, dot(C.navy));
    const bump = track(t, 4.75, PLAY);
    at(ctx, P.pay, Y - 100, bump * 1.4, bump, () => COIN.yen(ctx));
    at(ctx, P.pay, Y + 62, 1, ramp(t, 4.7, 5.0), () => text(ctx, "仕入れの支払い", 0, 0, { size: 40 }));

    // 入金：あとから届く
    const s3 = track(t, 6.6, SNAP);
    at(ctx, P.get, Y, s3, s3, dot(C.blue));
    const c = track(t, 6.75, PLAY);
    at(ctx, P.get, Y - 100, c * 1.4, c, () => { COIN.yen(ctx); at(ctx, 34, -26, 0.55, 1, () => ICON.check(ctx)); });
    at(ctx, P.get, Y + 62, 1, ramp(t, 6.7, 7.0), () => text(ctx, "入金", 0, 0, { size: 40 }));

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 500, floor: 532, w: 112, eyes: t > 6.4 ? "open" : t > 4.4 ? "left" : "open", mouth: t > 4.7 && t < 5.5 ? "o" : "rest", blinkAt: [2.2, 8.4] });
  },
});
