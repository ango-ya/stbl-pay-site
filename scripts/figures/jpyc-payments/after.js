// 受け取った JPYC のあと（本文「受け取った後：日本円への換金と会計」）。
// お店は、JPYC をそのまま持つか、JPYC EX で日本円に払い戻す。JPYC EX に送ると、日本円が戻ってくる。
// 文字は 2 か所（お店・JPYC EX）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const SHOP = [150, 350], WIN = [400, 128];
    const S = 1.45;
    const A1 = { a: [SHOP[0] + 16, SHOP[1] - 96], b: [WIN[0] - 94, WIN[1] + 6], ctrl: [SHOP[0] + 16, WIN[1] + 6] };
    const A2 = { a: [WIN[0] + 4, WIN[1] + 82], b: [SHOP[0] + 66, SHOP[1] - 34], ctrl: [WIN[0] + 4, SHOP[1] - 34] };
    const KEEP = [SHOP[0] - 54, SHOP[1] - 100], SEND = [SHOP[0] + 52, SHOP[1] - 100];

    const node = (p, start, icon, label, side = false) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      const a = ramp(t, start + 0.1, start + 0.4);
      if (side) at(ctx, p[0] + 96, p[1] + 8, 1, a, () => text(ctx, label, 0, 0, { size: 40, align: "left" }));
      else at(ctx, p[0], p[1] + 112, 1, a, () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(SHOP, 0.0, "shop", "お店");
    node(WIN, 0.35, "bank", "JPYC EX", true);

    // お店が JPYC を 2 枚受け取る。1 枚はそのまま持つ
    const k = track(t, 1.2, PLAY), s2 = track(t, 1.7, PLAY);
    at(ctx, KEEP[0], KEEP[1], k * 1.3, k, () => COIN.stable(ctx));
    // もう 1 枚は JPYC EX へ送る
    const u1 = track(t, 3.4, HEAVY);
    arrow(ctx, A1.a, A1.b, u1, { ctrl: A1.ctrl, color: C.blue, width: 6 });
    // 日本円が戻ってくる
    const u2 = track(t, 5.4, HEAVY);
    arrow(ctx, A2.a, A2.b, u2, { ctrl: A2.ctrl, color: C.gray, width: 6 });

    let watch = null;
    if (t < 4.7) {
      let pos = SEND;
      if (t >= 2.8) { const q = ramp(t, 2.8, 3.2); pos = [lerp(SEND[0], A1.a[0], q), lerp(SEND[1], A1.a[1], q)]; }
      if (u1 > 0) pos = along(A1.a, A1.b, u1, A1.ctrl);
      at(ctx, pos[0], pos[1], s2 * 1.3 * (1 - ramp(t, 4.45, 4.65)), 1, () => COIN.stable(ctx));
      watch = pos;
    }
    if (t >= 4.5) {
      const y = track(t, 4.6, PLAY);
      let pos = [WIN[0], WIN[1] + 6];
      if (u2 > 0) pos = along(A2.a, A2.b, u2, A2.ctrl);
      if (u2 > 0.999) pos = [lerp(A2.b[0], SEND[0], ramp(t, 6.4, 6.7)), lerp(A2.b[1], SEND[1], ramp(t, 6.4, 6.7))];
      at(ctx, pos[0], pos[1], y * 1.3, 1, () => COIN.yen(ctx));
      if (t < 6.6) watch = pos;
    }

    drawChan(ctx, t, { pose: t < 1.3 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.8] });
    const dx = watch ? watch[0] - 372 : 0;
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: dx > 60 ? "right" : dx < -60 ? "left" : "open", mouth: t > 4.6 && t < 5.3 ? "o" : "rest", blinkAt: [1.0, 8.2] });
  },
});
