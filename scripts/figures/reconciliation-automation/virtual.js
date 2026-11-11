// バーチャル口座（本文「バーチャル口座で減らせること・残ること」）。
// 代表口座の下に、注文ごとの小さな口座（番号札）が並ぶ。振込がそれぞれの札に入り、額が合えばチェックが付く。
// 最後の 1 つは額が足りない振込が入り、過不足の印が付いてチェックの付かないまま残る。文字は 2 か所（注文ごとの口座・過不足は残る）。
FX.figure({
  duration: 9,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const ROWS = [140, 235, 330];
    const RX = 250, RW = 330; // 札の左端と幅
    const SLOT = [440, 536]; // 札の中の、振込が入る欄（左端・右端）
    const BANK = [110, 235];

    const tag = (i) => () => {
      rr(ctx, 0, -33, RW, 66, 10); shape(ctx, C.white);
      ctx.beginPath(); ctx.arc(26, 0, 8, 0, Math.PI * 2); shape(ctx, C.bg, C.navy, 4);
      rr(ctx, 54, -6, 90 - i * 10, 12, 6); shape(ctx, C.navy, null);
      rr(ctx, 54, 14, 56, 8, 4); shape(ctx, C.light, null);
      ctx.save(); ctx.setLineDash([8, 6]); rr(ctx, SLOT[0] - RX, -24, SLOT[1] - SLOT[0], 48, 6); shape(ctx, null, C.gray, 3); ctx.restore();
    };

    // 代表口座と、そこから分かれる注文ごとの口座
    const b = track(t, 0.0, SNAP);
    at(ctx, BANK[0], BANK[1], b * 1.3, b, () => ICON.bank(ctx));
    const u = track(t, 0.3, HEAVY);
    arrow(ctx, [BANK[0] + 68, BANK[1]], [208, BANK[1]], Math.min(u, 1), { color: C.gray, width: 6, head: false });
    arrow(ctx, [208, ROWS[0]], [208, ROWS[2]], Math.min(u, 1), { color: C.gray, width: 6, head: false });
    ROWS.forEach((y, i) => {
      const s = track(t, 0.5 + i * 0.3, SNAP);
      arrow(ctx, [208, y], [RX - 4, y], Math.min(s, 1), { color: C.gray, width: 6, head: false });
      at(ctx, RX + RW / 2, y, s, s, () => at(ctx, -RW / 2, 0, 1, 1, tag(i)));
    });
    at(ctx, 415, 58, 1, ramp(t, 1.4, 1.7), () => text(ctx, "注文ごとの口座", 0, 0, { size: 40 }));

    // 振込：右から札の欄へ。1・2 つめは額が合ってチェック、3 つめは額が足りない
    const START = [2.4, 3.4, 4.6];
    START.forEach((s, i) => {
      if (t < s) return;
      const p = ramp(t, s, s + 0.7), short = i === 2;
      const sc = short ? 0.6 : 1.1;
      const home = short ? SLOT[0] + 36 * sc + 6 : (SLOT[0] + SLOT[1]) / 2;
      at(ctx, lerp(640, home, p), ROWS[i], sc, 1, () => COIN.yen(ctx));
      if (!short) {
        const k = track(t, s + 0.8, PLAY);
        at(ctx, RX + RW - 12, ROWS[i] - 33 + 2, k * 0.85, k, () => ICON.check(ctx));
      }
    });
    // 過不足の印（足りない分の欄が空いたまま）
    const mk = track(t, 5.5, PLAY);
    at(ctx, RX + RW - 12, ROWS[2] - 33 + 2, mk * 0.85, mk, () => {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); shape(ctx, C.white, C.blue, 6);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 4); shape(ctx, null, C.blue, 7);
      ctx.beginPath(); ctx.arc(0, 15, 4, 0, Math.PI * 2); shape(ctx, C.blue, null);
    });
    at(ctx, 430, 435, 1, ramp(t, 5.9, 6.2), () => text(ctx, "過不足は残る", 0, 0, { size: 40 }));

    drawChan(ctx, t, { mouth: 2, pose: t < 0.5 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 120, floor: 532, w: 112, eyes: t > 5.4 ? "wide" : t > 2.3 ? "right" : "open", mouth: t > 5.5 && t < 6.3 ? "o" : "rest", blinkAt: [1.0, 7.6] });
  },
});
