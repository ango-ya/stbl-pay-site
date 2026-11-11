// 銀行振込の受け取り方 3 つ（本文「銀行振込の受け取り方を比べる」の表）。
// 自分の口座：入金の明細を、お店が手で突き合わせる（虫眼鏡）。決済サービス：自動で照合される（チェック）が、小さくずれが残る（! の印）。
// 注文ごとに届く：注文の伝票と青いコインが一緒に届き、突き合わせがない（チェック）。文字は 3 か所（行の名前）。運営はお金の流れの線に描かない。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const S = 0.95;
    const ROWS = [
      { y: 92, start: 0.3, label: "自分の\n口座" },
      { y: 232, start: 3.2, label: "決済\nサービス" },
      { y: 374, start: 6.0, label: "注文ごとに\n届く" },
    ];
    const SRC = 300, A0 = 360, A1 = 440, RES = 520;

    const paper = (band) => { // 入金の明細（線）と、注文の伝票（青い帯）
      rr(ctx, -28, -36, 56, 72, 6); shape(ctx, C.white);
      if (band) { ctx.beginPath(); ctx.rect(-25, -33, 50, 16); shape(ctx, C.blue, null); }
      ctx.lineCap = "round";
      for (const y of band ? [2, 16] : [-18, -4, 10, 24]) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); shape(ctx, null, C.light, 5); }
    };
    const tags = () => { // 注文ごとの口座の番号札
      for (const [x, y] of [[0, 0], [10, 17]]) { rr(ctx, x - 14, y - 8, 28, 16, 4); shape(ctx, C.light, C.navy, 3); }
    };
    const warn = () => { // ずれの印
      ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(30, 24); ctx.lineTo(-30, 24); ctx.closePath(); shape(ctx, C.white, C.navy, 6);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 7); shape(ctx, null, C.navy, 6);
      ctx.beginPath(); ctx.arc(0, 16, 2, 0, Math.PI * 2); shape(ctx, C.navy, C.navy, 3);
    };

    ROWS.forEach((r, i) => {
      const s0 = r.start, y = r.y;
      const pop = (d) => track(t, s0 + d, SNAP);
      at(ctx, 30, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      if (i < 2) {
        at(ctx, SRC, y, pop(0.1) * S, pop(0.1), () => ICON.bank(ctx));
        if (i === 1) at(ctx, SRC + 52, y + 34, pop(0.3) * S, pop(0.3), tags);
        const u = track(t, s0 + 0.7, HEAVY);
        arrow(ctx, [A0, y], [A1, y], u, { color: C.gray, width: 6 });
        at(ctx, RES, y, pop(0.9) * S, pop(0.9), () => paper(false));
        if (i === 0) {
          const m = track(t, s0 + 1.8, PLAY);
          at(ctx, RES + 40, y + 22, m * 0.8, m, () => ICON.magnifier(ctx));
        } else {
          const ok = track(t, s0 + 1.6, PLAY);
          at(ctx, RES + 56, y - 30, ok * 0.8, ok, () => ICON.check(ctx));
          const w = track(t, s0 + 2.2, PLAY);
          at(ctx, RES + 56, y + 32, w * 0.75, w, warn);
        }
      } else {
        at(ctx, RES + 8, y, pop(0.1) * S, pop(0.1), () => ICON.shop(ctx));
        const u = track(t, s0 + 0.8, HEAVY);
        arrow(ctx, [A0 + 6, y], [A1 + 10, y], u, { color: C.blue, width: 6 });
        const c = track(t, s0 + 0.5, PLAY);
        // 注文の伝票と青いコインがそろい、コインが矢印の上を注文ごとにお店へ進む
        at(ctx, SRC - 22, y, pop(0.1) * 0.85, pop(0.1), () => paper(true));
        at(ctx, SRC + 24, y + 8, pop(0.2) * 0.95, pop(0.2), () => COIN.stable(ctx));
        const x = lerp(A0, A1 + 6, u);
        at(ctx, x, y - 46, c * 0.75, c * (1 - ramp(t, s0 + 1.9, s0 + 2.2)), () => COIN.stable(ctx));
        const ok = track(t, s0 + 2.0, PLAY);
        at(ctx, RES + 70, y - 34, ok * 0.8, ok, () => ICON.check(ctx));
      }
    });

    drawChan(ctx, t, { mouth: 2, pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 612, floor: 532, w: 112, eyes: t > 6.0 && t < 8.5 ? "left" : "open", mouth: t > 6.8 && t < 7.6 ? "o" : "rest", blinkAt: [1.6, 9.0] });
  },
});
