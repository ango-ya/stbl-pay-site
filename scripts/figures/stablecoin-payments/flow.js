// ステーブルコイン決済の流れ（本文「ステーブルコイン決済の仕組み」の 1〜3）。
// 購入者の円が発行体の窓口でステーブルコインになって購入者に戻り、購入者からお店へ送られてブロックチェーンに記録され、確定する。
// 文字は 3 か所（購入者・発行体の窓口・お店）。お金はアイコン（¥ のお札＝円、青いコイン＝ステーブルコイン）で表す。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, track, ramp, lerp, SNAP, STD, HEAVY, PLAY, drawChan, drawKun } = FX;
    const BUY = [150, 350], WIN = [400, 128], SHOP = [600, 350];
    const S = 1.45; // アイコンの大きさ
    const A1 = { a: [BUY[0] + 16, BUY[1] - 96], b: [WIN[0] - 94, WIN[1] + 6], ctrl: [BUY[0] + 16, WIN[1] + 6] };
    const A2 = { a: [WIN[0] + 4, WIN[1] + 82], b: [BUY[0] + 66, BUY[1] - 34], ctrl: [WIN[0] + 4, BUY[1] - 34] };
    const L3 = { a: [BUY[0] + 62, BUY[1] + 30], b: [SHOP[0] - 92, SHOP[1] + 30] };
    const REST_BUY = [BUY[0] + 52, BUY[1] - 100], REST_SHOP = [SHOP[0] - 52, SHOP[1] - 110];

    // 登場（購入者 → 窓口 → お店）。窓口の名前だけ、矢印と重ならないよう右に置く
    const node = (p, start, icon, label, side = false) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      const a = ramp(t, start + 0.1, start + 0.4);
      if (side) at(ctx, p[0] + 96, p[1] + 8, 1, a, () => text(ctx, label, 0, 0, { size: 40, align: "left" }));
      else at(ctx, p[0], p[1] + 112, 1, a, () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(BUY, 0.0, "phone", "購入者");
    node(WIN, 0.35, "bank", "発行体の窓口", true);
    node(SHOP, 0.7, "shop", "お店");

    // 1. 円が窓口へ
    const u1 = track(t, 2.0, HEAVY);
    arrow(ctx, A1.a, A1.b, u1, { ctrl: A1.ctrl, color: C.gray, width: 6 });
    // 2. 窓口でステーブルコインに替わり、購入者へ
    const u2 = track(t, 3.9, HEAVY);
    arrow(ctx, A2.a, A2.b, u2, { ctrl: A2.ctrl, color: C.blue, width: 6 });
    // 3. 購入者からお店へ。通ったところがブロックチェーンに記録される
    const u3 = track(t, 5.4, HEAVY);
    arrow(ctx, L3.a, L3.b, u3, { color: C.blue, width: 6 });
    at(ctx, lerp(L3.a[0], L3.b[0], 0.5), L3.a[1] + 44, 1.3, 1, () => ICON.chain(ctx, u3 * 3.4 - 0.2));

    let coin = null;
    if (t < 3.15) {
      const pop = track(t, 1.4, PLAY);
      const pos = along(A1.a, A1.b, u1, A1.ctrl);
      const s = pop * (1 - ramp(t, 2.95, 3.15));
      at(ctx, pos[0], pos[1], s * 1.3, 1, () => COIN.yen(ctx));
      coin = pos;
    }
    if (t >= 3.0) {
      const s = track(t, 3.05, PLAY);
      let pos = [WIN[0], WIN[1] + 6];
      if (u2 > 0) pos = along(A2.a, A2.b, u2, A2.ctrl);
      if (u2 > 0.999) pos = [lerp(A2.b[0], REST_BUY[0], ramp(t, 4.6, 4.9)), lerp(A2.b[1], REST_BUY[1], ramp(t, 4.6, 4.9))];
      if (u3 > 0) pos = [lerp(REST_BUY[0], REST_SHOP[0], u3), lerp(REST_BUY[1], REST_SHOP[1], u3) - Math.sin(Math.PI * u3) * 40];
      at(ctx, pos[0], pos[1], s * 1.3, 1, () => COIN.stable(ctx));
      coin = pos;
    }
    // 4. 確定（取り消せない）
    const ok = track(t, 6.6, PLAY);
    at(ctx, SHOP[0] + 58, SHOP[1] - 110, ok * 1.3, ok, () => ICON.check(ctx));

    // すてぶるちゃん（右下。手のひらで図を示す）・すてぶるくん（下の床に立って、お金を目で追う）
    drawChan(ctx, t, { pose: t < 1.3 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.8] });
    const dx = coin ? coin[0] - 372 : 0;
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: dx > 60 ? "right" : dx < -60 ? "left" : "open", mouth: t > 3.05 && t < 3.9 ? "o" : "rest", blinkAt: [1.0, 8.2] });
  },
});
