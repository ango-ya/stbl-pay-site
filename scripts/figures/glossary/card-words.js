// カード決済で出てくる言葉（用語集の「与信審査（加盟店審査）」「決済代行」「チャージバック」）。
// お店は決済を始めるときに与信審査を受け、カードの決済は決済代行を通ってお店に届く。購入者が異議を申し立てて認められると、代金が戻される（チャージバック）。
// 文字は 3 か所（与信審査・決済代行・チャージバック）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const BUY = [150, 270], HUB = [380, 270], SHOP = [610, 270], S = 1.3;
    // 決済代行：白い箱の中にカード
    const hub = () => {
      rr(ctx, -46, -46, 92, 92, 14); shape(ctx, C.white);
      at(ctx, 0, 0, 0.62, 1, () => ICON.card(ctx));
    };

    const pb = track(t, 0.0, SNAP), ph = track(t, 0.3, SNAP), ps = track(t, 0.6, SNAP);
    at(ctx, BUY[0], BUY[1], pb * S, pb, () => ICON.phone(ctx));
    at(ctx, HUB[0], HUB[1], ph * S, ph, hub);
    at(ctx, SHOP[0], SHOP[1], ps * S, ps, () => ICON.shop(ctx));

    // 1. 与信審査：お店が始めるときに見られる
    const q = track(t, 1.2, PLAY);
    at(ctx, SHOP[0], SHOP[1] - 158, 1, ramp(t, 1.2, 1.5), () => text(ctx, "与信審査", 0, 0, { size: 40 }));
    at(ctx, SHOP[0] + 58, SHOP[1] - 86, q * 0.8, q, () => ICON.magnifier(ctx));
    const ok = track(t, 2.4, PLAY);
    at(ctx, SHOP[0] - 56, SHOP[1] - 86, ok * 0.8, ok, () => ICON.check(ctx));

    // 2. 決済代行：カードの決済が通り、お店に届く
    at(ctx, HUB[0], HUB[1] - 158, 1, ramp(t, 3.0, 3.3), () => text(ctx, "決済代行", 0, 0, { size: 40 }));
    const A = { a: [BUY[0] + 66, BUY[1]], b: [HUB[0] - 66, HUB[1]] }, B = { a: [HUB[0] + 66, HUB[1]], b: [SHOP[0] - 70, SHOP[1]] };
    const u1 = track(t, 3.4, HEAVY), u2 = track(t, 4.4, HEAVY);
    arrow(ctx, A.a, A.b, u1, { color: C.blue, width: 6 });
    arrow(ctx, B.a, B.b, u2, { color: C.blue, width: 6 });

    // 3. チャージバック：認められると、代金がお店から戻される
    const R = { a: [SHOP[0], SHOP[1] + 92], b: [BUY[0] + 72, BUY[1] + 66], ctrl: [(SHOP[0] + BUY[0]) / 2, SHOP[1] + 240] };
    const u3 = track(t, 6.4, HEAVY);
    arrow(ctx, R.a, R.b, u3, { ctrl: R.ctrl, color: C.gray, width: 6, dash: [2, 12] });
    at(ctx, (SHOP[0] + BUY[0]) / 2, SHOP[1] + 196, 1, ramp(t, 6.0, 6.3), () => text(ctx, "チャージバック", 0, 0, { size: 36 }));

    // カード → 代行 → お店（円）。最後に、円が購入者へ戻る
    const cs = track(t, 3.2, PLAY);
    if (cs > 0 && t < 5.3) {
      let pos = lerp(A.a[0], A.b[0], u1);
      at(ctx, pos, BUY[1] - 66, cs * 0.8 * (1 - ramp(t, 4.4, 4.6)), 1, () => ICON.card(ctx));
    }
    const ys = track(t, 4.5, PLAY);
    if (ys > 0) at(ctx, lerp(B.a[0], SHOP[0], u2), SHOP[1] - 66, ys * (1 - ramp(t, 5.7, 6.0)), 1, () => COIN.yen(ctx));
    const yb = track(t, 6.4, PLAY);
    if (yb > 0) {
      let [x, y] = u3 > 0 ? along(R.a, R.b, u3, R.ctrl) : [SHOP[0], SHOP[1] + 92];
      if (u3 > 0.999) { const r = ramp(t, 7.9, 8.2); x = lerp(R.b[0], BUY[0], r); y = lerp(R.b[1], BUY[1] + 108, r); }
      at(ctx, x, y, yb * 1.0, 1, () => COIN.yen(ctx));
    }
    drawChan(ctx, t, { pose: t < 0.9 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.4] });
  },
});
