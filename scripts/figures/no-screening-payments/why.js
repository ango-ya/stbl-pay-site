// カード決済に加盟店審査がある理由（本文「カード決済に加盟店審査がある理由」）。
// カード会社は購入者の代金をいったん立て替えるので、契約の前にお店の事業の信頼性や営業の実態を調べる（虫めがね）。確かめられてから、お店に代金が届く。
// 文字は 3 か所（購入者・カード会社・お店）。お金は ¥ のお札（円）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = 255, BUY = [105, Y], CARD = [345, Y], SHOP = [592, Y], S = 1.55;
    const A1 = { a: [BUY[0] + 60, Y], b: [CARD[0] - 88, Y] };
    const A2 = { a: [CARD[0] + 88, Y], b: [SHOP[0] - 96, Y] };

    const node = (p, start, icon, label) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      at(ctx, p[0], p[1] + 116, 1, ramp(t, start + 0.1, start + 0.4), () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(BUY, 0.0, "phone", "購入者");
    node(CARD, 0.35, "card", "カード会社");
    node(SHOP, 0.7, "shop", "お店");

    // 購入者はカードで払う（点線）
    arrow(ctx, A1.a, A1.b, track(t, 1.6, HEAVY), { color: C.gray, width: 6, dash: [2, 12] });

    // カード会社が、お店を調べる（虫めがねが、お店の上を行き来して止まる）
    const REST = [SHOP[0] - 50, Y - 128];
    const m = track(t, 3.0, PLAY);
    const sweep = ramp(t, 3.0, 3.8);
    const wob = Math.sin((t - 3.8) * 9) * 14 * ramp(t, 3.8, 3.9) * (1 - ramp(t, 4.3, 4.6));
    const mag = [lerp(CARD[0] + 60, REST[0], sweep) + wob, lerp(Y - 128, REST[1], sweep)];
    at(ctx, mag[0], mag[1], m * 1.25, m, () => ICON.magnifier(ctx));
    // 調べ終わると、お店に確認の印
    const ok = track(t, 4.7, PLAY);
    at(ctx, SHOP[0] + 74, Y - 128, ok * 1.5, ok, () => ICON.check(ctx));

    // そのうえで、カード会社が代金を立て替えて、お店へ
    const u2 = track(t, 5.6, HEAVY);
    arrow(ctx, A2.a, A2.b, u2, { color: C.blue, width: 6 });
    const c = track(t, 5.3, PLAY);
    const pos = along(A2.a, A2.b, u2);
    at(ctx, pos[0], pos[1] - 60 * ramp(t, 5.6, 6.0), c * 1.15, c, () => COIN.yen(ctx));

    drawChan(ctx, t, { pose: t < 1.0 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.6] });
    const dx = t > 3.0 ? mag[0] - 440 : 0;
    drawKun(ctx, t, { x: 440, floor: 532, w: 120, eyes: dx > 60 ? "right" : dx < -60 ? "left" : "open", mouth: t > 3.0 && t < 4.0 ? "o" : "rest", blinkAt: [1.2, 8.0] });
  },
});
