// カード決済のお金の流れ（本文「決済代行の仕組みとお金の流れ」の 1〜4）。
// 購入者がお店でカードを使う → アクワイアラーが代金を立て替えて、手数料を差し引いてお店に入金 → 取引の情報がイシュアへ → イシュアが購入者に請求し、購入者が支払う。
// 文字は 3 か所（アクワイアラー・イシュア・立て替え）。購入者・お店は絵だけ。運営も決済代行も、この線には入れない。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const BUY = [170, 408], SHOP = [170, 150], ACQ = [520, 150], ISS = [520, 408];
    const S = 1.2;
    // 登場：購入者 → お店 → アクワイアラー → イシュア
    const node = (p, start, icon, label, dy) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      if (label) at(ctx, p[0], p[1] + dy, 1, ramp(t, start + 0.1, start + 0.4), () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(BUY, 0.0, "phone");
    node(SHOP, 0.25, "shop");
    node(ACQ, 0.5, "bank", "アクワイアラー", -98);
    node(ISS, 0.75, "card", "イシュア", 84);

    // 「いま見る矢印」だけ濃く、前の矢印は薄く（見る場所を 1 か所に）。最後に全部を戻す
    const STEPS = [1.4, 3.0, 4.4, 5.6, 6.8], END = 8.0;
    const dim = (n) => { const next = STEPS[n + 1]; return next === undefined || t < next ? 1 : 1 - 0.6 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)); };
    const withDim = (n, fn) => { ctx.save(); ctx.globalAlpha = dim(n); fn(); ctx.restore(); };

    // 1. 購入者がカードで払う（購入者 → お店）
    const A1 = [[170, 336], [170, 226]];
    withDim(0, () => {
      const u = track(t, STEPS[0], HEAVY);
      arrow(ctx, A1[0], A1[1], u, { color: C.blue, width: 6 });
      const c = track(t, STEPS[0] - 0.2, PLAY) * (1 - ramp(t, STEPS[0] + 1.4, STEPS[0] + 1.7));
      const p = along(A1[0], A1[1], u);
      at(ctx, p[0] + 52, p[1], c * 0.55, c, () => ICON.card(ctx));
    });
    // 2. アクワイアラーが立て替え、差し引いた金額をお店に入金（アクワイアラー → お店）
    const A2 = [[448, 150], [250, 150]];
    withDim(1, () => {
      const u = track(t, STEPS[1], HEAVY);
      arrow(ctx, A2[0], A2[1], u, { color: C.blue, width: 6 });
      const c = track(t, STEPS[1] - 0.2, PLAY);
      at(ctx, lerp(440, 330, u), 102, c * 0.95, c, () => COIN.yen(ctx));
      at(ctx, 348, 200, 1, ramp(t, STEPS[1] + 0.3, STEPS[1] + 0.6), () => text(ctx, "立て替え", 0, 0, { size: 40 }));
    });
    // 3. 取引の情報がイシュアへ（アクワイアラー → イシュア）
    withDim(2, () => {
      const u = track(t, STEPS[2], HEAVY);
      arrow(ctx, [520, 222], [520, 330], u, { color: C.gray, width: 6, dash: [2, 12] });
    });
    // 4. イシュアが購入者に請求（イシュア → 購入者）。5. 購入者が支払う（購入者 → イシュア）
    withDim(3, () => {
      const u = track(t, STEPS[3], HEAVY);
      arrow(ctx, [458, 366], [236, 366], u, { color: C.gray, width: 6, dash: [2, 12] });
    });
    withDim(4, () => {
      const u = track(t, STEPS[4], HEAVY);
      arrow(ctx, [236, 448], [458, 448], u, { color: C.blue, width: 6 });
      const c = track(t, STEPS[4] - 0.2, PLAY);
      at(ctx, lerp(250, 346, u), 407, c * 0.7, c, () => COIN.yen(ctx));
    });

    drawChan(ctx, t, { pose: t < 0.9 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.4, 9.6] });
  },
});
