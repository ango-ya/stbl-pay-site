// 発行・ウォレット・ブロックチェーン・払い戻しの位置関係（用語集の「JPYC EX」「ブロックチェーン」「ウォレット」）。
// 発行体が発行したステーブルコインがウォレットに入り、ブロックチェーンの上で別のウォレットへ送られ、発行体で日本円に払い戻される。
// 文字は 3 か所（発行体・ウォレット・ブロックチェーン）。運営はお金の通り道に入れない。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const ISS = [360, 112], WA = [130, 356], WB = [560, 356];
    const S = 1.45;
    // 財布：青い本体に、白い留め具
    const wallet = () => {
      rr(ctx, -46, -26, 92, 62, 10); shape(ctx, C.blue);
      rr(ctx, 6, -6, 40, 26, 8); shape(ctx, C.white);
      ctx.beginPath(); ctx.arc(24, 7, 4, 0, Math.PI * 2); shape(ctx, C.navy, null);
    };
    const A1 = { a: [ISS[0] - 40, ISS[1] + 78], b: [WA[0] + 14, WA[1] - 96], ctrl: [ISS[0] - 40, WA[1] - 96] }; // 発行：発行体 → ウォレット
    const L2 = { a: [WA[0] + 84, WA[1] + 8], b: [WB[0] - 84, WB[1] + 8] }; // 送る：ウォレット → ウォレット
    const A3 = { a: [WB[0] - 10, WB[1] - 84], b: [ISS[0] + 66, ISS[1] + 76], ctrl: [WB[0] - 10, ISS[1] + 76] }; // 払い戻し：ウォレット → 発行体
    const REST_A = [WA[0] + 44, WA[1] - 92], REST_B = [WB[0] - 44, WB[1] - 92];

    const s0 = track(t, 0.0, SNAP), s1 = track(t, 0.35, SNAP), s2 = track(t, 0.7, SNAP);
    at(ctx, ISS[0], ISS[1], s0 * S, s0, () => ICON.bank(ctx));
    at(ctx, ISS[0] + 96, ISS[1] + 8, 1, ramp(t, 0.1, 0.4), () => text(ctx, "発行体", 0, 0, { size: 40, align: "left" }));
    at(ctx, WA[0], WA[1], s1 * S, s1, wallet);
    at(ctx, WA[0] - 10, WA[1] + 124, 1, ramp(t, 0.45, 0.75), () => text(ctx, "ウォレット", 0, 0, { size: 40 }));
    at(ctx, WB[0], WB[1], s2 * S, s2, wallet);

    // 1. 発行：発行体 → ウォレット
    const u1 = track(t, 2.0, HEAVY);
    arrow(ctx, A1.a, A1.b, u1, { ctrl: A1.ctrl, color: C.blue, width: 6 });
    // 2. 送る：ブロックチェーンの上で、別のウォレットへ
    const u2 = track(t, 4.0, HEAVY);
    arrow(ctx, L2.a, L2.b, u2, { color: C.blue, width: 6 });
    const mid = [(L2.a[0] + L2.b[0]) / 2, L2.a[1]];
    at(ctx, mid[0], mid[1] + 2, 1.3, 1, () => ICON.chain(ctx, u2 * 3.4 - 0.2));
    at(ctx, mid[0], mid[1] + 66, 1, ramp(t, 4.1, 4.4), () => text(ctx, "ブロックチェーン", 0, 0, { size: 34 }));
    // 3. 払い戻し：ウォレット → 発行体
    const u3 = track(t, 6.2, HEAVY);
    arrow(ctx, A3.a, A3.b, u3, { ctrl: A3.ctrl, color: C.gray, width: 6 });

    let watch = null;
    // ステーブルコイン：発行体 → ウォレット A → ウォレット B → 発行体
    const c = track(t, 1.4, PLAY);
    if (c > 0 && t < 7.4) {
      let pos = [ISS[0], ISS[1] + 6];
      if (u1 > 0) pos = along(A1.a, A1.b, u1, A1.ctrl);
      if (u1 > 0.999) pos = [lerp(A1.b[0], REST_A[0], ramp(t, 2.7, 3.0)), lerp(A1.b[1], REST_A[1], ramp(t, 2.7, 3.0))];
      if (t >= 3.5) {
        const q = ramp(t, 3.5, 3.9);
        pos = u2 > 0 ? [lerp(L2.a[0] + 20, L2.b[0] - 20, u2), lerp(REST_A[1], REST_B[1], u2) - Math.sin(Math.PI * Math.min(1, u2)) * 30] : [lerp(REST_A[0], L2.a[0] + 20, q), REST_A[1]];
      }
      if (u2 > 0.999) pos = [lerp(L2.b[0] - 20, REST_B[0], ramp(t, 4.8, 5.1)), REST_B[1]];
      if (t >= 5.8) {
        const q = ramp(t, 5.8, 6.1);
        pos = u3 > 0 ? along(A3.a, A3.b, u3, A3.ctrl) : [lerp(REST_B[0], A3.a[0], q), lerp(REST_B[1], A3.a[1], q)];
      }
      const gone = 1 - ramp(t, 7.15, 7.35);
      at(ctx, pos[0], pos[1], c * 1.3 * gone, 1, () => COIN.stable(ctx));
      watch = pos;
    }
    // 送金が確定したしるし
    const ok = track(t, 5.0, PLAY);
    at(ctx, WB[0] + 60, WB[1] - 96, ok * 1.2, ok, () => ICON.check(ctx));
    // 日本円に払い戻された
    const y = track(t, 7.3, PLAY);
    at(ctx, ISS[0] - 140, ISS[1] + 4, y * 1.2, y, () => COIN.yen(ctx));

    drawChan(ctx, t, { pose: t < 1.3 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.8] });
    const dx = watch ? watch[0] - 372 : 0;
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: t > 7.4 ? "open" : dx > 60 ? "right" : dx < -60 ? "left" : "open", mouth: "rest", blinkAt: [1.0, 8.4] });
  },
});
