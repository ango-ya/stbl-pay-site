// 加盟店審査と、個人がカードを作る審査は別物（本文「加盟店審査とは」）。
// 個人の審査：収入や支払いの履歴など、きちんと支払えるかを見る。加盟店審査：事業の信頼性や営業実態など、カード決済を受け付けるうえでのリスクを見る。
// 文字は 2 か所（2 つの審査の名前）。2 つの間は「≠」（絵）。
FX.figure({
  duration: 8,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, rr, shape, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const person = () => { // 個人（頭と肩）
      ctx.beginPath(); ctx.arc(0, -22, 20, 0, Math.PI * 2); shape(ctx, C.white);
      ctx.beginPath(); ctx.moveTo(-40, 44); ctx.quadraticCurveTo(-40, 6, 0, 6); ctx.quadraticCurveTo(40, 6, 40, 44); ctx.closePath(); shape(ctx, C.light);
    };
    const doc = () => { // 事業の書類・サイトの表示
      rr(ctx, -26, -38, 52, 76, 7); shape(ctx, C.white);
      ctx.lineCap = "round";
      for (const y of [-18, -2, 14]) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); shape(ctx, null, C.light, 5); }
    };
    const L = 165, R = 520, Y = 218; // 左右の列の中心（左：個人、右：加盟店）
    const col = (x, start, label, subject, extra) => {
      const p = (d) => track(t, start + d, SNAP);
      at(ctx, x, 414, 1, ramp(t, start, start + 0.3), () => text(ctx, label, 0, 0, { size: 40 }));
      at(ctx, x, Y, p(0.05) * 1.4, p(0.05), subject);
      at(ctx, x + 96, Y + 112, p(0.2), p(0.2), extra);
      // 虫めがねが近づいて、確かめる
      const m = track(t, start + 0.8, HEAVY), q = track(t, start + 0.7, PLAY);
      // 確かめているあいだ、虫めがねが小さく動く
      const scan = Math.sin((t - start - 1.8) * 7) * 7 * ramp(t, start + 1.8, start + 2.0) * (1 - ramp(t, start + 3.0, start + 3.4));
      at(ctx, lerp(x + 190, x + 86, m) + scan, lerp(Y - 150, Y - 62, m) + scan * 0.5, q * 1.15, q, () => ICON.magnifier(ctx));
    };
    col(L, 0.2, "個人の審査", person, () => COIN.yen(ctx));
    col(R, 2.6, "加盟店審査", () => ICON.shop(ctx), doc);

    // 2 つの間の「≠」（別の審査）
    const ne = track(t, 4.8, PLAY), Y0 = 228;
    at(ctx, 346, Y0, ne * 1.2, ne, () => {
      ctx.lineCap = "round";
      for (const y of [-12, 12]) { ctx.beginPath(); ctx.moveTo(-22, y); ctx.lineTo(22, y); shape(ctx, null, C.navy, 8); }
      ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(14, -30); shape(ctx, null, C.blue, 8);
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 880, h: 330, blinkAt: [0.3, 6.2] });
  },
});
