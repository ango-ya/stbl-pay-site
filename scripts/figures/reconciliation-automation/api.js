// 銀行 API で取れる明細（本文「銀行 API で取れる明細の中身」）。
// 銀行から太い管（API）で、お店の画面へ明細の紙が速く流れる。紙の中身は、手で取りに行く場合と同じ 3 つの棒（日付・金額・名前）。
// 名前が合わない 1 枚だけが管の中で止まり、虫眼鏡で人（すてぶるくん）が確かめる。文字は 3 か所（銀行 API・お店・届く情報は同じ）。
FX.figure({
  duration: 9,
  draw(ctx, t) {
    const { C, ICON, at, text, rr, shape, track, ramp, lerp, SNAP, PLAY, drawChan, drawKun } = FX;
    const Y = 250, X0 = 235, X1 = 462, STOP = 428; // 管の中の紙の高さ・出発・終点・止まる位置
    const BANK = [120, Y], MON = [595, 235];

    const bar = (x, y, w, color) => { rr(ctx, x, y - 4, w, 8, 4); shape(ctx, color, null); };
    // 明細の紙：日付・金額・名前の 3 つの棒。mis は名前が合わない 1 枚
    const paper = (mis) => () => {
      rr(ctx, -31, -27, 62, 54, 7); shape(ctx, C.white, C.navy, 4);
      bar(-20, -13, 22, C.gray); bar(-20, 0, 32, C.navy); bar(-20, 13, 40, mis ? C.blue : C.navy);
    };
    const monitor = () => {
      rr(ctx, -14, 60, 28, 28, 4); shape(ctx, C.navy, null);
      rr(ctx, -50, 84, 100, 14, 5); shape(ctx, C.navy, null);
      rr(ctx, -95, -75, 190, 140, 12); shape(ctx, C.white);
      rr(ctx, -83, -63, 166, 116, 6); shape(ctx, C.silver, null);
    };

    // 銀行・管・お店の画面
    const b = track(t, 0.0, SNAP);
    at(ctx, BANK[0], BANK[1], b * 1.45, b, () => ICON.bank(ctx));
    const m = track(t, 0.4, SNAP);
    at(ctx, MON[0], MON[1], m, m, monitor);
    const tb = track(t, 0.8, SNAP);
    at(ctx, (205 + 470) / 2, Y, 1, tb, () => { rr(ctx, -(470 - 205) / 2 * tb, -37, (470 - 205) * tb, 74, 37); shape(ctx, C.silver); });
    at(ctx, 290, 168, 1, ramp(t, 1.2, 1.5), () => text(ctx, "銀行 API", 0, 0, { size: 40 }));
    at(ctx, MON[0], 376, 1, ramp(t, 1.4, 1.7), () => text(ctx, "お店", 0, 0, { size: 40 }));

    // 紙が速く流れる。3 枚は画面に入って、行になりチェックが付く。4 枚目だけ名前が合わず、管の中で止まる
    const SPAWN = [2.0, 2.5, 3.0, 3.5], TRAVEL = 0.7;
    SPAWN.forEach((s, i) => {
      const mis = i === 3;
      const p = ramp(t, s, s + TRAVEL);
      if (t < s) return;
      if (mis) {
        const x = lerp(X0, STOP, p);
        const bump = track(t, s + TRAVEL, PLAY);
        at(ctx, x, Y, 1 + 0.25 * Math.min(bump, 1.2), 1, paper(true));
      } else {
        const x = lerp(X0, X1, p);
        at(ctx, x, Y, 1, 1 - ramp(t, s + TRAVEL - 0.05, s + TRAVEL + 0.1), paper(false));
        // 画面の行とチェック
        const r = track(t, s + TRAVEL, SNAP);
        const ry = MON[1] - 36 + i * 32;
        at(ctx, MON[0] - 83 + 11, ry, 1, r, () => { rr(ctx, 0, -12, 110, 24, 6); shape(ctx, C.white, null); bar(10, 0, 56, C.navy); });
        const k = track(t, s + TRAVEL + 0.15, PLAY);
        at(ctx, MON[0] + 56, ry, k * 0.55, k, () => ICON.check(ctx));
      }
    });
    // 止まった 1 枚を、虫眼鏡で人が確かめる
    const mg = track(t, 4.7, PLAY);
    at(ctx, STOP - 6, 168, mg * 1.2, mg, () => ICON.magnifier(ctx));
    at(ctx, 330, 424, 1, ramp(t, 5.6, 5.9), () => text(ctx, "届く情報は同じ", 0, 0, { size: 40 }));

    drawChan(ctx, t, { mouth: 2, pose: t < 0.5 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 560, floor: 532, w: 112, eyes: t > 4.6 ? "wide" : t > 2.0 ? "left" : "open", mouth: t > 4.7 && t < 5.5 ? "o" : "rest", blinkAt: [1.0, 7.6] });
  },
});
