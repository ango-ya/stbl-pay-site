// カード決済・銀行振込・ステーブルコイン決済で、購入者とお店の間に何が入るか（本文「カード決済・銀行振込との違い」の表の要点）。
// カード：カード会社が立て替え、締め日を待ってお店に入金。銀行振込：銀行を通り、お店は入金を確かめる。
// ステーブルコイン：ブロックチェーンで送られ、確定した時点で届く。文字は 3 か所（各行の名前）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, track, ramp, lerp, clamp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const X = { buy: 300, mid: 456, shop: 612 }, S = 1.05;
    const ROWS = [
      { y: 104, start: 0.2, label: "カード", mid: "card", coin: "yen" },
      { y: 278, start: 3.0, label: "銀行振込", mid: "bank", coin: "yen" },
      { y: 452, start: 5.6, label: "ステーブル\nコイン", mid: "chain", coin: "stable" },
    ];
    const END = 7.6; // 3 行目が終わったら、全部の行を元の濃さに戻す

    ROWS.forEach((r, i) => {
      const s0 = r.start, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      // 見ている行だけ濃く（見る場所を 1 か所に）
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      const y = r.y;
      const pop = (d) => track(t, s0 + d, SNAP);
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, X.buy, y, pop(0.05) * S, pop(0.05), () => ICON.phone(ctx));
      at(ctx, X.shop, y, pop(0.2) * S, pop(0.2), () => ICON.shop(ctx));
      const u1 = track(t, s0 + 0.5, HEAVY);
      const a1 = [X.buy + 40, y], b1 = [X.mid - 62, y], a2 = [X.mid + 62, y], b2 = [X.shop - 66, y];

      if (r.mid === "card") {
        // 購入者はカードで払う（後払い）。カード会社が立て替え、締め日を待ってお店へ
        at(ctx, X.mid, y, pop(0.12) * S, pop(0.12), () => ICON.card(ctx));
        arrow(ctx, a1, b1, u1, { color: C.gray, width: 5, dash: [2, 12] });
        const w = track(t, s0 + 1.1, PLAY);
        at(ctx, X.mid, y - 66, w * 0.62, w, () => ICON.clock(ctx, 0.1 + 1.25 * clamp((t - s0 - 1.2) / 0.8)));
        const u2 = track(t, s0 + 2.0, HEAVY);
        arrow(ctx, a2, b2, u2, { color: C.blue, width: 6 });
        const c = track(t, s0 + 1.9, PLAY);
        at(ctx, lerp(X.mid, X.shop - 40, u2), lerp(y - 4, y - 66, u2), c * 0.95, c, () => COIN[r.coin](ctx));
      } else if (r.mid === "bank") {
        // 銀行を通ってお店へ。お店は入金を確かめる
        at(ctx, X.mid, y, pop(0.12) * S, pop(0.12), () => ICON.bank(ctx));
        arrow(ctx, a1, b1, u1, { color: C.blue, width: 6 });
        const u2 = track(t, s0 + 1.2, HEAVY);
        arrow(ctx, a2, b2, u2, { color: C.blue, width: 6 });
        const c = track(t, s0 + 0.4, PLAY);
        const x = u2 > 0 ? lerp(X.mid, X.shop - 40, u2) : lerp(X.buy + 30, X.mid, u1);
        const yy = u2 > 0 ? lerp(y - 66, y - 66, u2) : y - 66;
        at(ctx, x, yy, c * 0.95, c, () => COIN[r.coin](ctx));
        const m = track(t, s0 + 1.9, PLAY);
        at(ctx, X.shop + 50, y - 62, m * 0.62, m, () => ICON.magnifier(ctx));
      } else {
        // ブロックチェーンで送り、確定した時点でお店に届く
        const u2 = track(t, s0 + 1.0, HEAVY);
        arrow(ctx, a1, b2, Math.max(0, u1 * 0.5 + u2 * 0.5), { color: C.blue, width: 6 });
        at(ctx, X.mid, y + 2, 1.2, 1, () => ICON.chain(ctx, u1 * 3.4 - 0.2));
        const c = track(t, s0 + 0.4, PLAY);
        const x = lerp(X.buy + 30, X.shop - 40, u1 * 0.5 + u2 * 0.5);
        at(ctx, x, y - 66, c * 0.95, c, () => COIN[r.coin](ctx));
        const ok = track(t, s0 + 1.6, PLAY);
        at(ctx, X.shop + 50, y - 62, ok * 0.95, ok, () => ICON.check(ctx));
      }
      ctx.restore();
    });

    // すてぶるちゃん（右下。図を指さす）
    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
  },
});
