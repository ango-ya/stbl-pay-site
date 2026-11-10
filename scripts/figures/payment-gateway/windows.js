// 決済代行を使うと窓口が 1 つになる（本文「決済代行とは？」「アクワイアラーと直接契約する場合との違い」）。
// 直接契約：お店がカード会社ごとに契約し、入金の日もばらばら。決済代行：契約は 1 つで、入金はまとめて届く。
// 文字は 2 か所（各行の名前）。お金の流れの線にすてぶるペイ・運営は入れない。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, rr, shape, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    // 決済代行の絵：1 つの窓口から、いくつもの先へ分かれる箱
    const psp = () => {
      rr(ctx, -46, -38, 92, 76, 16); shape(ctx, C.blue);
      ctx.beginPath(); ctx.arc(-20, 0, 9, 0, Math.PI * 2); shape(ctx, C.white, null);
      ctx.lineCap = "round";
      for (const dy of [-20, 0, 20]) {
        ctx.beginPath(); ctx.moveTo(-12, dy * 0.3); ctx.lineTo(22, dy); shape(ctx, null, C.white, 5);
        ctx.beginPath(); ctx.arc(26, dy, 5, 0, Math.PI * 2); shape(ctx, C.white, null);
      }
    };
    const SHOP_X = 290, CARD_X = 640, PSP_X = 465, S = 1.05, CS = 0.7, GAP = 60;
    const END = 8.4; // 2 行目が終わったら、全部の行を元の濃さに戻す
    const ROWS = [{ y: 150, start: 0.2, label: "直接契約" }, { y: 388, start: 4.8, label: "決済代行" }];

    ROWS.forEach((r, i) => {
      const s0 = r.start, y = r.y, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      const pop = (d) => track(t, s0 + d, SNAP);
      ctx.save();
      ctx.globalAlpha = dim;
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, SHOP_X, y, pop(0.05) * S, pop(0.05), () => ICON.shop(ctx));
      const cards = [-1, 0, 1].map((k) => [CARD_X, y + k * GAP]);
      cards.forEach((c, k) => at(ctx, c[0], c[1], pop(0.2 + k * 0.1) * CS, pop(0.2 + k * 0.1), () => ICON.card(ctx)));

      if (i === 0) {
        // 直接契約：お店からカード会社ごとに申し込む。入金は 1 社ずつ、別の日に届く
        cards.forEach((c, k) => arrow(ctx, [SHOP_X + 58, y + (k - 1) * 8], [c[0] - 46, c[1]], track(t, s0 + 0.9 + k * 0.3, HEAVY), { color: C.gray, width: 5, dash: [2, 12] }));
        cards.forEach((c, k) => {
          const u = track(t, s0 + 2.2 + k * 0.85, HEAVY), rest = [SHOP_X - 50 + k * 50, y - 72];
          const p = Math.max(0, track(t, s0 + 1.9 + k * 0.85, PLAY));
          at(ctx, lerp(c[0] - 30, rest[0], u), lerp(c[1], rest[1], u) - Math.sin(Math.PI * Math.min(1, u)) * 18, p * 0.7, p, () => COIN.yen(ctx));
        });
      } else {
        // 決済代行：契約は 1 つ。代行が各カード会社へつなぎ、入金はまとめて届く
        at(ctx, PSP_X, y, pop(0.15), pop(0.15), () => psp());
        arrow(ctx, [SHOP_X + 58, y], [PSP_X - 56, y], track(t, s0 + 0.7, HEAVY), { color: C.blue, width: 6 });
        cards.forEach((c, k) => arrow(ctx, [PSP_X + 56, y + (k - 1) * 8], [c[0] - 46, c[1]], track(t, s0 + 1.2, HEAVY), { color: C.gray, width: 5, dash: [2, 12] }));
        const u = track(t, s0 + 2.5, HEAVY), p = Math.max(0, track(t, s0 + 2.2, PLAY));
        at(ctx, lerp(PSP_X, SHOP_X + 40, u), lerp(y - 4, y - 70, u) - Math.sin(Math.PI * Math.min(1, u)) * 22, p * 1.0, p, () => COIN.yen(ctx));
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3, 8.9] });
  },
});
