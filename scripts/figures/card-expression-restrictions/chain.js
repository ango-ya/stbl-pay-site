// カード決済の鎖（本文「カード決済の契約の仕組み」）。
// 国際カードブランド → アクワイアラー → 決済代行会社 → お店。どれか 1 社が取り扱いをやめると、その先のお店では、カードが使えなくなる。
// 取り扱いの確認（青い確認の印）が上から下へ渡っていき、1 回めはお店まで届き、2 回めは途中の 1 社で止まる。どの会社かは決めない（真ん中の 1 社を例にしている）。文字は 3 か所。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const X = 112, S = 0.9, STOP = 1; // STOP：止まる会社の行（アクワイアラー）
    const ROWS = [
      { y: 76, icon: "card", label: "カードブランド" },
      { y: 206, icon: "bank", label: "アクワイアラー" },
      { y: 336, icon: "hub", label: "決済代行" },
      { y: 466, icon: "shop", label: null },
    ];
    const hub = () => {
      ctx.lineCap = "round";
      for (const [dx, dy] of [[-42, -26], [42, -26], [-42, 26], [42, 26]]) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); shape(ctx, null, C.navy, 5);
        ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); shape(ctx, C.white);
      }
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); shape(ctx, C.blue);
    };
    const stopMark = () => {
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); shape(ctx, C.navy, C.white, 4);
      rr(ctx, -15, -5, 30, 10, 3); shape(ctx, C.white, null);
    };
    const icons = { card: () => ICON.card(ctx), bank: () => ICON.bank(ctx), hub, shop: () => ICON.shop(ctx) };
    const stopped = ramp(t, 7.2, 7.6); // 止まったあと、その先の行は薄くなる

    ROWS.forEach((r, i) => {
      const s = track(t, i * 0.3, SNAP);
      ctx.save();
      ctx.globalAlpha = i > STOP ? 1 - 0.55 * stopped : 1;
      at(ctx, X, r.y, s * S, s, icons[r.icon]);
      if (r.label) at(ctx, X + 86, r.y, 1, ramp(t, i * 0.3 + 0.1, i * 0.3 + 0.4), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      ctx.restore();
    });
    // 鎖のつなぎの矢印。止まったあとは、アクワイアラーより先が点線の灰色になる
    for (let i = 0; i < ROWS.length - 1; i++) {
      const cut = i >= STOP && stopped > 0.5;
      ctx.save();
      ctx.globalAlpha = i >= STOP ? 1 - 0.55 * stopped : 1;
      arrow(ctx, [X, ROWS[i].y + 48], [X, ROWS[i + 1].y - 48], ramp(t, 0.8 + i * 0.25, 1.1 + i * 0.25), { color: cut ? C.gray : C.blue, width: 6, dash: cut ? [2, 12] : null });
      ctx.restore();
    }

    // 確認の印が、すき間をたどって下りていく（p は 0〜3 の行の番号。小数は行の間）
    const at_ = (p) => [X + 66, lerp(ROWS[Math.min(Math.floor(p), 2)].y, ROWS[Math.min(Math.floor(p), 2) + 1].y, p - Math.min(Math.floor(p), 2))];
    const trip = (start, to, gone) => {
      const s = track(t, start - 0.2, PLAY) * (1 - gone);
      if (s <= 0) return;
      const p = at_(to * track(t, start, HEAVY));
      at(ctx, p[0], p[1], s * 0.85, 1, () => ICON.check(ctx));
    };
    trip(1.6, 3, ramp(t, 4.3, 4.6));   // 1 回め：お店まで届く
    trip(5.8, STOP, ramp(t, 7.2, 7.5)); // 2 回め：アクワイアラーで止まる

    // お店のカード：1 回めの確認のあとは使える（確認の印）。止まったあとは「止まった」印に替わる
    const SHOP_Y = ROWS[3].y;
    ctx.save();
    ctx.globalAlpha = 1 - 0.55 * stopped;
    const cs = track(t, 3.9, PLAY);
    at(ctx, X + 150, SHOP_Y + 6, cs * 0.8, cs, () => ICON.card(ctx));
    ctx.restore();
    const ck = track(t, 4.3, PLAY) * (1 - ramp(t, 7.2, 7.4));
    at(ctx, X + 190, SHOP_Y - 28, ck * 0.8, ck, () => ICON.check(ctx));
    const st = track(t, 7.2, PLAY);
    at(ctx, X + 190, SHOP_Y - 28, st * 0.85, st, stopMark);
    // 止まった会社の印
    const st2 = track(t, 7.0, PLAY);
    at(ctx, X + 62, ROWS[STOP].y - 40, st2 * 0.95, st2, stopMark);

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 600, floor: 532, w: 112, eyes: t > 6 && t < 8.5 ? "left" : "open", mouth: t > 7.0 && t < 7.8 ? "o" : "rest", blinkAt: [2.4, 9.4] });
  },
});
