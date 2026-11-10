// 導入の手順（本文「導入の手順：申し込みから公開まで」の 6 つ）。申し込み → 加盟店審査 → 契約 → 組み込み → テスト → 公開。
// 審査のところだけ、時計が回る（数日から数週間かかるのが一般的）。文字は 6 つの手順の名前だけ（各 2〜4 字。本文の言い方のまま）。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, at, text, arrow, rr, shape, track, ramp, clamp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const doc = () => { // 申込書
      rr(ctx, -32, -46, 64, 92, 8); shape(ctx, C.white);
      ctx.lineCap = "round";
      for (const y of [-24, -8, 8]) { ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(18, y); shape(ctx, null, C.light, 6); }
      ctx.beginPath(); ctx.moveTo(-18, 28); ctx.lineTo(2, 28); shape(ctx, null, C.blue, 6);
    };
    const embed = () => { // サイトに決済を組み込む（画面の中にカード）
      rr(ctx, -48, -38, 96, 76, 10); shape(ctx, C.white);
      ctx.beginPath(); ctx.rect(-48, -38, 96, 20); shape(ctx, C.blue, null);
      rr(ctx, -48, -38, 96, 76, 10); shape(ctx, null);
      at(ctx, 0, 10, 0.55, 1, () => ICON.card(ctx));
    };
    const test = () => { // テスト：カードで試して、通る
      at(ctx, -6, 4, 0.9, 1, () => ICON.card(ctx));
      at(ctx, 34, -26, 0.7, 1, () => ICON.check(ctx));
    };
    const X = [150, 350, 550];
    const NODES = [
      { p: [X[0], 112], label: "申し込み", icon: doc },
      { p: [X[1], 112], label: "審査", icon: () => ICON.magnifier(ctx) },
      { p: [X[2], 112], label: "契約", icon: () => ICON.check(ctx) },
      { p: [X[0], 392], label: "組み込み", icon: embed },
      { p: [X[1], 392], label: "テスト", icon: test },
      { p: [X[2], 392], label: "公開", icon: () => ICON.shop(ctx) },
    ];
    const T0 = 0.5, GAP = 1.2, END = 7.8; // 手順 n は T0 + GAP*n 秒から
    const start = (n) => T0 + GAP * n;
    // 登場
    NODES.forEach((n, i) => {
      const s = track(t, start(i), SNAP);
      // 見ている手順だけ濃く（見る場所を 1 か所に）。最後に全部戻す
      const nextT = i < 5 ? start(i + 1) : Infinity;
      const dim = t >= nextT ? 1 - 0.55 * ramp(t, nextT, nextT + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      const pulse = 1 + 0.1 * Math.max(0, Math.sin(Math.PI * clamp((t - start(i)) / 0.5)));
      ctx.save(); ctx.globalAlpha = dim;
      at(ctx, n.p[0], n.p[1], s * 1.05 * pulse, s, () => n.icon());
      at(ctx, n.p[0], n.p[1] + 94, 1, ramp(t, start(i) + 0.1, start(i) + 0.4), () => text(ctx, n.label, 0, 0, { size: 40 }));
      ctx.restore();
    });
    // 手順どうしをつなぐ矢印（次の手順が出る少し前に伸びる）
    const link = (i, a, b, opt = {}) => {
      const nextT = i < 4 ? start(i + 1) : Infinity;
      const dim = t >= nextT ? 1 - 0.55 * ramp(t, nextT, nextT + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save(); ctx.globalAlpha = dim;
      arrow(ctx, a, b, track(t, start(i + 1) - 0.35, HEAVY), { color: C.blue, width: 6, ...opt });
      ctx.restore();
    };
    link(0, [X[0] + 62, 112], [X[1] - 62, 112]);
    link(1, [X[1] + 62, 112], [X[2] - 62, 112]);
    link(2, [X[2], 246], [X[0], 314], { ctrl: [X[0], 246] });
    link(3, [X[0] + 62, 392], [X[1] - 62, 392]);
    link(4, [X[1] + 62, 392], [X[2] - 62, 392]);
    // 審査のあいだ、時計が回る（数日から数週間）
    const c = track(t, start(1) + 0.3, PLAY);
    const hold = 1 - ramp(t, start(2), start(2) + 0.3) * (1 - ramp(t, END, END + 0.4)) * 0.45;
    ctx.save(); ctx.globalAlpha = hold;
    at(ctx, X[1] + 62, 112 - 52, c * 0.7, c, () => ICON.clock(ctx, clamp((t - start(1) - 0.3) / (GAP - 0.2))));
    ctx.restore();
    // 公開できたら、チェック
    const ok = track(t, start(5) + 0.5, PLAY);
    at(ctx, X[2] + 56, 392 - 54, ok * 1.0, ok, () => ICON.check(ctx));

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 880, h: 330, blinkAt: [0.3, 9.4] });
  },
});
