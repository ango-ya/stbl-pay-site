// 合わない入金の典型（本文「合わない入金の典型」）。注文（左）と入金（右）の突き合わせがずれる 3 つの型を順に見せる。
// 1 名前の札が別の名前に替わる／2 お札の額から小さな額（手数料）が欠ける／3 2 枚の注文に 1 つの入金がまとめて届く。
// 文字は 3 か所（名義が違う・手数料を引いた額・まとめて振込）。名前は短い棒で表す。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = [100, 230, 360];
    const OX = 85, BX = 255, NX = 350; // 注文の伝票・入金のお札・文字の左端
    const bar = (w, color) => { rr(ctx, -w / 2, -5, w, 10, 5); shape(ctx, color, null); };
    const slip = (w = 1) => () => {
      rr(ctx, -34, -42, 68, 84, 9); shape(ctx, C.white);
      at(ctx, 0, -20, 1, 1, () => bar(36, C.navy));
      at(ctx, 0, 2, 1, 1, () => bar(44, C.silver));
      at(ctx, 0, 20, 1, 1, () => bar(30, C.silver));
    };
    // ≠ ：線だけで描く
    const neq = (k) => () => {
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); shape(ctx, null, C.blue, 6);
      ctx.beginPath(); ctx.moveTo(-10 * k, 20 * k); ctx.lineTo(10 * k, -20 * k); shape(ctx, null, C.blue, 6);
    };
    const label = (i, str, s) => at(ctx, NX, Y[i], 1, ramp(t, s, s + 0.3), () => text(ctx, str, 0, 0, { size: 40, align: "left" }));
    const pop = (s) => track(t, s, SNAP);

    // 1 名義が違う：入金のお札の名前の札が、注文の名前と違う札に替わる
    {
      const y = Y[0], a = pop(0.5), b = pop(0.8), sw = ramp(t, 2.0, 2.4), k = track(t, 2.4, PLAY);
      at(ctx, OX, y, a, a, slip());
      at(ctx, BX, y - 6, b * 1.15, b, () => COIN.yen(ctx));
      // 名前の札：最初は注文と同じ棒、あとで別の棒に
      at(ctx, BX, y + 38, b, b, () => { rr(ctx, -38, -12, 76, 24, 8); shape(ctx, C.white); at(ctx, 0, 0, 1, 1, () => bar(lerp(36, 52, sw), sw > 0.5 ? C.blue : C.navy)); });
      at(ctx, (OX + BX) / 2, y, k, k, neq(1));
      label(0, "名義が違う", 0.6);
    }
    // 2 手数料を引いた額：お札の端から小さな額が欠ける
    {
      const y = Y[1], a = pop(2.9), b = pop(3.2), cut = ramp(t, 4.4, 4.9), k = track(t, 4.8, PLAY);
      at(ctx, OX, y, a, a, () => at(ctx, 0, 0, 1.15, 1, () => COIN.yen(ctx)));
      const w = lerp(72, 48, cut);
      at(ctx, BX - 36, y, b * 1.15, b, () => {
        rr(ctx, 0, -24, w, 48, 6); shape(ctx, C.silver);
        text(ctx, "¥", w / 2, 2, { size: 34, weight: 800 });
        // 欠けた分：点線の枠で残す
        if (cut > 0.3) { ctx.save(); ctx.globalAlpha *= ramp(t, 4.6, 5.0); ctx.setLineDash([7, 7]); rr(ctx, w + 3, -24, 72 - w - 3, 48, 5); shape(ctx, null, C.blue, 4); ctx.restore(); }
      });
      at(ctx, (OX + BX) / 2, y, k, k, neq(1));
      label(1, "手数料を引いた額", 3.0);
    }
    // 3 まとめて振込：2 枚の注文に、1 つの入金が届く
    {
      const y = Y[2], a = pop(5.3), a2 = pop(5.5), b = pop(5.8);
      const u = track(t, 6.6, HEAVY);
      at(ctx, OX, y - 22, a, a, slip());
      at(ctx, OX + 14, y + 22, a2, a2, slip());
      at(ctx, BX, y, b * 1.5, b, () => COIN.yen(ctx));
      arrow(ctx, [BX - 60, y - 6], [OX + 56, y - 22], u, { color: C.gray, width: 5, head: false });
      arrow(ctx, [BX - 60, y + 6], [OX + 70, y + 22], u, { color: C.gray, width: 5, head: false });
      label(2, "まとめて振込", 5.5);
    }

    drawChan(ctx, t, { mouth: 2, pose: t < 0.4 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.2] });
    const ev = t > 6.5 ? "left" : "open";
    drawKun(ctx, t, { x: 520, floor: 532, w: 112, eyes: t > 2.3 && t < 7 ? "left" : ev, mouth: (t > 2.3 && t < 3) || (t > 4.8 && t < 5.5) || (t > 6.6 && t < 7.3) ? "o" : "rest", blinkAt: [1.0, 8.4] });
  },
});
