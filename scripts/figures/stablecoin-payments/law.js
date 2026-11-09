// 日本の資金決済法での区分（本文「日本での位置づけ」）。
// 法令上の要件を満たして発行された円のステーブルコイン（チェックの印つき）は「電子決済手段」、ビットコインなどは「暗号資産」。
// 価格が円に連動しているように見えても、仕組みによっては暗号資産などとして扱われる（印のない青いコインが右へ）。
// 文字は 3 か所まで（2 つの箱の名前と、途中だけ出る すてぶるくんの吹き出し）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, COIN, ICON, at, text, rr, shape, bubble, along, track, ramp, clamp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const O = [390, 84]; // コインが出てくる場所（2 つの区分の間の真上）
    const BIN = [{ x: 230, label: "電子決済手段", at: 0.0, fill: C.white }, { x: 550, label: "暗号資産など", at: 0.25, fill: C.silver }];
    const TOP = 196, BOT = 478, BW = 270;

    // 区分の枠（コインより奥）。名前は下に
    for (const b of BIN) {
      const s = track(t, b.at, SNAP);
      at(ctx, b.x, (TOP + BOT) / 2, s, s, () => {
        const h = BOT - TOP;
        rr(ctx, -BW / 2, -h / 2, BW, h, 18); shape(ctx, b.fill);
        text(ctx, b.label, 0, h / 2 - 46, { size: 38 });
      });
    }

    const coins = [
      { kind: "stable", badge: true, show: 0.9, go: 1.7, to: [230, 312] },
      { kind: "crypto", badge: false, show: 3.0, go: 3.7, to: [500, 312] },
      { kind: "stable", badge: false, show: 5.0, go: 7.0, to: [600, 312] },
    ];
    let watch = null;
    for (const c of coins) {
      const s = track(t, c.show, PLAY);
      if (s <= 0) continue;
      const u = track(t, c.go, HEAVY);
      const p = along(O, c.to, u, [c.to[0], O[1]]);
      // 3 つめは、出てきてから迷うように揺れる
      const wob = c.kind === "stable" && !c.badge ? 0.22 * Math.sin((t - 5.3) * 7) * clamp((t - 5.3) / 0.3) * (1 - ramp(t, 6.4, 6.9)) : 0;
      at(ctx, p[0], p[1], s * 1.5, 1, () => {
        ctx.rotate(wob);
        COIN[c.kind](ctx);
        if (c.badge) at(ctx, 26, -26, 0.5, 1, () => ICON.check(ctx));
      });
      if (t < c.go + 0.8) watch = p;
    }

    // すてぶるくんの問い（3 つめのコインが迷っている間だけ）
    const q = ramp(t, 5.4, 5.7) * (1 - ramp(t, 6.9, 7.2));
    at(ctx, 0, 0, 1, q, () => bubble(ctx, "どっち？", 246, 82, { size: 34, tail: -64 }));

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.25] });
    const dx = watch ? watch[0] - 104 : 0;
    drawKun(ctx, t, { x: 104, y: 118, w: 150, eyes: dx > 120 ? "right" : "open", mouth: q > 0.5 ? "talk-o" : "rest", blinkAt: [2.4, 8.6] });
  },
});
