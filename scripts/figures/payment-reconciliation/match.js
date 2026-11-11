// 入金消込のやり方（本文「入金消込のやり方」）。
// 左の入金の明細 3 行と、右の注文 3 枚を、線で 1 本ずつ結ぶ。2 組は名前が合ってチェックが付き、残る 1 行は名前が違って線が途中で止まり、虫眼鏡で人が確かめる。
// 文字は 3 か所（入金の明細・注文・？）。名前は短い棒で表す。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const ROWS = [165, 260, 355];
    const PX = 60, PW = 230, SX = 470, SW = 210, RH = 78; // 明細の紙・注文の伝票の左端と幅、高さ
    const L = [
      { bar: 70, color: C.navy },
      { bar: 100, color: C.navy },
      { bar: 56, color: C.blue }, // 名前が注文と違う
    ];
    const S = [{ bar: 70 }, { bar: 100 }, { bar: 118 }];
    const bar = (w, color) => { rr(ctx, 0, -6, w, 12, 6); shape(ctx, color, null); };

    const paper = (i) => () => {
      rr(ctx, 0, -RH / 2, PW, RH, 10); shape(ctx, C.white);
      at(ctx, 52, 0, 1, 1, () => COIN.yen(ctx));
      at(ctx, 108, 0, 1, 1, () => bar(L[i].bar, L[i].color));
    };
    const slip = (i) => () => {
      rr(ctx, 0, -RH / 2, SW, RH, 10); shape(ctx, C.white);
      rr(ctx, 0, -RH / 2, 20, RH, 10); shape(ctx, C.light, C.navy, 5);
      at(ctx, 38, -10, 1, 1, () => bar(S[i].bar, C.navy));
      at(ctx, 38, 14, 1, 1, () => { rr(ctx, 0, -5, 52, 10, 5); shape(ctx, C.silver, null); });
    };

    // 見出し
    at(ctx, PX + PW / 2, 75, 1, ramp(t, 0.1, 0.4), () => text(ctx, "入金の明細", 0, 0, { size: 40 }));
    at(ctx, SX + SW / 2, 75, 1, ramp(t, 1.0, 1.3), () => text(ctx, "注文", 0, 0, { size: 40 }));
    // 明細の紙・注文の伝票が順に出る
    ROWS.forEach((y, i) => {
      const a = track(t, 0.3 + i * 0.25, SNAP), b = track(t, 1.1 + i * 0.25, SNAP);
      at(ctx, PX + PW / 2, y, a, a, () => at(ctx, -PW / 2, 0, 1, 1, paper(i)));
      at(ctx, SX + SW / 2, y, b, b, () => at(ctx, -SW / 2, 0, 1, 1, slip(i)));
    });

    // 線：1 本ずつ伸びる。3 本目は途中で止まる
    const A = (y) => [PX + PW + 8, y], B = (y) => [SX - 8, y];
    const starts = [2.6, 3.9, 5.3];
    const u = starts.map((s) => track(t, s, HEAVY));
    arrow(ctx, A(ROWS[0]), B(ROWS[0]), u[0], { color: C.blue, width: 6 });
    arrow(ctx, A(ROWS[1]), B(ROWS[1]), u[1], { color: C.blue, width: 6 });
    arrow(ctx, A(ROWS[2]), [lerp(A(ROWS[2])[0], B(ROWS[2])[0], 0.4), ROWS[2]], Math.min(u[2], 1.0), { color: C.gray, width: 6, head: false });
    // チェック
    [3.6, 4.9].forEach((s, i) => {
      const k = track(t, s, PLAY);
      at(ctx, SX + SW - 8, ROWS[i] - RH / 2 + 4, k * 0.9, k, () => ICON.check(ctx));
    });
    // 止まった線の先：虫眼鏡と「？」
    const m = track(t, 6.3, PLAY);
    const mx = lerp(A(ROWS[2])[0], B(ROWS[2])[0], 0.4);
    at(ctx, mx + 52, ROWS[2] + 6, m * 1.3, m, () => ICON.magnifier(ctx));
    at(ctx, mx + 52, ROWS[2] - 56, 1, ramp(t, 6.5, 6.8), () => text(ctx, "？", 0, 0, { size: 52, weight: 800, color: C.blue }));

    drawChan(ctx, t, { mouth: 2, pose: t < 0.4 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.2] });
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: t > 6.2 ? "wide" : t > 2.5 ? "right" : "open", mouth: t > 6.3 && t < 7.2 ? "o" : "rest", blinkAt: [1.0, 8.4] });
  },
});
