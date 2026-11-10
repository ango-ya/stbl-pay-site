// 合法かどうかは法律で決まり、取り扱うかどうかは各社の規則と判断で決まる（本文「なぜクレジットカード（クレカ）の決済が止まるのか」「法律で違法になる範囲」）。
// 作品（本の絵）が、2 つの門を順に通る。法律の門：違法でなければ通る。違法なものは、どの決済手段でも通らない（禁止の印）。
// 各社の規則の門：法律を通った作品でも、規則と判断で止まることがある。特定の作品・会社は描かない。文字は 2 か所（2 つの門の名前）。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, at, text, rr, shape, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = 250, LAW = 250, RULE = 545, S = 1.25;

    // 門：壁とドア。open は 0（閉じる）〜 1（開く）。ドアは左のちょうつがいを軸に、横に縮んで開く
    const gate = (open, wall) => {
      rr(ctx, -64, -96, 128, 192, 12); shape(ctx, wall);
      rr(ctx, -34, -34, 68, 130, 6); shape(ctx, C.bg, C.navy, 4);
      const w = 68 * (1 - 0.88 * open);
      rr(ctx, -34, -34, w, 130, 6); shape(ctx, C.blue, C.navy, 4);
      if (open < 0.5) { ctx.beginPath(); ctx.arc(-34 + w - 12, 34, 5, 0, Math.PI * 2); shape(ctx, C.white, null); }
    };
    // 作品（開いた本。ページは色の帯だけ）
    const book = (fill) => {
      rr(ctx, -44, -30, 44, 60, 5); shape(ctx, fill);
      rr(ctx, 0, -30, 44, 60, 5); shape(ctx, fill);
      ctx.lineCap = "round";
      for (const y of [-14, -2, 10]) {
        ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(-10, y); shape(ctx, null, C.light, 4);
        ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(34, y); shape(ctx, null, C.light, 4);
      }
    };
    // 禁止の印
    const ban = () => {
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); shape(ctx, C.white, C.navy, 6);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-17, 17); ctx.lineTo(17, -17); shape(ctx, null, C.navy, 8);
    };

    // 法律の門は、合法な作品が通る間（1.7〜5.6）だけ開く。違法な作品が来る前に閉まる
    const lawArm = ramp(t, 1.5, 1.9) * (1 - ramp(t, 5.3, 5.7));
    const gl = track(t, 0.0, SNAP), gr = track(t, 0.25, SNAP);
    at(ctx, LAW, Y, gl * S, gl, () => gate(lawArm, C.white));
    at(ctx, RULE, Y, gr * S, gr, () => gate(0, C.silver));
    at(ctx, LAW, Y + 148, 1, ramp(t, 0.1, 0.4), () => text(ctx, "法律", 0, 0, { size: 40 }));
    at(ctx, RULE, Y + 148, 1, ramp(t, 0.35, 0.65), () => text(ctx, "各社の規則", 0, 0, { size: 40 }));

    // 合法な作品：法律の門を通り（確認の印）、各社の規則の門の前で止まる
    const s1 = track(t, 0.9, PLAY);
    const u1 = track(t, 1.6, HEAVY);
    const x1 = lerp(60, 402, u1);
    at(ctx, x1, Y + 6, s1 * 1.3, s1, () => book(C.white));
    const ok = track(t, 3.0, PLAY);
    at(ctx, x1 + 48, Y - 46, ok * 1.1, ok, () => ICON.check(ctx));

    // 違法な作品：法律の門で止まる。どの決済手段でも通らない
    const s2 = track(t, 6.0, PLAY);
    const u2 = track(t, 6.4, HEAVY);
    const x2 = lerp(50, 98, u2);
    at(ctx, x2, Y + 6, s2 * 1.3, s2, () => book(C.navy));
    const bn = track(t, 7.6, PLAY);
    at(ctx, x2 + 48, Y - 46, bn * 1.1, bn, ban);

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    const watch = t < 5.0 ? x1 : x2;
    const dx = watch - 120;
    drawKun(ctx, t, { x: 120, floor: 532, w: 120, eyes: dx > 60 ? "right" : "open", mouth: t > 3.0 && t < 3.6 ? "o" : "rest", blinkAt: [2.0, 9.0] });
  },
});
