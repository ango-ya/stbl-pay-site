// カード決済を導入する 3 つの方法（本文「クレジットカード決済を導入する 3 つの方法と、向き不向き」の表の要点）。
// 決済代行：契約は 1 つで、複数のカードブランドをまとめて扱う。作成サービス：サービスに決済が付いている。直接契約：ブランドごとに契約する。
// 文字は 3 か所（各行の名前）。お金の流れの線にすてぶるペイ・運営は入れない。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, at, text, arrow, rr, shape, track, ramp, SNAP, HEAVY, drawChan } = FX;
    // 決済代行の絵（1 つの窓口から、いくつもの先へ分かれる箱）
    const psp = () => {
      rr(ctx, -46, -38, 92, 76, 16); shape(ctx, C.blue);
      ctx.beginPath(); ctx.arc(-20, 0, 9, 0, Math.PI * 2); shape(ctx, C.white, null);
      ctx.lineCap = "round";
      for (const dy of [-20, 0, 20]) {
        ctx.beginPath(); ctx.moveTo(-12, dy * 0.3); ctx.lineTo(22, dy); shape(ctx, null, C.white, 5);
        ctx.beginPath(); ctx.arc(26, dy, 5, 0, Math.PI * 2); shape(ctx, C.white, null);
      }
    };
    // ネットショップ作成サービスの絵（画面の中にカート）
    const service = () => {
      rr(ctx, -48, -38, 96, 76, 10); shape(ctx, C.white);
      ctx.beginPath(); ctx.rect(-48, -38, 96, 20); shape(ctx, C.blue, null);
      rr(ctx, -48, -38, 96, 76, 10); shape(ctx, null);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(-14, -4); ctx.lineTo(-8, 20); ctx.lineTo(22, 20); ctx.lineTo(28, 2); ctx.lineTo(-12, 2); shape(ctx, null, C.navy, 6);
      for (const x of [-4, 18]) { ctx.beginPath(); ctx.arc(x, 30, 4, 0, Math.PI * 2); shape(ctx, C.navy, null); }
    };
    const SHOP_X = 372, MID_X = 520, CARD_X = 654, S = 1.0;
    const ROWS = [
      { y: 100, start: 0.2, label: "決済代行" },
      { y: 268, start: 2.5, label: "作成サービス" },
      { y: 438, start: 4.9, label: "直接契約" },
    ];
    const END = 7.5;

    ROWS.forEach((r, i) => {
      const s0 = r.start, y = r.y, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      const pop = (d) => track(t, s0 + d, SNAP);
      ctx.save();
      ctx.globalAlpha = dim;
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, SHOP_X, y, pop(0.05) * S, pop(0.05), () => ICON.shop(ctx));
      if (i < 2) {
        // 契約先は 1 つ。そこから複数のカードブランドへ
        at(ctx, MID_X, y, pop(0.15), pop(0.15), () => (i === 0 ? psp() : service()));
        at(ctx, CARD_X, y, pop(0.3) * 0.75, pop(0.3), () => ICON.card(ctx));
        arrow(ctx, [SHOP_X + 58, y], [MID_X - 58, y], track(t, s0 + 0.7, HEAVY), { color: C.blue, width: 6 });
        arrow(ctx, [MID_X + 58, y], [CARD_X - 48, y], track(t, s0 + 1.3, HEAVY), { color: C.gray, width: 5, dash: [2, 12] });
      } else {
        // 直接契約：ブランドごとにカード会社と契約する（3 本の線）
        [-1, 0, 1].forEach((k, j) => {
          const yy = y + k * 56;
          at(ctx, MID_X, yy, pop(0.15 + j * 0.1) * 0.55, pop(0.15 + j * 0.1), () => ICON.bank(ctx));
          at(ctx, CARD_X, yy, pop(0.3 + j * 0.1) * 0.55, pop(0.3 + j * 0.1), () => ICON.card(ctx));
          arrow(ctx, [SHOP_X + 58, y + k * 10], [MID_X - 38, yy], track(t, s0 + 0.7 + j * 0.3, HEAVY), { color: C.blue, width: 5 });
          arrow(ctx, [MID_X + 38, yy], [CARD_X - 38, yy], track(t, s0 + 1.6 + j * 0.2, HEAVY), { color: C.gray, width: 4, dash: [2, 10] });
        });
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 880, h: 330, blinkAt: [0.3, 8.4] });
  },
});
