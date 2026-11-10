// 解説ページのサムネイルの絵（記事ごとの場面）。thumb.html が engine.js（FX）のあとに読む。
// 画面は 1200×630。左 690px は題名の場所なので何も置かない。右側に小道具とキャラクターを置く。
// - すてぶるちゃん：右下（中心 x 1040、高さ 380、左向き。左右反転しない）。表情はいちばんの笑顔（口を開けた mouth 2）。ポーズは palm か point。小道具はその上（y 250 より上）と左（x 690〜860）に置く
// - すてぶるくん：左下（中心 x 715）。起きているので足を床に付けて立つ（浮くのは寝ているときだけ）
// - 二人ともお金・カード・スマホを持たない（小道具は宙か台の上）。画面の中に文字は描かない（題名は thumb.html が重ねる）
// 各場面の desc は、記事の冒頭の画像（img.learn-hero）の alt の後半と同じ文にする。
(function () {
  "use strict";
  const { C, at, rr, shape, arrow, ICON, COIN, drawChan, drawKun } = window.FX;
  const icon = (ctx, name, x, y, s = 1) => at(ctx, x, y, s, 1, () => ICON[name](ctx));
  const coin = (ctx, name, x, y, s = 1) => at(ctx, x, y, s, 1, () => COIN[name](ctx));
  const halo = (ctx, x, y, r, color = "#EAF2FF") => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  const chan = (ctx, pose) => drawChan(ctx, 0, { pose, mouth: 2, x: 1040, y: 630, h: 380 });
  const kun = (ctx, eyes = "right", mouth = "rest", x = 715) => drawKun(ctx, 0, { eyes, mouth, x, floor: 612, w: 150 });
  // 文字の代わりの帯（書類・本・画面）
  const bars = (ctx, x, y, w, n, gap = 16, color = C.light) => { for (let i = 0; i < n; i++) { rr(ctx, x, y + i * gap, w * (i % 3 === 2 ? 0.6 : 1), 7, 3); shape(ctx, color, null); } };
  const paper = (ctx, x, y, w, h, n = 4) => { rr(ctx, x, y, w, h, 6); shape(ctx, C.white, C.navy, 4); bars(ctx, x + 14, y + 18, w - 28, n); };
  // 止まっている印（紺の丸に白い横棒）
  const stop = (ctx, x, y, r = 16) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); shape(ctx, C.navy, C.white, 3); rr(ctx, x - r * 0.55, y - 3, r * 1.1, 6, 3); shape(ctx, C.white, null); };

  window.SCENES = {
    // /learn/ の一覧（出力は assets/learn/hub/）
    "hub": {
      desc: "コイン・カード・お店・銀行・本の印が並んでいて、すてぶるちゃんが手のひらで示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 900, 180, 175);
        coin(ctx, "stable", 760, 110, 1.3);
        icon(ctx, "card", 900, 90, 1.0);
        icon(ctx, "bank", 1060, 100, 0.95);
        icon(ctx, "shop", 780, 300, 1.15);
        // 開いた本（解説）
        ctx.beginPath(); ctx.moveTo(880, 196); ctx.quadraticCurveTo(925, 174, 970, 188); ctx.lineTo(970, 266); ctx.quadraticCurveTo(925, 252, 880, 274); ctx.closePath(); shape(ctx, C.white);
        ctx.beginPath(); ctx.moveTo(1060, 196); ctx.quadraticCurveTo(1015, 174, 970, 188); ctx.lineTo(970, 266); ctx.quadraticCurveTo(1015, 252, 1060, 274); ctx.closePath(); shape(ctx, C.white);
        bars(ctx, 894, 208, 58, 3, 14); bars(ctx, 984, 208, 58, 3, 14);
        chan(ctx, "palm");
        kun(ctx, "right", "o", 640);
      },
    },
    "stablecoin-payments": {
      desc: "大きな青いコインからお店へ線がのびていて、すてぶるちゃんが手のひらでコインを示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 900, 170, 150);
        arrow(ctx, [860, 230], [760, 360], 1, { ctrl: [770, 250], color: C.blue, dash: [10, 12], width: 5 });
        icon(ctx, "shop", 755, 425, 1.15);
        coin(ctx, "stable", 920, 160, 2.6);
        chan(ctx, "palm");
        kun(ctx, "right", "o", 640);
      },
    },
    "what-is-stablecoin": {
      desc: "水平につり合ったシーソーの両側に青いコインとお札が載っていて、すてぶるちゃんが手のひらで示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 900, 170, 150);
        // 支点と、水平の板
        ctx.beginPath(); ctx.moveTo(900, 196); ctx.lineTo(862, 262); ctx.lineTo(938, 262); ctx.closePath(); shape(ctx, C.blue);
        rr(ctx, 730, 182, 340, 16, 8); shape(ctx, C.white);
        coin(ctx, "stable", 780, 146, 1.15);
        coin(ctx, "yen", 1020, 154, 1.15);
        chan(ctx, "palm");
        kun(ctx, "right");
      },
    },
    "jpyc-payments": {
      desc: "お店のカウンターの上の画面に完了の印が出ていて、すてぶるちゃんが指で示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 860, 210, 170);
        icon(ctx, "shop", 800, 350, 1.4);
        // カウンターの上の画面（タブレット）
        rr(ctx, 880, 96, 170, 120, 12); shape(ctx, C.white);
        rr(ctx, 894, 110, 142, 92, 6); shape(ctx, C.light, null);
        icon(ctx, "check", 965, 156, 1.1);
        rr(ctx, 952, 216, 26, 30, 3); shape(ctx, C.white);
        coin(ctx, "stable", 760, 168, 0.9);
        arrow(ctx, [790, 168], [860, 158], 1, { color: C.blue, width: 5 });
        chan(ctx, "point");
        kun(ctx, "right", "rest", 650);
      },
    },
    "glossary": {
      desc: "開いた本から鍵やコイン、建物などの印が浮かび上がっていて、すてぶるちゃんが指で示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 880, 200, 170);
        // 開いた本
        ctx.beginPath(); ctx.moveTo(700, 360); ctx.quadraticCurveTo(745, 335, 790, 352); ctx.lineTo(790, 446); ctx.quadraticCurveTo(745, 430, 700, 452); ctx.closePath(); shape(ctx, C.white);
        ctx.beginPath(); ctx.moveTo(880, 360); ctx.quadraticCurveTo(835, 335, 790, 352); ctx.lineTo(790, 446); ctx.quadraticCurveTo(835, 430, 880, 452); ctx.closePath(); shape(ctx, C.white);
        bars(ctx, 716, 374, 58, 4, 14); bars(ctx, 806, 374, 58, 4, 14);
        arrow(ctx, [790, 330], [790, 270], 1, { color: C.gray, width: 4, dash: [6, 10], head: false });
        icon(ctx, "lock", 730, 230, 1.1);
        coin(ctx, "stable", 830, 140, 1.1);
        icon(ctx, "bank", 960, 110, 0.9);
        icon(ctx, "card", 1090, 140, 0.8);
        chan(ctx, "point");
        kun(ctx, "right", "o", 640);
      },
    },
    "payment-gateway": {
      desc: "まん中の青い丸から、カード・銀行・スマホ・お店へ線がのびていて、すてぶるちゃんが指で示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 880, 190, 170);
        const hub = [880, 190];
        const ends = [[740, 90], [1040, 90], [1100, 220], [760, 360]];
        for (const e of ends) arrow(ctx, hub, e, 1, { color: C.gray, width: 4, head: false });
        icon(ctx, "card", 740, 90, 0.8);
        icon(ctx, "bank", 1040, 86, 0.75);
        icon(ctx, "phone", 1100, 210, 0.7);
        icon(ctx, "shop", 760, 380, 0.95);
        ctx.beginPath(); ctx.arc(hub[0], hub[1], 50, 0, Math.PI * 2); shape(ctx, C.blue);
        ctx.beginPath(); ctx.arc(hub[0], hub[1], 22, 0, Math.PI * 2); shape(ctx, C.white, null);
        chan(ctx, "point");
        kun(ctx, "right", "rest", 640);
      },
    },
    "accept-credit-cards": {
      desc: "ノートパソコンへ向かう 3 つの飛び石の先に完了の印があり、すてぶるちゃんが笑顔で指さし、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 900, 170, 160);
        // ノートパソコン
        rr(ctx, 840, 70, 200, 130, 10); shape(ctx, C.white);
        rr(ctx, 854, 84, 172, 102, 4); shape(ctx, C.light, null);
        icon(ctx, "card", 940, 135, 0.7);
        rr(ctx, 812, 200, 256, 18, 8); shape(ctx, C.silver);
        // 飛び石
        arrow(ctx, [720, 470], [930, 226], 1, { ctrl: [820, 400], color: C.gray, width: 4, dash: [6, 10], head: false });
        for (const [x, y, r] of [[735, 440, 30], [790, 360, 34], [840, 280, 36]]) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r * 0.7, 0, 0, Math.PI * 2); shape(ctx, C.light, C.navy, 4); }
        icon(ctx, "check", 840, 272, 0.8);
        chan(ctx, "point");
        kun(ctx, "right", "rest", 630);
      },
    },
    "card-merchant-screening": {
      desc: "大きな青いカードが門のように立ち、手前に書類が積まれていて、すてぶるちゃんが笑顔で指さし、すてぶるくんが書類を見ている絵",
      draw(ctx) {
        halo(ctx, 890, 190, 170);
        at(ctx, 900, 150, 2.1, 1, () => ICON.card(ctx));
        stop(ctx, 1000, 90, 22);
        icon(ctx, "magnifier", 760, 130, 0.9);
        paper(ctx, 720, 330, 120, 150, 6);
        paper(ctx, 740, 312, 120, 150, 6);
        chan(ctx, "point");
        kun(ctx, "right", "rest", 625);
      },
    },
    "no-screening-payments": {
      desc: "明るく開いた扉のそばに盾の印が浮かんでいて、すてぶるちゃんが手のひらで扉を示し、すてぶるくんが見ている絵",
      draw(ctx) {
        halo(ctx, 870, 200, 175, "#E3EEFC");
        // 扉の枠と、開いた扉
        rr(ctx, 760, 120, 150, 250, 8); shape(ctx, "#FFFFFF");
        ctx.beginPath(); ctx.moveTo(760, 120); ctx.lineTo(700, 150); ctx.lineTo(700, 350); ctx.lineTo(760, 370); ctx.closePath(); shape(ctx, C.blue);
        ctx.beginPath(); ctx.arc(714, 260, 6, 0, Math.PI * 2); shape(ctx, C.white, null);
        // 扉の向こうの光（淡い青の帯）
        for (let i = 0; i < 3; i++) { rr(ctx, 790 + i * 34, 150, 18, 190, 9); shape(ctx, "#EAF2FF", null); }
        // 盾（規約と法令の前提）
        ctx.beginPath(); ctx.moveTo(1010, 70); ctx.lineTo(1060, 88); ctx.lineTo(1060, 130); ctx.quadraticCurveTo(1056, 168, 1010, 186); ctx.quadraticCurveTo(964, 168, 960, 130); ctx.lineTo(960, 88); ctx.closePath(); shape(ctx, C.white);
        icon(ctx, "check", 1010, 128, 0.75);
        chan(ctx, "palm");
        kun(ctx, "right", "o", 625);
      },
    },
    "chargeback": {
      desc: "レシートの紙が弧を描いてお店へ戻ってきていて、すてぶるちゃんが指で示し、すてぶるくんが目を見開いて見ている絵",
      draw(ctx) {
        halo(ctx, 880, 190, 170);
        icon(ctx, "shop", 760, 380, 1.1);
        arrow(ctx, [1000, 190], [790, 310], 1, { ctrl: [880, 30], color: C.blue, width: 5, dash: [10, 12] });
        at(ctx, 1040, 160, 1, 1, () => { ctx.rotate(0.18); paper(ctx, -48, -62, 96, 124, 5); });
        chan(ctx, "point");
        kun(ctx, "wide", "o", 625);
      },
    },
    "card-expression-restrictions": {
      desc: "絵を描く人の机にスケッチブックと漫画のコマ割りの紙があり、そばの決済端末が止まっていて、すてぶるちゃんが笑顔で手のひらを向け、すてぶるくんがスケッチブックを見ている絵",
      draw(ctx) {
        halo(ctx, 880, 210, 175);
        // 机
        rr(ctx, 700, 330, 240, 18, 6); shape(ctx, C.silver);
        // スケッチブック（閉じたリングと、色の帯だけの絵）
        rr(ctx, 720, 210, 120, 120, 8); shape(ctx, C.white);
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(738 + i * 21, 210, 6, Math.PI, 0); shape(ctx, null, C.navy, 3); }
        ctx.beginPath(); ctx.arc(760, 262, 18, 0, Math.PI * 2); shape(ctx, C.light, null);
        rr(ctx, 786, 248, 38, 46, 6); shape(ctx, C.blue, null);
        rr(ctx, 738, 300, 84, 10, 4); shape(ctx, "#bcd7f7", null);
        // 漫画のコマ割りの紙（中身は四角だけ。人物は描かない）
        at(ctx, 900, 130, 1, 1, () => {
          ctx.rotate(-0.12);
          rr(ctx, -70, -90, 140, 180, 6); shape(ctx, C.white);
          for (const [x, y, w, h, c] of [[-56, -76, 112, 50, C.light], [-56, -18, 52, 50, "#bcd7f7"], [4, -18, 52, 50, C.light], [-56, 40, 112, 36, "#bcd7f7"]]) { rr(ctx, x, y, w, h, 4); shape(ctx, c, C.navy, 3); }
        });
        // 決済端末（止まっている）
        rr(ctx, 1030, 70, 80, 120, 12); shape(ctx, C.white);
        rr(ctx, 1042, 84, 56, 40, 4); shape(ctx, C.silver, null);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { rr(ctx, 1044 + c * 18, 136 + r * 20, 14, 12, 3); shape(ctx, C.light, null); }
        stop(ctx, 1108, 74, 18);
        chan(ctx, "palm");
        kun(ctx, "right", "rest", 625);
      },
    },
    "online-payment-methods": {
      desc: "棚にカード・銀行・スマホ・青いコイン・お店・配達の箱の印が並んでいて、すてぶるちゃんが手のひらで紹介し、すてぶるくんが見比べている絵",
      draw(ctx) {
        halo(ctx, 890, 180, 170);
        // 棚（2 段）
        rr(ctx, 700, 158, 420, 14, 6); shape(ctx, C.white);
        rr(ctx, 700, 300, 170, 14, 6); shape(ctx, C.white);
        icon(ctx, "card", 750, 118, 0.7);
        icon(ctx, "bank", 870, 116, 0.68);
        icon(ctx, "phone", 980, 112, 0.7);
        coin(ctx, "stable", 1080, 124, 1);
        icon(ctx, "shop", 745, 262, 0.62);
        // 配達の箱
        rr(ctx, 800, 236, 56, 56, 4); shape(ctx, "#d9b98a");
        ctx.beginPath(); ctx.moveTo(800, 252); ctx.lineTo(856, 252); shape(ctx, null, C.navy, 4);
        chan(ctx, "palm");
        kun(ctx, "right", "rest", 650);
      },
    },
    "payment-fees": {
      desc: "天びんの左右の皿に大きさの違う積み木が載って多いほうに傾き、そばに電卓があって、すてぶるちゃんが笑顔で指さし、すてぶるくんが電卓を見ている絵",
      draw(ctx) {
        halo(ctx, 880, 190, 170);
        // 天びん：柱・台・傾いた棒（右の総コストの側が下がる）・皿
        rr(ctx, 872, 90, 16, 260, 6); shape(ctx, C.white);
        rr(ctx, 820, 340, 120, 16, 6); shape(ctx, C.white);
        const a = 0.12, L = 140;
        ctx.save(); ctx.translate(880, 91); ctx.rotate(a); rr(ctx, -L - 20, -7, 2 * L + 40, 14, 7); shape(ctx, C.blue); ctx.restore();
        ctx.beginPath(); ctx.arc(880, 91, 9, 0, Math.PI * 2); shape(ctx, C.white);
        const pans = [[880 - L * Math.cos(a), 91 - L * Math.sin(a)], [880 + L * Math.cos(a), 91 + L * Math.sin(a)]];
        for (const [x, y] of pans) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 40, y + 92); ctx.moveTo(x, y); ctx.lineTo(x + 40, y + 92); shape(ctx, null, C.navy, 3);
          ctx.beginPath(); ctx.ellipse(x, y + 94, 54, 12, 0, 0, Math.PI * 2); shape(ctx, C.white);
        }
        const [lx, ly] = pans[0], [rx, ry] = pans[1];
        rr(ctx, lx - 18, ly + 52, 36, 34, 4); shape(ctx, C.light); // 料率だけ
        rr(ctx, rx - 32, ry + 52, 64, 34, 4); shape(ctx, C.blue); // 総コスト（積み重ね）
        rr(ctx, rx - 24, ry + 20, 48, 32, 4); shape(ctx, C.light);
        rr(ctx, rx - 16, ry - 10, 32, 30, 4); shape(ctx, "#bcd7f7");
        // 電卓（ボタンだけ）
        rr(ctx, 730, 380, 90, 120, 10); shape(ctx, C.white);
        rr(ctx, 742, 392, 66, 26, 4); shape(ctx, C.silver, null);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rr(ctx, 744 + c * 22, 428 + r * 22, 16, 16, 4); shape(ctx, c === 2 && r === 2 ? C.blue : C.light, null); }
        chan(ctx, "point");
        kun(ctx, "right", "rest", 640);
      },
    },
    "policy-expression": {
      desc: "抽象的な模様の額縁が並んだ明るい壁の前で、すてぶるちゃんが手のひらで額縁を示し、すてぶるくんが座布団の上で見ている絵",
      draw(ctx) {
        halo(ctx, 900, 180, 175);
        const frame = (x, y, w, h, fn) => { rr(ctx, x, y, w, h, 6); shape(ctx, C.white, C.navy, 6); ctx.save(); rr(ctx, x + 12, y + 12, w - 24, h - 24, 3); ctx.clip(); fn(x + 12, y + 12, w - 24, h - 24); ctx.restore(); };
        frame(720, 70, 150, 120, (x, y, w, h) => { ctx.fillStyle = "#EAF2FF"; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.arc(x + 40, y + 60, 34, 0, Math.PI * 2); ctx.fillStyle = C.blue; ctx.fill(); ctx.fillStyle = C.light; ctx.fillRect(x + 70, y + 20, 40, 70); });
        frame(900, 50, 120, 150, (x, y, w, h) => { ctx.fillStyle = "#bcd7f7"; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y + 30); ctx.lineTo(x + w, y + h); ctx.fillStyle = C.navy; ctx.fill(); });
        frame(1050, 90, 110, 100, (x, y, w, h) => { ctx.fillStyle = C.white; ctx.fillRect(x, y, w, h); for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? C.light : C.blue; ctx.fillRect(x + i * w / 4, y, w / 8, h); } });
        frame(740, 230, 110, 110, (x, y, w, h) => { ctx.fillStyle = C.light; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 28, 0, Math.PI * 2); ctx.fillStyle = C.white; ctx.fill(); });
        chan(ctx, "palm");
        // 座布団（コードで描く）の上に立つ
        rr(ctx, 632, 584, 166, 34, 16); shape(ctx, C.blue);
        for (const x of [640, 790]) { ctx.beginPath(); ctx.arc(x, 601, 6, 0, Math.PI * 2); shape(ctx, C.light, C.navy, 3); }
        drawKun(ctx, 0, { eyes: "right", mouth: "rest", x: 715, floor: 592, w: 150 });
      },
    },
  };
})();
