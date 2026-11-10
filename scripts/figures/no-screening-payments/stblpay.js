// すてぶるペイの場合（本文「すてぶるペイの場合」）。
// お店と購入者のウォレットをつなぐ。JPYC は購入者のウォレットからお店のウォレットへ送られ、お金の流れの線の外に運営はいない（運営は何も描かない）。
// カードの加盟店審査の仕組みは使わないが、利用規約への同意と法令上の要件を満たすことが前提（盾の印）。文字は 3 か所（購入者・お店・規約と法令が前提）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = 262, L = [140, Y], R = [590, Y], S = 1.45;

    const wallet = () => {
      rr(ctx, -46, -30, 92, 66, 10); shape(ctx, C.blue);
      rr(ctx, -46, -30, 92, 24, 8); shape(ctx, C.light);
      rr(ctx, 12, 0, 36, 26, 8); shape(ctx, C.white);
      ctx.beginPath(); ctx.arc(30, 13, 4.5, 0, Math.PI * 2); shape(ctx, C.navy, null);
    };
    const shield = () => {
      ctx.beginPath();
      ctx.moveTo(0, -44); ctx.lineTo(36, -31); ctx.lineTo(36, 0);
      ctx.quadraticCurveTo(36, 32, 0, 46); ctx.quadraticCurveTo(-36, 32, -36, 0); ctx.lineTo(-36, -31); ctx.closePath();
      shape(ctx, C.white);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-4, 13); ctx.lineTo(16, -11); shape(ctx, null, C.blue, 8);
    };

    const node = (p, start, label) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, wallet);
      at(ctx, p[0], p[1] + 112, 1, ramp(t, start + 0.1, start + 0.4), () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(L, 0.0, "購入者");
    node(R, 0.35, "お店");

    // JPYC が、購入者のウォレットからお店のウォレットへ。通ったところがブロックチェーンに記録される
    const A = [L[0] + 84, Y], B = [R[0] - 84, Y];
    const u = track(t, 1.8, HEAVY);
    arrow(ctx, A, B, u, { color: C.blue, width: 6 });
    at(ctx, lerp(A[0], B[0], 0.5), Y + 52, 1.3, 1, () => ICON.chain(ctx, u * 3.4 - 0.2));
    const c = track(t, 1.5, PLAY);
    const pos = along(A, B, u);
    at(ctx, pos[0], pos[1] - 54 * ramp(t, 1.8, 2.2), c * 1.3, c, () => COIN.stable(ctx));
    const ok = track(t, 4.0, PLAY);
    at(ctx, R[0] + 62, Y - 66, ok * 1.3, ok, () => ICON.check(ctx));

    // 前提：利用規約への同意と、法令上の要件
    const sh = track(t, 5.4, PLAY);
    at(ctx, 270, 92, sh * 1.2, sh, shield);
    at(ctx, 270, 172, 1, ramp(t, 5.6, 5.9), () => text(ctx, "規約と法令が前提", 0, 0, { size: 38 }));

    drawChan(ctx, t, { pose: t < 1.0 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.6] });
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: u > 0.05 && u < 0.95 ? "right" : "open", mouth: t > 5.4 && t < 6.2 ? "o" : "rest", blinkAt: [1.0, 8.2] });
  },
});
