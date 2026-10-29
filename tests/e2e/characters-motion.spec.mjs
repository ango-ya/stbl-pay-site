import { test as base, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── すてぶるくん・すてぶるちゃんの動き ──────────────────────────────────────

// このファイルが保証する範囲
// - 素材（assets/char/ の 66 枚）の有無・大きさ・透過、古い絵（thigh を含む）が残っていないこと、HTML の参照と並び・振り付けの data 属性、
//   部品の組み立て（腕と体は .kun-bob の中、足は外）、assets/characters.js の動き（生きている間だけ動く・上下・reduce・手を振る・
//   すてぶるくんの目線とまばたき・すてぶるちゃんのまばたき・登場・待機の仕草・会話の口パクと立ち絵の連動・座布団）、
//   立ち絵の仕草の手が枠・画面から切れず、すてぶるくんに隠れないこと（上下・呼吸・腕の揺れ・手振りの途中でも）、
//   すてぶるくんの目線が右のすてぶるちゃんの側を多めに見ること、読めないコマ（palm・休み）があるときの縮退、
//   狭い幅で立ち絵を読まないこと、JS なしの見え方、本番ヘッダ（CSP・Trusted Types）で違反が出ないこと、
//   コードに入れない書き方（assets/characters.js と assets/lp.css のキャラの節）
// - 時間に頼る確認のうち、まばたき・登場・待機の仕草・手振りは、ページの時計（page.clock）を止めて runFor で進め、決まった形で見る。
//   会話の再生は画像の読み込みと IntersectionObserver が絡むので、実時間で expect.poll（〜15 秒）に任せる。
//   コマの差し替えは addInitScript の MutationObserver が記録し（window.__rec）、記録を後から見て順番や間隔を確かめる
//   （ポーリングの隙間に起きた変化も取りこぼさない）
// - 乱数（Math.random）で分岐するものは、種を決めた乱数（seedRandom）に差し替えて、続けて 2 回のまばたき・ふつうの間隔・
//   proud・fist が実際に出ることを確かめる（固定しないと、割合や「両方が出る」を必須にした確認が偶然落ちる）。
//   目線の左右は一定の値（fixRandom）にして、選ばれる側を確かめる
// - 絵の見た目そのもの（自然に見えるか）はここでは見ない。目で見る（スクリーンショット）。
//   ただし位置については、絵の見えている画素（canvas で測る）が枠・画面・文字・すてぶるくんとどう重なるかを確かめる
//   （固定の px は書かず、そのときの配置を測って比べる）。測るのは動きの途中も含めて、上下・呼吸・腕の揺れ・ちゃんの上下・手振りを
//   周期の 8 分の 1 刻みで止めた全部の位相の組み合わせ。すてぶるくんの部品は、img から rig までの transform を掛け合わせて実際の描かれ方どおりに描き、
//   getBoundingClientRect と合うこともその場で確かめる
// - YouTube と Google のタグ（計測）への HTTP は、context.route で受けて外に出さない
// - 本番ヘッダ（CSP）はローカルの静的サーバーが付けないので、「本番ヘッダ」の 2 本だけ、_headers の値を応答に付け直して動かす

const ROOT = process.cwd();
const readText = (file) => readFileSync(join(ROOT, file), "utf8");

const PAGES = [
  { path: "/", file: "index.html", lang: "ja" },
  { path: "/en/", file: "en/index.html", lang: "en" },
];

// ─── フィクスチャ（videos-characters.spec.mjs と同じ流儀） ─────────────────

const YOUTUBE = /^https?:\/\/([a-z0-9-]+\.)*(youtube-nocookie\.com|youtube\.com|ytimg\.com|googlevideo\.com)(?=[/:?#]|$)/;
const ANALYTICS = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;
const routeOutside = async (context) => {
  await context.route(YOUTUBE, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "" })
  );
  await context.route(ANALYTICS, (route) => route.abort());
};

// _headers の CSP の 1 行
const cspPolicy = () => {
  const line = readText("_headers")
    .split("\n")
    .find((l) => /^\s*Content-Security-Policy:/.test(l));
  expect(line, "_headers に Content-Security-Policy の行がある").toBeTruthy();
  return line.replace(/^\s*Content-Security-Policy:\s*/, "").trim();
};

const PAGE_PATHS = new Set(["/", "/index.html", "/en/", "/en/index.html"]);
const routePages = async (context, { prodHeaders }) => {
  if (!prodHeaders) {
    return;
  }
  await context.route(
    (url) => url.hostname === "127.0.0.1" && PAGE_PATHS.has(url.pathname),
    async (route) => {
      const request = route.request();
      if (request.method() !== "GET" || request.resourceType() !== "document") {
        return route.continue();
      }
      const response = await route.fetch();
      const body = await response.text();
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      headers["content-security-policy"] = cspPolicy();
      headers["referrer-policy"] = "no-referrer";
      return route.fulfill({ response, body, headers });
    }
  );
};

// prodHeaders: true なら、_headers の CSP と Referrer-Policy: no-referrer を HTML の応答に付ける
const test = base.extend({
  prodHeaders: [false, { option: true }],
  context: async ({ context, prodHeaders }, use) => {
    await routeOutside(context);
    await routePages(context, { prodHeaders });
    await use(context);
  },
});

test.use({ viewport: { width: 1280, height: 900 } });

// ─── 素材の一覧（設計書 v1 §1 と v2 §2） ────────────────────────────────────

const KUN_PARTS = [
  "foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks",
  "eyes-open", "eyes-half", "eyes-closed", "eyes-left", "eyes-right", "eyes-wide",
  "mouth-rest", "mouth-dot", "mouth-o", "mouth-talk-a", "mouth-talk-i", "mouth-talk-o", "mouth-talk-n",
];
// すてぶるちゃん（上半身）の 18 枚。話せる形は 4 つ（口 3 枚ずつ）、あとは単発の絵
const TALK_POSES = ["normal", "proud", "palm", "point"];
const CHAN_FILES = [
  ...TALK_POSES.flatMap((pose) => [0, 1, 2].map((n) => `${pose}-${n}`)),
  "blink-half", "blink-normal", "side-glance", "look-camera", "fist", "zabuton",
];
// 立ち絵（.cast）が使うコマ。ヒーローだけが使う side-glance・look-camera・fist は入れない
const CAST_FRAMES = CHAN_FILES.filter((n) => !["side-glance", "look-camera", "fist"].includes(n));
// ヒーローが使うコマ
const HERO_FRAMES = ["normal-0", "blink-half", "blink-normal", "proud-0", "fist", "side-glance", "look-camera"];
// 仕草の手が出るコマ
const GESTURE_FRAMES = ["palm-0", "palm-1", "palm-2", "point-0", "point-1", "point-2", "zabuton"];
const EXPRESSIONS = ["normal", "proud", "troubled", "serious"];
const VOWELS = ["a", "i", "o", "n"];
const TALK_FILES = [
  ...EXPRESSIONS.flatMap((x) => [0, 1, 2].map((n) => `chan-${x}-${n}`)),
  ...EXPRESSIONS.map((x) => `chan-blink-${x}`),
  "kun-open-rest", "kun-open-o", "kun-wide-o",
  ...VOWELS.flatMap((v) => [`kun-open-talk-${v}`, `kun-wide-talk-${v}`]),
  "kun-closed-rest", "kun-closed-o",
];
const ASSETS = [
  ...KUN_PARTS.map((n) => ({ path: `assets/char/kun/${n}.webp`, width: 374, height: 261, alpha: true })),
  ...CHAN_FILES.map((n) => ({ path: `assets/char/chan/${n}.webp`, width: 400, height: 388, alpha: true })),
  ...TALK_FILES.map((n) => ({ path: `assets/char/talk/${n}.webp`, width: 112, height: 112, alpha: false })),
];

// 設計書 v1 §1-4：HTML から参照を無くす古い絵（sleep-kun・zabuton は FAQ で使い続けるので入れない）
const OLD_ARTWORK = [
  "hero-chan", "present-chan", "guest-chan", "stand-kun-blank", "stand-kun-o", "stand-kun-smile",
  "face-chan-y1-1", "face-chan-y1-2", "face-chan-y1-3", "face-chan-y1-6", "face-chan-y1-7", "face-chan-y2-1",
  "face-kun-1", "face-kun-2", "face-kun-5", "face-kun-8",
].map((n) => `${n}.webp`);
// 設計書 v2 §6：太ももまでの絵（assets/char/chan/ の中。ファイルも無い）
const OLD_THIGH = ["thigh-stand", "thigh-reach", "thigh-reach-wink"].map((n) => `${n}.webp`);

// 設計書 v1 §4-4：会話の顔の data-face ごとの、休み・話す・まばたきのコマ
const chanFace = (x) => ({ rest: `chan-${x}-0`, talk: [0, 1, 2].map((n) => `chan-${x}-${n}`), blink: `chan-blink-${x}` });
const kunFace = (eyes, rest, blink) => ({
  rest,
  talk: VOWELS.map((v) => `kun-${eyes}-talk-${v}`),
  blink,
});
const FACE = {
  "chan normal": chanFace("normal"),
  "chan proud": chanFace("proud"),
  "chan troubled": chanFace("troubled"),
  "chan serious": chanFace("serious"),
  "kun smile": kunFace("open", "kun-open-rest", "kun-closed-rest"),
  "kun o": kunFace("open", "kun-open-o", "kun-closed-o"),
  "kun wide": kunFace("wide", "kun-wide-o", "kun-closed-o"),
};
const webp = (names) => new Set(names.map((n) => `${n}.webp`));
const framesOf = (face) => webp([FACE[face].rest, FACE[face].blink, ...FACE[face].talk]);
const restOrBlinkOf = (face) => webp([FACE[face].rest, FACE[face].blink]);
// 「話す」コマ（休みの 0 番は含めない。0 番は休みと見分けがつかない）
const TALK_FRAME = /^(chan-(normal|proud|troubled|serious)-[12]|kun-(open|wide)-talk-[aion])\.webp$/;
const KUN_TALK_MOUTH = /^mouth-talk-[aion]\.webp$/;

// 設計書 v1 §2-4：HTML に書いてある顔の絵と data-face の対応
const FACE_BY_FILE = {
  "chan-normal-0.webp": "chan normal",
  "chan-normal-1.webp": "chan normal",
  "chan-normal-2.webp": "chan normal",
  "chan-proud-2.webp": "chan proud",
  "chan-troubled-0.webp": "chan troubled",
  "chan-serious-0.webp": "chan serious",
  "kun-open-rest.webp": "kun smile",
  "kun-open-talk-a.webp": "kun smile",
  "kun-open-o.webp": "kun o",
  "kun-wide-o.webp": "kun wide",
};

// ─── WebP の見出しから大きさと透過を読む（デコーダーなしで素材を確かめる） ──

const webpInfo = (buf) => {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), alpha: (buf[20] & 0x10) !== 0 };
  }
  if (kind === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), alpha: ((bits >> 28) & 1) === 1 };
  }
  if (kind === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, alpha: false };
  }
  return null;
};

// ─── 記録と待ち ──────────────────────────────────────────────────────────────

// 絵の src の差し替えと、is-* クラスの付け外しを window.__rec に溜める。goto の前に呼ぶ
// （ポーリングでは 50ms の口パクやまばたきを取りこぼすので、MutationObserver で全部見る）
const installRecorder = (page) =>
  page.addInitScript(() => {
    const rec = (window.__rec = []);
    // 遅延読み込みのスクリプトが走り終わった時刻（characters.js の開始のほぼ直後）。登場の窓（800ms）を測る基準
    document.addEventListener("DOMContentLoaded", () => {
      window.__dcl = performance.now();
    });
    const ids = new WeakMap();
    let counter = 0;
    const idOf = (el) => {
      if (!ids.has(el)) {
        ids.set(el, ++counter);
      }
      return ids.get(el);
    };
    const fileOf = (src) => (src || "").split("?")[0].split("/").pop();
    const tokens = (s) => (s || "").split(/\s+/).filter(Boolean);
    const info = (el) => {
      const section = el.closest("section");
      const rig = el.closest("[data-kun]");
      const talk = el.closest(".talk");
      const line = el.closest(".talk-line");
      return {
        id: idOf(el),
        cls: el.getAttribute("class") || "",
        sec: section ? section.id : "",
        kun: rig ? rig.getAttribute("data-kun") : null,
        chan: el.getAttribute("data-chan"),
        face: el.getAttribute("data-face"),
        line: line && talk ? Array.prototype.indexOf.call(talk.querySelectorAll(".talk-line"), line) : -1,
        speaking: !!(line && line.classList.contains("is-speaking")),
      };
    };
    new MutationObserver((records) => {
      const t = performance.now();
      for (const r of records) {
        const el = r.target;
        if (el.nodeType !== 1) {
          continue;
        }
        if (r.attributeName === "src" && el.tagName === "IMG") {
          rec.push({ k: "src", t, file: fileOf(el.getAttribute("src")), from: fileOf(r.oldValue), ...info(el) });
        } else if (r.attributeName === "class") {
          const before = tokens(r.oldValue);
          const after = tokens(el.getAttribute("class"));
          const added = after.filter((x) => !before.includes(x) && /^is-/.test(x));
          const removed = before.filter((x) => !after.includes(x) && /^is-/.test(x));
          if (added.length || removed.length) {
            const entry = { k: "class", t, added, removed, ...info(el) };
            // 手を振り始めた瞬間の右腕の動き（あとから見ると、遅い機械では振り終わっていることがある）
            if (added.includes("is-waving")) {
              const arm = el.querySelector(".kun-arm-r");
              entry.armAnim = arm ? getComputedStyle(arm).animationName : null;
            }
            rec.push(entry);
          }
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "class"],
      attributeOldValue: true,
    });
  });

const installViolationRecorder = (page) =>
  page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__csp.push(e.effectiveDirective + " " + e.blockedURI)
    );
  });

const watchErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

const events = (page) => page.evaluate(() => window.__rec || []);
const hasCls = (e, name) => e.cls.split(/\s+/).includes(name);
const waitFor = (page, message, pred, timeout = 15_000) =>
  expect.poll(async () => (await events(page)).some(pred), { message, timeout }).toBe(true);

// list の中に seq が連続して並んでいるか／間をあけて順に並んでいるか
const hasRun = (list, seq) => {
  for (let i = 0; i + seq.length <= list.length; i++) {
    if (seq.every((v, j) => list[i + j] === v)) {
      return true;
    }
  }
  return false;
};
const hasOrder = (list, seq) => {
  let at = 0;
  for (const v of list) {
    if (v === seq[at]) {
      at++;
    }
  }
  return at === seq.length;
};

// 要素を画面の真ん中に（CSS の scroll-behavior: smooth に左右されないよう instant）
const scrollCenter = (locator) =>
  locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
const scrollTop = (page, top = 0) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

// ページの上から下まで少しずつ送る（loading="lazy" と IntersectionObserver を働かせる）
const scrollThrough = async (page) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await scrollTop(page, y);
    await page.waitForTimeout(40);
  }
  await scrollTop(page, height);
  await page.waitForTimeout(150);
};

// 絵が全部読み込まれたときの [naturalWidth, naturalHeight] の並び（読み込み前は [0, 0]）
const sizesOf = (locator) =>
  locator.evaluateAll((els) => els.map((el) => (el.complete ? [el.naturalWidth, el.naturalHeight] : [0, 0])));

const readFaces = (page, scope) =>
  page.locator(`${scope} .talk-face`).evaluateAll((els) =>
    els.map((el) => ({
      face: el.getAttribute("data-face"),
      file: (el.getAttribute("src") || "").split("/").pop(),
    }))
  );

// 行ごとの「話している時間」（is-speaking が付いてから外れるまで）
const speakingWindows = (evs, sec) => {
  const open = new Map();
  const windows = [];
  for (const e of evs) {
    if (e.k !== "class" || e.sec !== sec || !hasCls(e, "talk-line")) {
      continue;
    }
    if (e.added.includes("is-speaking")) {
      open.set(e.id, e);
    }
    if (e.removed.includes("is-speaking") && open.has(e.id)) {
      const start = open.get(e.id);
      open.delete(e.id);
      windows.push({ line: e.line, kun: hasCls(e, "talk-kun"), start: start.t, end: e.t });
    }
  }
  return windows;
};

// 設計書 v1 §4-4 の話す時間：文字数（※ と数字の脚注記号は数えない）× 日本語 95ms／英語 45ms、700〜2600ms
const speakMs = (text, lang) => {
  const count = text.replace(/[※0-9０-９]/g, "").replace(/\s+/g, " ").trim().length;
  return Math.min(2600, Math.max(700, count * (lang === "en" ? 45 : 95)));
};

// 部品の組み立て：全部が左上をそろえて同じ大きさで重なる（transform に左右されない offset* で見る）。
// 腕と体は .kun-bob の中にあるが、.kun-bob 自体が rig と同じ枠なので、重なりは変わらない
const assemblyOf = (rig) =>
  rig.evaluate((el) => {
    const parts = Array.prototype.slice.call(el.querySelectorAll("img"));
    const box = (n) => ({ left: n.offsetLeft, top: n.offsetTop, width: n.offsetWidth, height: n.offsetHeight });
    const bob = el.querySelector(".kun-bob");
    const names = (nodes) => Array.prototype.map.call(nodes, (n) => (n.className || "").split(/\s+/).filter(Boolean).join("."));
    return {
      width: el.offsetWidth,
      height: el.offsetHeight,
      parts: parts.map(box),
      bob: bob ? box(bob) : null,
      rigChildren: names(el.children),
      bobChildren: bob ? names(bob.children) : [],
    };
  });

const expectAssembled = (assembly, where) => {
  expect(assembly.parts, `${where}: 部品は 8 枚`).toHaveLength(8);
  expect(assembly.height, `${where}: 高さがある`).toBeGreaterThan(50);
  // 748 : 522
  expect(assembly.width / assembly.height, `${where}: 縦横の比`).toBeCloseTo(748 / 522, 1);
  for (const [i, p] of assembly.parts.entries()) {
    expect(Math.abs(p.left), `${where}: ${i} 枚目の左`).toBeLessThanOrEqual(1);
    expect(Math.abs(p.top), `${where}: ${i} 枚目の上`).toBeLessThanOrEqual(1);
    expect(Math.abs(p.width - assembly.width), `${where}: ${i} 枚目の幅`).toBeLessThanOrEqual(1);
    expect(Math.abs(p.height - assembly.height), `${where}: ${i} 枚目の高さ`).toBeLessThanOrEqual(1);
  }
  // 足は rig の直下に残り、腕と体だけが .kun-bob（rig と同じ枠）の中にある
  expect(assembly.rigChildren, `${where}: rig の直下は 足・足・kun-bob`).toEqual([
    "kun-part.kun-foot-l",
    "kun-part.kun-foot-r",
    "kun-bob",
  ]);
  expect(assembly.bobChildren, `${where}: kun-bob の中は 腕・腕・体`).toEqual([
    "kun-part.kun-arm-l",
    "kun-part.kun-arm-r",
    "kun-body",
  ]);
  expect(assembly.bob, `${where}: kun-bob がある`).toBeTruthy();
  expect(Math.abs(assembly.bob.left) + Math.abs(assembly.bob.top), `${where}: kun-bob は左上そろい`).toBeLessThanOrEqual(1);
  expect(Math.abs(assembly.bob.width - assembly.width), `${where}: kun-bob の幅`).toBeLessThanOrEqual(1);
  expect(Math.abs(assembly.bob.height - assembly.height), `${where}: kun-bob の高さ`).toBeLessThanOrEqual(1);
};

const animationName = (locator) => locator.evaluate((el) => getComputedStyle(el).animationName);

const HERO_RIG = '.kun-rig[data-kun="hero"]';
const HERO_CHAN = ".hero-cast-chan";
const IS_LIVE = /\bis-live\b/;

// タブの表示・非表示を作る（document.hidden を差し替えて visibilitychange を出す）
const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    if (h) {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    } else {
      delete document.hidden;
      delete document.visibilityState;
    }
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

// ─── ページの時計（page.clock）を止めて進める ─────────────────────────────────

// setTimeout・performance.now を止めて読み込む。絵の読み込みと IntersectionObserver、CSS の動きは実時間のまま。
// 時間は runFor で進める（遅い機械でも、窓を外さず、間隔が決まった形になる）
const freezeClock = async (page) => {
  await page.clock.install({ time: new Date("2026-10-21T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-21T00:00:01Z"));
};

// 時計を step ずつ進めながら、記録が pred を満たすまで待つ（進めた ms を返す）。
// 絵の読み込みは実時間なので、1 回ごとにほんの少し実時間も待つ
const runUntil = async (page, message, pred, { step = 250, maxMs = 30_000 } = {}) => {
  let spent = 0;
  for (;;) {
    if (pred(await events(page))) {
      return spent;
    }
    if (spent >= maxMs) {
      throw new Error(`${message}（ページの時計を ${maxMs}ms 進めても起きなかった）`);
    }
    await page.clock.runFor(step);
    spent += step;
    await page.waitForTimeout(15);
  }
};

// ヒーローの背景（canvas）は requestAnimationFrame で毎コマ描くので、止めた時計を長く進めるテストでは遅すぎる。
// 時計を止めたあとに呼んで、rAF を何もしないものに替える（キャラの動きは setTimeout だけで動くので影響しない）
const stillFrames = (page) =>
  page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });

// 時計を total ms 進める（長いときは step ずつ。待機の間隔や出現の回数を数えるため）
const advance = async (page, total, step = 2000) => {
  for (let done = 0; done < total; done += step) {
    await page.clock.runFor(Math.min(step, total - done));
    await page.waitForTimeout(10);
  }
};

// Math.random を、種を決めた乱数（mulberry32）に差し替える。goto の前に呼ぶ。
// 乱数で分岐するもの（続けて 2 回のまばたき 20%・待機の仕草の proud / fist）を、実行のたびに同じ並びにして確かめる
// （固定しないと、割合や「両方が出る」を必須にした確認が、確率は小さくても偶然落ちる）
const SEED = 20261022;
const seedRandom = (page, seed) =>
  page.addInitScript((s) => {
    let a = s >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
// Math.random を一定の値にする。goto の前に呼ぶ（0.5 なら 70% の側＝多い側、0.9 なら少ない側を選ぶ）
const fixRandom = (page, value) =>
  page.addInitScript((v) => {
    Math.random = () => v;
  }, value);

// アプリの先読み（assets/characters.js の preload。new Image() に onload を代入してから src を入れる）が、onload を呼び終えたことを観測する。
// goto の前に呼ぶ。HTTP が終わっただけでは、アプリの onload（読み込み済みの印 loaded.add）が済んだとは言えず、
// 時計を進めるのが早すぎると、読めていないコマが選ばれなくなって、乱数の消費も開始時刻も実行ごとに変わる。
// HTMLImageElement.prototype の onload・onerror を、元の HTMLElement.prototype の記述子を使って定義し直し、代入されたハンドラーを包む：
// - 元のハンドラーを呼び終えてから（finally で）、onload なら絵のパスを window.__appLoaded の中身（__appLoadState().loaded）に足す
// - 切り離された img（アプリの先読み）に代入されたら「読み込み中」に数え、onload か onerror が終わったら外す（__appLoadState().pending）
// - onload・onerror を代入しない絵（HTML の img など）には何もしない。取り出すと、代入した元の関数が返る
const installAppLoadTracker = (page) =>
  page.addInitScript(() => {
    const loaded = new Set();
    const pending = new Set();
    const finished = new WeakSet();
    const originals = new WeakMap(); // 包んだ関数 → 代入された元の関数
    const pathOf = (img) => {
      try {
        return new URL(img.currentSrc || img.src, location.href).pathname;
      } catch (e) {
        return "";
      }
    };
    const watch = (name) => {
      const base = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      if (!base || !base.get || !base.set) {
        return;
      }
      Object.defineProperty(HTMLImageElement.prototype, name, {
        configurable: true,
        enumerable: base.enumerable,
        get() {
          const current = base.get.call(this);
          return originals.has(current) ? originals.get(current) : current;
        },
        set(handler) {
          if (typeof handler !== "function") {
            base.set.call(this, handler);
            return;
          }
          if (!this.isConnected && !finished.has(this)) {
            pending.add(this);
          }
          const wrapped = function (event) {
            try {
              return handler.call(this, event);
            } finally {
              if (name === "onload") {
                loaded.add(pathOf(this));
              }
              finished.add(this);
              pending.delete(this);
            }
          };
          originals.set(wrapped, handler);
          base.set.call(this, wrapped);
        },
      });
    };
    watch("onload");
    watch("onerror");
    window.__appLoadState = () => ({ loaded: Array.from(loaded), pending: pending.size });
  });

// files（"chan/blink-half.webp" のような、assets/char/ の下のパスの終わり）がすべてアプリの onload を終え、
// 読み込み中の先読みが無くなるまで待つ。Node 側で数えるので、page.clock を止めていても動く
const waitForAppLoads = (page, files) =>
  expect
    .poll(
      () =>
        page.evaluate((names) => {
          const state = window.__appLoadState();
          return {
            missing: names.filter((n) => !state.loaded.some((path) => path.endsWith("/" + n))),
            pending: state.pending,
          };
        }, files),
      { message: "アプリの先読みが、onload まで終わる", timeout: 30_000 }
    )
    .toEqual({ missing: [], pending: 0 });

// その場面でアプリが先読みするコマ（ヒーロー：くんの目と口・ちゃんのまばたきと待機の仕草・登場の絵）
const KUN_FRAMES = ["eyes-half", "eyes-closed", "eyes-left", "eyes-right", "mouth-talk-a", "mouth-talk-i", "mouth-talk-o", "mouth-talk-n"].map(
  (n) => `kun/${n}.webp`
);
const CHAN_BLINK_FRAMES = ["normal-0", "blink-half", "blink-normal"].map((n) => `chan/${n}.webp`);
const HERO_SCENE = [...KUN_FRAMES, ...CHAN_BLINK_FRAMES, ...["proud-0", "fist", "side-glance", "look-camera"].map((n) => `chan/${n}.webp`)];
// 会話の欄の立ち絵：くんの目と口・ちゃんのまばたき・会話の顔（休み・話す・まばたき）・会話で使う形と座布団。HTML の data 属性から決める
const talkScene = async (page, section) => {
  const info = await page.evaluate((sec) => {
    const talk = document.querySelector(`#${sec} .talk`);
    const clean = (value) => (value || "").trim().replace(/\s+/g, " ");
    return {
      faces: Array.from(talk.querySelectorAll("img.talk-face[data-face]")).map((img) => clean(img.getAttribute("data-face"))),
      lines: Array.from(talk.querySelectorAll(".talk-line.talk-chan")).map((line) => ({
        pose: line.getAttribute("data-pose"),
        face: clean(line.querySelector("img.talk-face[data-face]")?.getAttribute("data-face")),
      })),
      finale: talk.getAttribute("data-finale") || "",
    };
  }, section);
  const poseOf = (line) => line.pose || (line.face.startsWith("chan ") ? line.face.slice(5) : "normal");
  const poses = [...new Set(info.lines.map(poseOf))].filter((pose) => TALK_POSES.includes(pose));
  return [
    ...new Set([
      ...KUN_FRAMES,
      ...CHAN_BLINK_FRAMES,
      ...info.faces.flatMap((face) => [...framesOf(face)].map((f) => `talk/${f}`)),
      ...poses.flatMap((pose) => [0, 1, 2].map((n) => `chan/${pose}-${n}.webp`)),
      ...(info.finale ? [`chan/${info.finale}.webp`] : []),
    ]),
  ];
};

// ─── すてぶるちゃんの絵の記録を読む ───────────────────────────────────────────

const chanEvents = (evs, chan, sec) =>
  evs.filter((e) => e.k === "src" && e.chan === chan && (sec === undefined || e.sec === sec));

// 話している行 w のあいだ（と、話し終わりの直後）の、立ち絵のちゃんの絵の差し替え。
// 話し始めがまばたきの途中だったときの「normal-0 に戻す」1 回だけは除く
const spokenFrames = (evs, sec, w) =>
  chanEvents(evs, "cast", sec).filter(
    (e) => e.t >= w.start && e.t <= w.end + 100 && !(e.file === "normal-0.webp" && /^blink-/.test(e.from))
  );

const BLINK_SEQ = ["blink-half.webp", "blink-normal.webp", "blink-half.webp", "normal-0.webp"];
// 同じ img の src の差し替え（時系列）から、まばたき（half → normal → half → normal-0）の塊を取り出す
const blinkGroups = (list) => {
  const groups = [];
  for (let i = 0; i + BLINK_SEQ.length <= list.length; i++) {
    if (BLINK_SEQ.every((f, j) => list[i + j].file === f)) {
      groups.push(list.slice(i, i + BLINK_SEQ.length));
      i += BLINK_SEQ.length - 1;
    }
  }
  return groups;
};

// 止めた時計で測ったまばたきの決まり：50ms → 110ms → 50ms、始まりは normal-0 から
const expectBlinkShape = (group, where) => {
  expect(group[0].from, `${where}: まばたきは normal-0 から始まる`).toBe("normal-0.webp");
  expect(group[1].t - group[0].t, `${where}: blink-half は 50ms`).toBeGreaterThanOrEqual(45);
  expect(group[1].t - group[0].t, `${where}: blink-half は 50ms`).toBeLessThanOrEqual(75);
  expect(group[2].t - group[1].t, `${where}: blink-normal は 110ms`).toBeGreaterThanOrEqual(105);
  expect(group[2].t - group[1].t, `${where}: blink-normal は 110ms`).toBeLessThanOrEqual(135);
  expect(group[3].t - group[2].t, `${where}: 2 つ目の blink-half は 50ms`).toBeGreaterThanOrEqual(45);
  expect(group[3].t - group[2].t, `${where}: 2 つ目の blink-half は 50ms`).toBeLessThanOrEqual(75);
};

// まばたきの間：続けてもう 1 回（180ms）か、2.5〜5.5 秒おき。仕草・会話のあいだは後回しになるので、上は余裕を持たせる
const expectBlinkGaps = (groups, maxGap, where) => {
  const gaps = [];
  for (let i = 1; i < groups.length; i++) {
    gaps.push(groups[i][0].t - groups[i - 1][3].t);
  }
  for (const gap of gaps) {
    const second = Math.abs(gap - 180) <= 30;
    const interval = gap >= 2250 && gap <= maxGap;
    expect(second || interval, `${where}: まばたきの間 ${Math.round(gap)}ms は 180ms（続けて 2 回）か 2.5〜5.5 秒おき`).toBe(true);
  }
  return gaps;
};

// ─── 立ち絵の見えている範囲を測る（canvas。ページの中で動かすので、外の変数は使えない） ──────────

// root（.cast か .hero-cast）の中のすてぶるちゃんの絵を frames の 1 枚ずつ canvas に描き、透明でない画素の端を画面の座標で返す。
// 上下・呼吸・腕の揺れの途中でも枠・すてぶるくん・文字とどう重なるかを見るため、動いているアニメーションを止めて、位相ごとに測る。
// - すてぶるくんの上下（kun-bob）・呼吸（kun-breathe）・腕の揺れ（kun-arm-l/r-sway）は同じ周期（2.6 秒）でそろえ、
//   すてぶるちゃんの上下（chan-bob。3.2 秒）は別に、どちらも周期の 0・1/8・…・7/8 に合わせて止める。くんの位相 × ちゃんの位相の全部の組み合わせで見る。
//   動いているアニメーションが無い（is-live が付く前）ときは、測っても意味が無いので例外にする
// - wave: true（ヒーロー）は、手を振る動き（kun-wave。1.8 秒）も、周期の 0・1/8・…・7/8 と山（18・46・76%）に合わせて止めて測る
//   （is-waving を付けて作る。測り終えたら外す）。腕と体の揺れは、そのときの位相（くんの 8 通り）と掛け合わせる
// - すてぶるくんの部品は、部品の img から rig の直下の子までの各要素の transform・transform-origin・配置（left/top）を DOMMatrix で掛け合わせ、
//   ctx.setTransform で実際の描かれ方どおりに描く。部品の 4 隅を同じ行列で変換した外接矩形が getBoundingClientRect と何 px ずれるかを self に返す
//   （行列の誤りを見つけるため。テストで 1px 以内を確かめる）。すてぶるちゃんの絵は translate だけなので getBoundingClientRect をそのまま使う
// - クリップする枠（overflow が visible でない祖先）と画面の幅の重なりを clip に返す
// - すてぶるちゃんの画素がすてぶるくんの足・腕・体の画素と重なる数（overlap）、ヒーローの文字・ボタン・カード・ロゴと重なる数（textOverlap）、
//   すてぶるくんの画素が文字・ボタン・カード・ロゴと重なる数（textHits）を数える
async function measureStage({ root, frames, textRoot, floor, wave }) {
  const rootEl = document.querySelector(root);
  const chan = rootEl.querySelector("img[data-chan]");
  const rig = rootEl.querySelector(".kun-rig");
  const dirOf = (img) => img.getAttribute("src").replace(/[^/]*$/, "");
  const load = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("読めない絵 " + url));
      img.src = new URL(url, location.href).href;
    });
  const chanImgs = await Promise.all(frames.map((name) => load(dirOf(chan) + name + ".webp")));
  const kunNames = ["foot-l", "foot-r", "arm-l", "arm-r", "body"];
  const kunImgs = await Promise.all(kunNames.map((name) => load(dirOf(rig.querySelector("img")) + name + ".webp")));
  // ここから先は await しない（IntersectionObserver などに割り込まれて、止めた動きが変わらないように）

  const pixels = (img, width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  };
  // 透明でない画素の端（元の絵の座標）
  const extent = (img, threshold) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const data = pixels(img, w, h);
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    return { minX, maxX, minY, maxY, w, h };
  };
  // 透明でない画素のうち、各行の左右の端と各列の上下の端の画素の 4 隅（元の絵の座標）。
  // 回したり縮めたりしたあとの外接矩形は、この点を変換して測れば（画素ごとに変換しなくても）正確に出る
  const edgePoints = (img, threshold) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const data = pixels(img, w, h);
    const out = [];
    const add = (x, y) => out.push(x, y, x + 1, y, x, y + 1, x + 1, y + 1);
    for (let y = 0; y < h; y++) {
      let first = -1;
      let last = -1;
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > threshold) {
          first = first < 0 ? x : first;
          last = x;
        }
      }
      if (first >= 0) {
        add(first, y);
        add(last, y);
      }
    }
    for (let x = 0; x < w; x++) {
      let first = -1;
      let last = -1;
      for (let y = 0; y < h; y++) {
        if (data[(y * w + x) * 4 + 3] > threshold) {
          first = first < 0 ? y : first;
          last = y;
        }
      }
      if (first >= 0) {
        add(x, first);
        add(x, last);
      }
    }
    return out;
  };

  // ---- 動いているアニメーション（この root の中のものだけ）。止めて、周期の何分の何かに合わせる
  const STEPS = 8;
  const AT = Array.from({ length: STEPS }, (_, i) => i / STEPS);
  const WAVE_AT = AT.concat([0.18, 0.46, 0.76]).sort((a, b) => a - b); // 山は kun-wave の keyframes（18・46・76%）
  const MOVING = /^(kun-bob|kun-breathe|kun-arm-[lr]-sway|kun-wave|chan-bob)$/;
  const movingIn = (scope) =>
    document.getAnimations().filter((a) => MOVING.test(a.animationName || "") && scope.contains(a.effect.target));
  const seek = (list, at) =>
    list.forEach((a) => {
      a.pause();
      a.currentTime = a.effect.getComputedTiming().duration * at;
    });
  // 手を振る動きがあると右腕の揺れが入れ替わるので、先に外して揺れだけの状態にする
  rig.classList.remove("is-waving");
  const swayAnims = movingIn(rig);
  const swayNames = swayAnims.map((a) => a.animationName).sort();
  const chanAnims = movingIn(chan);
  if (swayNames.join() !== "kun-arm-l-sway,kun-arm-r-sway,kun-bob,kun-breathe" || chanAnims.length !== 1) {
    throw new Error(
      `動いているアニメーションが足りない（くん: ${swayNames.join(" ") || "なし"} / ちゃん: ${chanAnims.length} 個）。is-live が付いてから測る`
    );
  }

  const rr = rootEl.getBoundingClientRect();
  seek(chanAnims, 0);
  const cr0 = chan.getBoundingClientRect();
  const kr = rig.getBoundingClientRect();
  // rig とその祖先に transform が無い（フェードイン・せり上がりが終わっている）。あれば rig の位置に動きが混ざる
  for (let el = rig; el && el !== document.documentElement; el = el.parentElement) {
    if (getComputedStyle(el).transform !== "none") {
      throw new Error("rig か祖先に transform が残っている（位置が落ち着く前に測っている）");
    }
  }

  // クリップする枠：root 自身と祖先のうち overflow が visible でないもの。横は画面の幅も入れる
  const clip = { left: 0, right: document.documentElement.clientWidth, top: -Infinity, bottom: Infinity };
  for (let el = rootEl; el && el !== document.documentElement; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const left = r.left + el.clientLeft;
    const top = r.top + el.clientTop;
    if (cs.overflowX !== "visible") {
      clip.left = Math.max(clip.left, left);
      clip.right = Math.min(clip.right, left + el.clientWidth);
    }
    if (cs.overflowY !== "visible") {
      clip.top = Math.max(clip.top, top);
      clip.bottom = Math.min(clip.bottom, top + el.clientHeight);
    }
  }

  // ヒーローの文字（1 行ごとの外枠）・ボタン・カード・ロゴ
  const rects = [];
  const textEl = textRoot ? document.querySelector(textRoot) : null;
  if (textEl) {
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      Array.prototype.forEach.call(range.getClientRects(), (q) => rects.push(q));
    }
    textEl.querySelectorAll(".button, .hero-points, img").forEach((el) => rects.push(el.getBoundingClientRect()));
  }
  const inside = (list, x, y) => list.some((q) => x >= q.left && x <= q.right && y >= q.top && y <= q.bottom);

  // 画面の座標で見る 1 枚の canvas（すてぶるちゃんの絵が動く範囲。上へ持ち上がる分の余白つき）。画素 (x, y) は画面の (X0 + x, Y0 + y)
  const margin = Math.ceil(cr0.height * 0.03) + 2;
  const X0 = Math.floor(cr0.left) - 2;
  const Y0 = Math.floor(cr0.top) - margin;
  const W = Math.ceil(cr0.width) + 4;
  const H = Math.ceil(cr0.height) + margin * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const worldRects = rects.filter((q) => q.right >= X0 && q.left <= X0 + W && q.bottom >= Y0 && q.top <= Y0 + H);

  // ---- すてぶるちゃん：位相ごとに、フレームごとの見えている範囲・見えている画素の並び・文字と重なる数
  const edges = chanImgs.map((img) => extent(img, 40));
  const chanPhases = AT.map((at) => {
    seek(chanAnims, at);
    const cr = chan.getBoundingClientRect();
    return {
      at,
      dy: cr.top - cr0.top,
      dx: cr.left - cr0.left,
      frames: frames.map((name, i) => {
        const e = edges[i];
        const sx = cr.width / e.w;
        const sy = cr.height / e.h;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.setTransform(1, 0, 0, 1, -X0, -Y0);
        ctx.drawImage(chanImgs[i], cr.left, cr.top, cr.width, cr.height);
        const data = ctx.getImageData(0, 0, W, H).data;
        const seen = new Int32Array(W * H);
        let count = 0;
        let textOverlap = 0;
        for (let y = 0; y < H; y++) {
          if (Y0 + y + 0.5 > clip.bottom) {
            break; // 床線・ティッカーの下に沈んでいる分は見えない
          }
          for (let x = 0; x < W; x++) {
            if (data[(y * W + x) * 4 + 3] > 128) {
              seen[count++] = y * W + x;
              if (worldRects.length && inside(worldRects, X0 + x + 0.5, Y0 + y + 0.5)) {
                textOverlap++;
              }
            }
          }
        }
        return {
          name,
          left: cr.left + e.minX * sx,
          right: cr.left + (e.maxX + 1) * sx,
          top: cr.top + e.minY * sy,
          bottom: cr.top + (e.maxY + 1) * sy,
          textOverlap,
          seen: seen.slice(0, count),
        };
      }),
    };
  });

  // ---- すてぶるくん：部品の img から rig の直下の子までの transform を掛け合わせて、画面に描く
  const px = (value) => parseFloat(value) || 0;
  const matrixOf = (cs) => (cs.transform === "none" ? new DOMMatrix() : new DOMMatrix(cs.transform));
  // 要素の「自分の座標（左上が原点）」→「親の座標」＝ 配置(left, top) · 原点へ · transform · 原点から戻す
  const toParent = (el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute") {
      throw new Error(`${el.className} が position: absolute でない（配置の前提が崩れている）`);
    }
    const [ox, oy] = cs.transformOrigin.split(" ").map(px);
    return new DOMMatrix().translate(px(cs.left), px(cs.top)).translate(ox, oy).multiply(matrixOf(cs)).translate(-ox, -oy);
  };
  // img の箱の座標 → 画面の座標（rig の位置 · rig の直下の子 · … · img）
  const toScreen = (img) => {
    const chain = [];
    for (let el = img; el && el !== rig; el = el.parentElement) {
      chain.unshift(el);
    }
    let m = new DOMMatrix().translate(kr.left, kr.top);
    chain.forEach((el) => {
      m = m.multiply(toParent(el));
    });
    return m;
  };
  const boxOf = (img) => {
    const cs = getComputedStyle(img);
    return { w: px(cs.width), h: px(cs.height) };
  };
  const partOf = (name) => {
    const img = rig.querySelector(`img[src$="/${name}.webp"]`);
    if (!img) {
      throw new Error(`${name} の部品が rig に無い`);
    }
    return img;
  };
  const kunParts = kunNames.map((name, i) => ({ name, img: partOf(name), pic: kunImgs[i], points: edgePoints(kunImgs[i], 40) }));
  const allParts = Array.prototype.slice.call(rig.querySelectorAll("img"));
  const fileOf = (img) => (img.getAttribute("src") || "").split("/").pop();
  const kunCanvas = document.createElement("canvas");
  kunCanvas.width = W;
  kunCanvas.height = H;
  const kunCtx = kunCanvas.getContext("2d", { willReadFrequently: true });

  const measureKun = (at, waveAt) => {
    // 描き方が正しいか：4 隅を変換した外接矩形が getBoundingClientRect と合う（8 枚すべて）
    let worst = 0;
    let worstPart = "";
    allParts.forEach((img) => {
      const m = toScreen(img);
      const { w, h } = boxOf(img);
      const xs = [];
      const ys = [];
      [[0, 0], [w, 0], [w, h], [0, h]].forEach(([x, y]) => {
        xs.push(m.a * x + m.c * y + m.e);
        ys.push(m.b * x + m.d * y + m.f);
      });
      const r = img.getBoundingClientRect();
      const diff = Math.max(
        Math.abs(Math.min(...xs) - r.left),
        Math.abs(Math.max(...xs) - r.right),
        Math.abs(Math.min(...ys) - r.top),
        Math.abs(Math.max(...ys) - r.bottom)
      );
      if (diff > worst) {
        worst = diff;
        worstPart = fileOf(img);
      }
    });

    // 見えている範囲（足・腕・体）と足の下端：画素の端の点を同じ行列で変換して測る
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let footBottom = -Infinity;
    const drawn = [];
    kunCtx.setTransform(1, 0, 0, 1, 0, 0);
    kunCtx.clearRect(0, 0, W, H);
    kunParts.forEach((part, i) => {
      const m = toScreen(part.img);
      const { w, h } = boxOf(part.img);
      const full = m.scale(w / part.pic.naturalWidth, h / part.pic.naturalHeight); // 絵の画素 → 画面
      for (let k = 0; k < part.points.length; k += 2) {
        const x = part.points[k];
        const y = part.points[k + 1];
        const X = full.a * x + full.c * y + full.e;
        const Y = full.b * x + full.d * y + full.f;
        left = Math.min(left, X);
        right = Math.max(right, X);
        top = Math.min(top, Y);
        bottom = Math.max(bottom, Y);
        if (i < 2) {
          footBottom = Math.max(footBottom, Y);
        }
      }
      drawn.push({ full, pic: part.pic });
      // 実際の描かれ方どおりに、同じ行列で canvas に描く
      kunCtx.setTransform(new DOMMatrix().translate(-X0, -Y0).multiply(full));
      kunCtx.drawImage(part.pic, 0, 0);
    });
    kunCtx.setTransform(1, 0, 0, 1, 0, 0);
    const kd = kunCtx.getImageData(0, 0, W, H).data;
    const mask = new Uint8Array(W * H);
    let any = false;
    for (let i = 0; i < W * H; i++) {
      if (kd[i * 4 + 3] > 128) {
        mask[i] = 1;
        any = true;
      }
    }
    // すてぶるちゃんの見えている画素のうち、くんの画素と重なる数（位相 × コマ）
    const overlap = {};
    chanPhases[0].frames.forEach((f, fi) => {
      overlap[f.name] = chanPhases.map((c) => {
        if (!any) {
          return 0;
        }
        let n = 0;
        const seen = c.frames[fi].seen;
        for (let k = 0; k < seen.length; k++) {
          n += mask[seen[k]];
        }
        return n;
      });
    });
    // ヒーロー：くんの画素（足・腕・体）のうち、文字・ボタン・カード・ロゴの中に入る数。
    // 同じ行列で描いた画素で数える（端の点だけでは、くんの輪郭の内側にすっぽり入った小さなボタンを見落とす）
    let textHits = 0;
    const near = rects.filter((q) => q.right >= left && q.left <= right && q.bottom >= top && q.top <= bottom);
    if (near.length) {
      const bx = Math.floor(left) - 1;
      const by = Math.floor(top) - 1;
      const bw = Math.ceil(right) - bx + 2;
      const bh = Math.ceil(bottom) - by + 2;
      const hitCanvas = document.createElement("canvas");
      hitCanvas.width = bw;
      hitCanvas.height = bh;
      const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
      drawn.forEach((d) => {
        hitCtx.setTransform(new DOMMatrix().translate(-bx, -by).multiply(d.full));
        hitCtx.drawImage(d.pic, 0, 0);
      });
      const hd = hitCtx.getImageData(0, 0, bw, bh).data;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          if (hd[(y * bw + x) * 4 + 3] > 128 && inside(near, bx + x + 0.5, by + y + 0.5)) {
            textHits++;
          }
        }
      }
    }
    return { at, wave: waveAt, kun: { left, right, top, bottom, footBottom }, self: { worst, part: worstPart }, textHits, overlap };
  };

  const kunPhases = [];
  AT.forEach((at) => {
    seek(swayAnims, at);
    kunPhases.push(measureKun(at, null));
  });

  // 手を振る：is-waving を付けて kun-wave を作り、止めて測る。右腕の揺れは kun-wave に替わる
  let waving = false;
  if (wave) {
    rig.classList.add("is-waving");
    const waveAnims = movingIn(rig).filter((a) => a.animationName === "kun-wave");
    const others = movingIn(rig).filter((a) => a.animationName !== "kun-wave");
    if (waveAnims.length !== 1 || others.map((a) => a.animationName).sort().join() !== "kun-arm-l-sway,kun-bob,kun-breathe") {
      throw new Error("手を振る動き（kun-wave）が作れない");
    }
    waving = true;
    WAVE_AT.forEach((w) => {
      seek(waveAnims, w);
      AT.forEach((at) => {
        seek(others, at);
        kunPhases.push(measureKun(at, w));
      });
    });
    rig.classList.remove("is-waving");
  }

  return {
    animations: { kun: swayNames, chan: chanAnims.length, wave: waving },
    clip,
    root: { left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom },
    chan: { left: cr0.left, right: cr0.right, top: cr0.top, bottom: cr0.bottom, width: cr0.width, height: cr0.height },
    kunBox: { left: kr.left, right: kr.right, top: kr.top, bottom: kr.bottom },
    chanPhases: chanPhases.map((c) => ({
      at: c.at,
      dy: c.dy,
      dx: c.dx,
      frames: c.frames.map(({ seen, ...rest }) => rest),
    })),
    kunPhases,
    floorTop: floor ? document.querySelector(floor).getBoundingClientRect().top : null,
  };
}

const fmt = (n) => Math.round(n * 10) / 10;

// 要素と、その祖先の transform がすべて無くなる（フェードイン・せり上がりが終わる）まで待つ
const settled = (page, selector) =>
  expect
    .poll(
      () =>
        page.evaluate((sel) => {
          for (let el = document.querySelector(sel); el && el !== document.documentElement; el = el.parentElement) {
            const cs = getComputedStyle(el);
            if (cs.transform !== "none" || Number(cs.opacity) < 1) {
              return false;
            }
          }
          return true;
        }, selector),
      { message: `${selector} の位置が落ち着く（フェードインが終わる）`, timeout: 10_000 }
    )
    .toBe(true);

// 測った結果（measureStage）が、動きの途中のどの位相でも決まりを満たす。外れたものは全部まとめて見せる
// - 動きが測りに反映されている（くんの上下で見えている上端が上がる、ちゃんの上下は絵の高さの約 1.8%、ヒーローは手振りで右腕の描かれ方が変わる）
// - すてぶるくん：見えている範囲が枠の中（左右・上）。足が床線に付く。行列で描いた部品の外接矩形が getBoundingClientRect と 1px 以内。
//   textFrames があるとき（ヒーロー）は、手を振る動きの途中も含めて、くんの画素が文字・ボタン・カード・ロゴと重ならない
// - すてぶるちゃん：見えている範囲が枠の中（上は持ち上がった分も入れる）。胸の切れ目は持ち上がっても床線の下に沈む
// - kunFrames のコマは、くんとちゃんのどの位相の組み合わせでも、すてぶるくんの画素と重ならない。textFrames のコマは文字・ボタン・カードと重ならない
// floorY は足が付く床線（立ち絵は .cast の下端、ヒーローはティッカーの上端）。kunBeforeChan は、くんの見えている右端が常にちゃんの絵の左端より左（ヒーロー）
const expectStage = (m, where, { floorY, kunFrames, textFrames = [], wave = false, kunBeforeChan = false }) => {
  expect(m.animations.kun, `${where}: 測ったくんの動き`).toEqual(["kun-arm-l-sway", "kun-arm-r-sway", "kun-bob", "kun-breathe"]);
  expect(m.animations.chan, `${where}: 測ったちゃんの動き`).toBe(1);
  expect(m.animations.wave, `${where}: 手を振る動きを測ったか`).toBe(wave);
  expect(m.chanPhases, `${where}: ちゃんの位相`).toHaveLength(8);
  expect(m.kunPhases, `${where}: くんの位相（揺れ 8 通り${wave ? " + 手振り 11 通り × 8" : ""}）`).toHaveLength(wave ? 8 + 11 * 8 : 8);

  const bad = [];
  const kunAt = (k) => `くん ${k.at}${k.wave === null ? "" : ` 手振り ${k.wave}`}`;

  // 動きが測りに反映されている（反映されていないと、位相を変えても同じ場所を測るだけになる）
  const base = m.kunPhases.filter((k) => k.wave === null);
  const rest = base.find((k) => k.at === 0);
  const peak = base.find((k) => k.at === 0.5);
  expect(rest.kun.top - peak.kun.top, `${where}: 上下の頂点（1/2）で、くんの見えている上端が上がる`).toBeGreaterThan(2);
  const chanPeak = m.chanPhases.find((c) => c.at === 0.5);
  expect(
    Math.abs(chanPeak.dy + m.chan.height * 0.018),
    `${where}: ちゃんの上下の頂点（1/2）の持ち上がり ${fmt(chanPeak.dy)}px（絵の高さの 1.8%）`
  ).toBeLessThanOrEqual(0.5);
  expect(m.chanPhases.map((c) => Math.abs(c.dx)).filter((dx) => dx > 0.01), `${where}: ちゃんは横には動かない`).toEqual([]);
  if (wave) {
    // 手を振ると右の腕が肩から持ち上がるので、揺れだけのときより見えている右端が内へ入る（右腕の描かれ方が変わる）
    const waved = Math.min(...m.kunPhases.filter((k) => k.wave !== null).map((k) => k.kun.right));
    const calm = Math.min(...base.map((k) => k.kun.right));
    expect(calm - waved, `${where}: 手を振る動きが測りに反映されている（右端 ${fmt(waved)} が揺れだけのとき ${fmt(calm)} より内に入る）`).toBeGreaterThan(5);
  }

  for (const k of m.kunPhases) {
    const when = kunAt(k);
    if (k.self.worst > 1) {
      bad.push(`${when}: 行列で描いた ${k.self.part} の外接矩形が getBoundingClientRect と ${fmt(k.self.worst)}px ずれる`);
    }
    if (k.kun.left < m.clip.left - 0.5) {
      bad.push(`${when}: 見えている左端 ${fmt(k.kun.left)} が枠の左 ${fmt(m.clip.left)} から出る`);
    }
    if (k.kun.right > m.clip.right + 0.5) {
      bad.push(`${when}: 見えている右端 ${fmt(k.kun.right)} が枠の右 ${fmt(m.clip.right)} から出る`);
    }
    if (k.kun.top < m.clip.top - 0.5) {
      bad.push(`${when}: 見えている上端 ${fmt(k.kun.top)} が枠の上 ${fmt(m.clip.top)} から出る`);
    }
    if (Math.abs(floorY - k.kun.footBottom) > 2.5) {
      bad.push(`${when}: 足の下端 ${fmt(k.kun.footBottom)} が床線 ${fmt(floorY)} に付かない`);
    }
    if (textFrames.length && k.textHits > 0) {
      bad.push(`${when}: くんの画素が文字・ボタン・カード・ロゴと重なる ${k.textHits} 画素`);
    }
    if (kunBeforeChan && k.kun.right >= m.chan.left) {
      bad.push(`${when}: くんの右端 ${fmt(k.kun.right)} がちゃんの絵の左端 ${fmt(m.chan.left)} を越える`);
    }
    for (const name of kunFrames) {
      k.overlap[name].forEach((n, i) => {
        if (n > 0) {
          bad.push(`${when} × ちゃん ${m.chanPhases[i].at} ${name}: くんに隠れる画素 ${n}`);
        }
      });
    }
  }

  for (const c of m.chanPhases) {
    const when = `ちゃん ${c.at}（持ち上がり ${fmt(c.dy)}px）`;
    const sunk = m.chan.bottom + c.dy - floorY;
    if (sunk <= 1) {
      bad.push(`${when}: 絵の下端 ${fmt(m.chan.bottom + c.dy)} が床線 ${fmt(floorY)} の下に沈んでいない（切れ目が見える）`);
    }
    for (const f of c.frames) {
      if (f.left < m.clip.left - 0.5) {
        bad.push(`${when} ${f.name}: 見えている左端 ${fmt(f.left)} が枠の左 ${fmt(m.clip.left)} から出る`);
      }
      if (f.right > m.clip.right + 0.5) {
        bad.push(`${when} ${f.name}: 見えている右端 ${fmt(f.right)} が枠の右 ${fmt(m.clip.right)} から出る`);
      }
      if (f.top < m.clip.top - 0.5) {
        bad.push(`${when} ${f.name}: 見えている上端 ${fmt(f.top)} が枠の上 ${fmt(m.clip.top)} から出る`);
      }
      if (textFrames.includes(f.name) && f.textOverlap > 0) {
        bad.push(`${when} ${f.name}: 文字・ボタン・カードと重なる画素 ${f.textOverlap}`);
      }
    }
  }
  // ふだんの位置（持ち上がる前）の胸の切れ目は、床線の下に 10px 以上沈んでいる
  expect(m.chan.bottom - floorY, `${where}: 絵の下端 ${fmt(m.chan.bottom)} は床線 ${fmt(floorY)} の下に 10px 以上`).toBeGreaterThanOrEqual(10);

  expect(bad.slice(0, 30), `${where}: 動きの途中で決まりを外れたもの（${bad.length} 件。先頭 30 件）`).toEqual([]);
};

// ─── 1. 素材と HTML ─────────────────────────────────────────────────────────

test.describe("素材と HTML", () => {
  test("設計書 v2 §2 の 66 枚が assets/char/ にそろい、大きさと透過が決まりどおり。太ももまでの絵は無い", () => {
    expect(CHAN_FILES, "すてぶるちゃん 18 枚").toHaveLength(18);
    expect(ASSETS, "kun 19 + chan 18 + talk 29").toHaveLength(66);
    expect(new Set(ASSETS.map((a) => a.path)).size, "名前が重ならない").toBe(66);
    const problems = [];
    for (const a of ASSETS) {
      const full = join(ROOT, a.path);
      if (!existsSync(full)) {
        problems.push(`${a.path}: ファイルがない`);
        continue;
      }
      const info = webpInfo(readFileSync(full));
      if (!info) {
        problems.push(`${a.path}: WebP として読めない`);
        continue;
      }
      if (info.width !== a.width || info.height !== a.height) {
        problems.push(`${a.path}: ${info.width}×${info.height}（${a.width}×${a.height} のはず）`);
      }
      if (a.alpha && !info.alpha) {
        problems.push(`${a.path}: 透過がない`);
      }
    }
    expect(problems).toEqual([]);
    for (const old of OLD_THIGH) {
      expect(existsSync(join(ROOT, "assets/char/chan", old)), `assets/char/chan/${old} は無い`).toBe(false);
    }
  });

  for (const { path, file, lang } of PAGES) {
    test(`${file}：キャラの絵の src がすべて実在し、古い絵への参照が無く、FAQ の絵はそのまま`, async ({ page, request }) => {
      test.setTimeout(60_000);
      await page.goto(path);
      const srcs = async (selector) =>
        page.locator(selector).evaluateAll((els) => els.map((el) => el.getAttribute("src")));

      // 数：ヒーロー 9 枚（くん 8 + ちゃん 1）、立ち絵 2 か所で 18 枚、顔は会話の行の数
      expect(await srcs(".hero-cast img"), "ヒーローの絵").toHaveLength(9);
      expect(await srcs(".cast img"), "立ち絵の絵").toHaveLength(18);
      const lines = await page.locator(".talk-line").count();
      expect(lines).toBeGreaterThan(0);
      expect(await srcs(".talk-line img.talk-face"), "会話の顔は 1 行に 1 枚").toHaveLength(lines);

      const all = [...new Set(await srcs(".hero-cast img, .cast img, .talk img"))];
      const known = new Set(ASSETS.map((a) => a.path));
      for (const src of all) {
        // 日本語ページは相対パス、英語ページは /assets/… の絶対パス
        expect(src, "src の書き方").toMatch(lang === "en" ? /^\/assets\/char\// : /^assets\/char\//);
        const repoPath = src.replace(/^\//, "");
        expect(known.has(repoPath), `${src} は設計書の素材`).toBe(true);
        expect(existsSync(join(ROOT, repoPath)), `${src} のファイル`).toBe(true);
        const res = await request.head(new URL(src, page.url()).href);
        expect(res.status(), `${src} の配信`).toBe(200);
      }

      // 古い絵への参照は HTML に残さない（太ももまでの絵も）
      const html = readText(file);
      for (const old of OLD_ARTWORK) {
        expect(html, `${file} に古い絵 ${old} が残っている`).not.toContain(`assets/char/${old}`);
      }
      for (const old of OLD_THIGH) {
        expect(html, `${file} に太ももまでの絵 ${old} が残っている`).not.toContain(`chan/${old}`);
      }

      // FAQ の寝て浮くすてぶるくんと座布団は変えない（新しい chan/zabuton.webp とは別のファイル）
      const nap = await srcs(".faq-nap img");
      expect(nap.map((s) => s.split("/").pop())).toEqual(["sleep-kun.webp", "zabuton.webp"]);
      expect(nap.every((s) => !s.includes("/chan/"))).toBe(true);
      for (const old of ["sleep-kun.webp", "zabuton.webp"]) {
        expect(existsSync(join(ROOT, "assets/char", old)), `${old} は残す`).toBe(true);
      }

      // characters.js は lp.js の直後に defer で読む
      const prefix = lang === "en" ? "/assets" : "assets";
      expect(html, `${file} のスクリプト`).toContain(
        `<script src="${prefix}/lp.js" defer></script>\n    <script src="${prefix}/characters.js" defer></script>`
      );
    });

    test(`${file}：すてぶるちゃんの立ち絵は 400×388 で、くんが左・ちゃんが右。会話の振り付けは data 属性だけ`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.goto(path);
      const shape = await page.evaluate(() => {
        const attrs = (img) =>
          img
            ? {
                width: img.getAttribute("width"),
                height: img.getAttribute("height"),
                alt: img.getAttribute("alt"),
                chan: img.getAttribute("data-chan"),
                loading: img.getAttribute("loading"),
                decoding: img.getAttribute("decoding"),
                fetchpriority: img.getAttribute("fetchpriority"),
              }
            : null;
        const castOrder = (cast) =>
          Array.prototype.map.call(cast.children, (c) => (c.classList.contains("kun-rig") ? "kun" : c.tagName === "IMG" ? "chan" : c.tagName));
        const lineOf = (sel) =>
          Array.prototype.map.call(document.querySelectorAll(sel + " .talk-line"), (line) => ({
            who: line.classList.contains("talk-kun") ? "kun" : "chan",
            pose: line.getAttribute("data-pose"),
          }));
        const talkOf = (sel) => document.querySelector(sel + " .talk").getAttribute("data-finale");
        const others = Array.prototype.filter
          .call(document.querySelectorAll(".talk"), (t) => !t.closest("#videos") && !t.closest("#early-access"))
          .map((t) => ({
            finale: t.getAttribute("data-finale"),
            poses: Array.prototype.map.call(t.querySelectorAll(".talk-line"), (l) => l.getAttribute("data-pose")),
          }));
        return {
          hero: attrs(document.querySelector(".hero-cast > img.hero-cast-chan")),
          videos: attrs(document.querySelector("#videos .cast > img.cast-chan")),
          guest: attrs(document.querySelector("#early-access .cast > img.cast-chan")),
          videosOrder: castOrder(document.querySelector("#videos .cast")),
          guestOrder: castOrder(document.querySelector("#early-access .cast")),
          videosLines: lineOf("#videos"),
          guestLines: lineOf("#early-access"),
          videosFinale: talkOf("#videos"),
          guestFinale: talkOf("#early-access"),
          others,
          thighClass: document.querySelectorAll('[data-chan="wink"], [data-chan="greet"]').length,
        };
      });
      // （絵の src は、JS が動いているとまばたきで替わるので、ここでは見ない。HTML に書いたままの src は「JS なし」で確かめる）
      const chan = (data, extra) => ({
        width: "400",
        height: "388",
        alt: "",
        chan: data,
        loading: "lazy",
        decoding: null,
        fetchpriority: null,
        ...extra,
      });
      expect(shape.hero, "ヒーローのちゃん").toEqual(chan("hero", { decoding: "async", fetchpriority: "low" }));
      expect(shape.videos, "動画欄のちゃん").toEqual(chan("cast"));
      expect(shape.guest, "相談欄のちゃん").toEqual(chan("cast"));
      expect(shape.thighClass, "wink・greet の印は無い").toBe(0);
      // 左にすてぶるくん、右にすてぶるちゃん（動画と同じ並び）
      expect(shape.videosOrder, "動画欄は くん → ちゃん").toEqual(["kun", "chan"]);
      expect(shape.guestOrder, "相談欄は くん → ちゃん").toEqual(["kun", "chan"]);
      // 振り付け：動画欄は 1 行目 proud・3 行目 point、相談欄はちゃんの行 palm と、最後の座布団。ほかの会話には付けない
      expect(shape.videosLines).toEqual([
        { who: "chan", pose: "proud" },
        { who: "kun", pose: null },
        { who: "chan", pose: "point" },
      ]);
      expect(shape.guestLines).toEqual([
        { who: "kun", pose: null },
        { who: "chan", pose: "palm" },
        { who: "kun", pose: null },
      ]);
      expect(shape.videosFinale, "動画欄に座布団は無い").toBeNull();
      expect(shape.guestFinale).toBe("zabuton");
      if (lang === "ja") {
        expect(shape.others.length, "ほかの会話がある（英語ページには動画欄と相談欄の 2 つだけ）").toBeGreaterThan(0);
      }
      for (const t of shape.others) {
        expect(t.finale, "ほかの会話に data-finale は付けない").toBeNull();
        expect(t.poses.every((p) => p === null), "ほかの会話に data-pose は付けない").toBe(true);
      }
    });
  }
});

// ─── 2. 組み立て ────────────────────────────────────────────────────────────

test.describe("組み立て", () => {
  for (const { path } of PAGES) {
    test(`${path}：すてぶるくんは部品 8 枚が同じ大きさで重なり（腕と体は kun-bob の中）、すてぶるちゃんの絵は 400×388`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.goto(path);

      // ヒーロー（1280×900）
      const heroParts = page.locator(".hero-cast-kun img");
      await expect(heroParts).toHaveCount(8);
      await expect.poll(() => sizesOf(heroParts), { message: "ヒーローの部品が全部読み込まれる" }).toEqual(
        Array(8).fill([374, 261])
      );
      const heroChan = page.locator(HERO_CHAN);
      await expect.poll(() => sizesOf(heroChan), { message: "ヒーローのすてぶるちゃん" }).toEqual([[400, 388]]);
      expectAssembled(await assemblyOf(page.locator(".hero-cast-kun")), "ヒーロー");

      // 動画欄・相談欄の立ち絵（スクロールして lazy を読ませる）
      for (const cast of ["#videos .cast", "#early-access .cast"]) {
        await scrollCenter(page.locator(cast));
        const parts = page.locator(`${cast} .cast-kun img`);
        await expect(parts, `${cast} の部品`).toHaveCount(8);
        await expect.poll(() => sizesOf(parts), { message: `${cast} の部品が全部読み込まれる` }).toEqual(
          Array(8).fill([374, 261])
        );
        await expect.poll(() => sizesOf(page.locator(`${cast} .cast-chan`)), { message: `${cast} のちゃん` }).toEqual([
          [400, 388],
        ]);
        expectAssembled(await assemblyOf(page.locator(`${cast} .cast-kun`)), cast);
      }
    });
  }
});

// ─── 2b. 並びと位置（枠・画面・文字・すてぶるくんとの関係） ─────────────────────

test.describe("並びと位置", () => {
  // 動画欄・相談欄の立ち絵：すてぶるくんが左、すてぶるちゃんが右。仕草の手・座布団が .cast の枠から切れず、すてぶるくんに隠れない
  // 901px は立ち絵が出る一番狭い幅（900px 以下は出さない）で、相談欄の列が約 359px と狭いので、手・座布団の切れとくんとの重なりが本当に効く
  for (const width of [901, 1024, 1280, 1440]) {
    for (const { path } of PAGES) {
      test(`${path} ${width}px：立ち絵は くんが左・ちゃんが右で、上下・呼吸・揺れの途中でも、仕草の手が枠から切れず、すてぶるくんに隠れない`, async ({
        page,
      }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        for (const section of ["#videos", "#early-access"]) {
          const cast = `${section} .cast`;
          await scrollCenter(page.locator(cast));
          await expect.poll(() => sizesOf(page.locator(`${cast} .cast-chan`)), { message: `${cast} のちゃん` }).toEqual([
            [400, 388],
          ]);
          await settled(page, cast);

          // 左にすてぶるくん、右にすてぶるちゃん。すてぶるくんが前（z-index）
          const order = await page.evaluate((sel) => {
            const root = document.querySelector(sel);
            const kun = root.querySelector(".kun-rig").getBoundingClientRect();
            const chan = root.querySelector("img.cast-chan");
            const chanBox = chan.getBoundingClientRect();
            const z = (el) => {
              const cs = getComputedStyle(el);
              return cs.zIndex === "auto" ? 0 : Number(cs.zIndex);
            };
            return {
              kunLeft: kun.left,
              kunCenter: (kun.left + kun.right) / 2,
              chanLeft: chanBox.left,
              chanCenter: (chanBox.left + chanBox.right) / 2,
              kunZ: z(root.querySelector(".kun-rig")),
              kunPos: getComputedStyle(root.querySelector(".kun-rig")).position,
              chanZ: z(chan),
            };
          }, cast);
          expect(order.kunLeft, `${cast}: くんの箱がちゃんの箱より左`).toBeLessThan(order.chanLeft);
          expect(order.kunCenter, `${cast}: くんの中心がちゃんの中心より左`).toBeLessThan(order.chanCenter);
          expect(order.kunPos, `${cast}: くんは重ね順が効く位置`).not.toBe("static");
          expect(order.kunZ, `${cast}: すてぶるくんが前（ちゃんより手前に出ない）`).toBeGreaterThan(order.chanZ);

          // 動いている状態（is-live）で、上下・呼吸・腕の揺れとちゃんの上下を周期の 8 分の 1 刻みに止めて、全部の組み合わせで測る。
          // 15 コマすべてが枠の中。仕草の手・座布団はすてぶるくんの画素と重ならない。足は床線に付き（上下するのは体と腕だけ）、
          // 胸の切れ目は床線の下に 10px 以上沈んで、持ち上がっても見えない
          await expect(page.locator(`${cast} .kun-rig`)).toHaveClass(IS_LIVE, { timeout: 10_000 });
          await expect(page.locator(`${cast} .cast-chan`)).toHaveClass(IS_LIVE, { timeout: 10_000 });
          const m = await page.evaluate(measureStage, { root: cast, frames: CAST_FRAMES, floor: null });
          expectStage(m, cast, { floorY: m.clip.bottom, kunFrames: GESTURE_FRAMES });
        }
      });
    }
  }

  // ヒーロー：画面から切れず、文字・ボタン・カードに重ならず、胸の切れ目はティッカーの向こうに沈む
  for (const width of [1200, 1280, 1440, 1920]) {
    for (const { path } of PAGES) {
      test(`${path} ${width}px：ヒーローのすてぶるちゃんは画面から切れず、文字・ボタン・カードに重ならない`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect.poll(() => sizesOf(page.locator(HERO_CHAN)), { message: "ヒーローのちゃん" }).toEqual([[400, 388]]);
        await settled(page, ".hero-cast");
        await settled(page, ".hero-inner");

        // 動いている状態（is-live）で、上下・呼吸・腕の揺れ・手を振る動きとちゃんの上下を止めて、全部の組み合わせで測る。
        // 7 コマすべてが枠の中で、文字・ボタン・カードにもすてぶるくんにも重ならない。足がティッカーに付き、
        // 胸の切れ目はティッカーの向こうに 10px 以上沈んで、持ち上がっても見えない。左にすてぶるくん、右にすてぶるちゃん
        await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 10_000 });
        await expect(page.locator(HERO_CHAN)).toHaveClass(IS_LIVE, { timeout: 10_000 });
        const m = await page.evaluate(measureStage, {
          root: ".hero-cast",
          frames: HERO_FRAMES,
          textRoot: ".hero-inner",
          floor: ".hero-ticker",
          wave: true,
        });
        expectStage(m, "ヒーロー", { floorY: m.floorTop, kunFrames: HERO_FRAMES, textFrames: HERO_FRAMES, wave: true, kunBeforeChan: true });
      });
    }
  }
});

// ─── 3. 会話の再生 ──────────────────────────────────────────────────────────

// 立ち絵のすてぶるちゃんが、話す行のあいだ pose の口パク（pose-0/1/2 だけ）をして、
// 終わったら pose-0 を少し見せて normal-0 に戻る（設計書 v2 §5-1）。話し終わりの戻りは少し遅れるので、来るまで待つ
const expectChanSpeaks = async (page, sec, w, pose, where) => {
  const evs = await events(page);
  const files = spokenFrames(evs, sec, w).map((e) => e.file);
  expect(files.length, `${where}: 話している間に絵が替わる`).toBeGreaterThan(0);
  for (const file of files) {
    expect(file, `${where}: 話している間は ${pose}-0/1/2 だけ（今は ${file}）`).toMatch(new RegExp(`^${pose}-[012]\\.webp$`));
  }
  expect(
    files.some((f) => /-[12]\.webp$/.test(f)),
    `${where}: 口パクで ${pose}-1 か ${pose}-2 になる`
  ).toBe(true);

  // 終わったら pose-0 を 700ms ほど見せてから normal-0
  await expect
    .poll(async () => chanEvents(await events(page), "cast", sec).some((e) => e.t > w.end + 100 && e.file === "normal-0.webp"), {
      message: `${where}: 話し終わって normal-0 に戻る`,
      timeout: 10_000,
    })
    .toBe(true);
  const back = chanEvents(await events(page), "cast", sec).find((e) => e.t > w.end + 100 && e.file === "normal-0.webp");
  expect(back.from, `${where}: 戻る前は ${pose}-0`).toBe(`${pose}-0.webp`);
  expect(back.t - w.end, `${where}: 話し終わって 700ms ほど後に normal-0（今は ${Math.round(back.t - w.end)}ms）`).toBeGreaterThanOrEqual(550);
  expect(back.t - w.end, `${where}: 話し終わって 700ms ほど後に normal-0（今は ${Math.round(back.t - w.end)}ms）`).toBeLessThanOrEqual(1200);
};

// 配信される「/」の HTML を書き換える（会話の振り付けの data 属性を変えて、動きを確かめる）
const rewriteHome = (page, rewrite) =>
  page.route(
    (url) => url.hostname === "127.0.0.1" && url.pathname === "/",
    async (route) => {
      if (route.request().resourceType() !== "document") {
        return route.continue();
      }
      const response = await route.fetch();
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      return route.fulfill({ response, body: rewrite(await response.text()), headers });
    }
  );
// 動画欄の 3 行目の data-pose="point" を外す（顔は chan serious なので、ちゃんは normal の形で話す）
const dropVideosPoint = (html) =>
  html.replace('<p class="talk-line talk-chan" data-pose="point">', '<p class="talk-line talk-chan">');

test.describe("会話の再生", () => {
  for (const { path, lang } of PAGES) {
    test(`${path}：動画欄の会話を口パクで 1 回だけ再生し、立ち絵のすてぶるくんも話し、最後は休みのコマに戻る`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await installRecorder(page);
      await page.goto(path);
      const talk = page.locator("#videos .talk");
      const castMouth = page.locator("#videos .cast-kun .kun-mouth");
      const restMouth = (await castMouth.getAttribute("src")).split("/").pop();
      const texts = await talk.locator(".talk-text").allTextContents();

      // 会話を画面に入れると、15 秒以内に話し始める
      await scrollCenter(talk);
      await waitFor(page, "is-speaking が付く", (e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking"));
      await waitFor(
        page,
        "どれかの顔が「話す」コマになる",
        (e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face") && TALK_FRAME.test(e.file)
      );

      // 再生が終わる：is-played、is-speaking は無く、全部の顔が休みかまばたきのコマ
      await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 15_000 });
      await expect(page.locator("#videos .talk-line.is-speaking")).toHaveCount(0);
      const faces = await readFaces(page, "#videos");
      expect(faces.length).toBeGreaterThan(0);
      for (const f of faces) {
        expect(FACE[f.face], `data-face「${f.face}」は設計書の表にある`).toBeTruthy();
        expect(restOrBlinkOf(f.face).has(f.file), `${f.face} の顔が休みかまばたきのコマ（今は ${f.file}）`).toBe(true);
      }

      const evs = await events(page);

      // 顔の差し替えは、その顔の表のコマだけ。「話す」コマは、その行が話している間だけ
      const faceEvents = evs.filter((e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face"));
      for (const e of faceEvents) {
        expect(framesOf(e.face).has(e.file), `${e.face} に表に無いコマ ${e.file}`).toBe(true);
        if (TALK_FRAME.test(e.file)) {
          expect(e.speaking, `${e.face} の ${e.file} は話している行でだけ使う`).toBe(true);
        }
      }

      // 行は上から順に 1 つずつ。話す時間は文字数から、行のあいだは 450ms
      const windows = speakingWindows(evs, "videos");
      expect(windows.map((w) => w.line), "上の行から順に").toEqual(texts.map((_, i) => i));
      windows.forEach((w, i) => {
        const expected = speakMs(texts[i], lang);
        expect(Math.abs(w.end - w.start - expected), `${i + 1} 行目：話す時間（想定 ${expected}ms、実際 ${Math.round(w.end - w.start)}ms）`)
          .toBeLessThanOrEqual(Math.max(400, expected * 0.25));
        if (i > 0) {
          const gap = w.start - windows[i - 1].end;
          expect(gap, `${i} 行目と ${i + 1} 行目のあいだ（${Math.round(gap)}ms）`).toBeGreaterThanOrEqual(350);
          expect(gap, `${i} 行目と ${i + 1} 行目のあいだ（${Math.round(gap)}ms）`).toBeLessThanOrEqual(2500);
        }
      });

      // 立ち絵のすてぶるくん：すてぶるくんの行のあいだだけ mouth-talk-* になり、目は eyes-open、終わったら休みの口
      const kunWindows = windows.filter((w) => w.kun);
      expect(kunWindows.length).toBeGreaterThan(0);
      const castEvents = evs.filter((e) => e.k === "src" && e.sec === "videos" && e.kun === "cast");
      const mouthTalk = castEvents.filter((e) => hasCls(e, "kun-mouth") && KUN_TALK_MOUTH.test(e.file));
      expect(mouthTalk.length, "立ち絵のすてぶるくんの口が mouth-talk-* になる").toBeGreaterThan(0);
      for (const e of mouthTalk) {
        expect(
          kunWindows.some((w) => e.t >= w.start - 150 && e.t <= w.end + 150),
          "口が動くのは、すてぶるくんの行のあいだだけ"
        ).toBe(true);
      }
      for (const e of castEvents.filter((x) => hasCls(x, "kun-eyes"))) {
        if (kunWindows.some((w) => e.t > w.start + 150 && e.t < w.end)) {
          expect(e.file, "話している間、立ち絵のすてぶるくんの目は eyes-open").toBe("eyes-open.webp");
        }
      }
      await expect(castMouth).toHaveAttribute("src", new RegExp(`${restMouth}$`));

      // 立ち絵のすてぶるちゃん：1 行目は得意げ（proud）、3 行目は左下のすてぶるくんを指さして（point）話す。
      // くんの行のあいだは話さない（口パクの絵にならない）。動画欄に palm・座布団は出ない
      expect(windows.map((w) => (w.kun ? "kun" : "chan"))).toEqual(["chan", "kun", "chan"]);
      await expectChanSpeaks(page, "videos", windows[0], "proud", "1 行目");
      await expectChanSpeaks(page, "videos", windows[2], "point", "3 行目");
      const chanAll = chanEvents(await events(page), "cast", "videos");
      const allowed = /^(normal-0|proud-[012]|point-[012]|blink-half|blink-normal)\.webp$/;
      for (const e of chanAll) {
        expect(e.file, `動画欄の立ち絵が使う絵（${e.file}）`).toMatch(allowed);
      }
      const kunLine = windows[1];
      for (const e of chanAll.filter((x) => x.t > kunLine.start + 50 && x.t < kunLine.end)) {
        expect(e.file, "くんの行のあいだ、ちゃんは口パクしない").toMatch(/^(normal-0|blink-half|blink-normal|proud-0)\.webp$/);
      }
      await expect(page.locator("#videos .cast-chan")).toHaveAttribute("src", /normal-0\.webp$/, { timeout: 10_000 });

      // 再生のあとも、画面にいる間は顔がまばたきする（まばたきのコマを出して、休みのコマに戻る）
      const mark = (await events(page)).length;
      const isBlink = (e) =>
        e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face") && FACE[e.face] && e.file === `${FACE[e.face].blink}.webp`;
      await expect
        .poll(async () => (await events(page)).slice(mark).some(isBlink), { message: "再生のあとにまばたきする", timeout: 15_000 })
        .toBe(true);
      await expect.poll(async () => {
        const after = (await events(page)).slice(mark);
        const blink = after.find(isBlink);
        const back = after.find((e) => e.k === "src" && e.id === blink.id && e.t > blink.t);
        return back ? { rest: back.file === `${FACE[blink.face].rest}.webp`, ms: back.t - blink.t } : null;
      }).toMatchObject({ rest: true });
      const afterBlink = (await events(page)).slice(mark);
      const blinkEvent = afterBlink.find(isBlink);
      const backEvent = afterBlink.find((e) => e.k === "src" && e.id === blinkEvent.id && e.t > blinkEvent.t);
      expect(backEvent.t - blinkEvent.t, "まばたきのコマは 120ms ほど").toBeGreaterThan(60);
      expect(backEvent.t - blinkEvent.t, "まばたきのコマは 120ms ほど").toBeLessThan(1000);

      // 1 回だけ：画面から出てまた戻っても、もう再生しない
      const speakingCount = async () =>
        (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;
      const before = await speakingCount();
      await scrollTop(page, 0);
      await page.waitForTimeout(300);
      await scrollCenter(talk);
      await page.waitForTimeout(1500);
      expect(await speakingCount(), "再生は 1 回だけ").toBe(before);
      expect(errors).toEqual([]);
    });

    test(`${path}：相談欄の会話で、ちゃんの行のあいだは手のひら（palm）で示し、最後に座布団を 3 秒見せて normal-0 に戻る`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await installRecorder(page);
      await page.goto(path);
      const talk = page.locator("#early-access .talk");
      const chan = page.locator("#early-access .cast-chan");
      await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);
      await expect(chan).toHaveAttribute("data-chan", "cast");
      await scrollCenter(talk);
      await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });

      const evs = await events(page);
      const windows = speakingWindows(evs, "early-access");
      expect(windows.map((w) => (w.kun ? "kun" : "chan"))).toEqual(["kun", "chan", "kun"]);
      await expectChanSpeaks(page, "early-access", windows[1], "palm", "ちゃんの行");

      // くんの行のあいだは話さない。最初の行の前に手を出さない
      const chanAll = chanEvents(evs, "cast", "early-access");
      for (const e of chanAll.filter((x) => x.t < windows[1].start)) {
        expect(e.file, "ちゃんが話し始めるまで、仕草の絵にならない").toMatch(/^(normal-0|blink-half|blink-normal)\.webp$/);
      }

      // 最後の行が終わったら座布団（zabuton）を 3 秒見せて、normal-0 に戻る
      await expect
        .poll(async () => chanEvents(await events(page), "cast", "early-access").some((e) => e.file === "zabuton.webp"), {
          message: "最後に座布団になる",
          timeout: 10_000,
        })
        .toBe(true);
      const last = windows[2];
      const zabuton = chanEvents(await events(page), "cast", "early-access").find((e) => e.file === "zabuton.webp");
      expect(zabuton.t - last.end, `座布団は最後の行が終わるころ（今は ${Math.round(zabuton.t - last.end)}ms 後）`).toBeGreaterThanOrEqual(-150);
      expect(zabuton.t - last.end, `座布団は最後の行が終わるころ（今は ${Math.round(zabuton.t - last.end)}ms 後）`).toBeLessThanOrEqual(900);
      await expect
        .poll(
          async () =>
            chanEvents(await events(page), "cast", "early-access").some((e) => e.t > zabuton.t && e.file === "normal-0.webp"),
          { message: "座布団のあと normal-0 に戻る", timeout: 10_000 }
        )
        .toBe(true);
      const back = chanEvents(await events(page), "cast", "early-access").find((e) => e.t > zabuton.t && e.file === "normal-0.webp");
      expect(back.from, "座布団から normal-0 に戻る").toBe("zabuton.webp");
      expect(back.t - zabuton.t, `座布団は 3 秒ほど（今は ${Math.round(back.t - zabuton.t)}ms）`).toBeGreaterThanOrEqual(2900);
      expect(back.t - zabuton.t, `座布団は 3 秒ほど（今は ${Math.round(back.t - zabuton.t)}ms）`).toBeLessThanOrEqual(3700);
      await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);

      // 立ち絵のすてぶるくんは、くんの行のあいだだけ口を動かす
      const kunWindows = windows.filter((w) => w.kun);
      const mouthTalk = evs.filter(
        (e) => e.k === "src" && e.sec === "early-access" && e.kun === "cast" && hasCls(e, "kun-mouth") && KUN_TALK_MOUTH.test(e.file)
      );
      expect(mouthTalk.length).toBeGreaterThan(0);
      for (const e of mouthTalk) {
        expect(kunWindows.some((w) => e.t >= w.start - 150 && e.t <= w.end + 150)).toBe(true);
      }
      expect(errors).toEqual([]);
    });
  }

  test("再生の途中で画面の外へ出たら、そこで打ち切って、顔と立ち絵を休みのコマに戻す（もう再生しない）", async ({ page }) => {
    test.setTimeout(90_000);
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const speakingCount = async () =>
      (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;
    await scrollCenter(talk);
    await waitFor(page, "話し始める", (e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking"));
    await waitFor(page, "立ち絵のちゃんが話す", (e) => e.k === "src" && e.chan === "cast" && /^proud-[12]\.webp$/.test(e.file));

    // 画面の外へ出ると、そこで打ち切る（is-played が付く）。最後の行までは進まない
    await scrollTop(page, 0);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 15_000 });
    await expect(page.locator("#videos .talk-line.is-speaking")).toHaveCount(0);
    for (const f of await readFaces(page, "#videos")) {
      expect(restOrBlinkOf(f.face).has(f.file), `${f.face} の顔が休みのコマ（今は ${f.file}）`).toBe(true);
    }
    await expect(page.locator("#videos .cast-chan"), "立ち絵のちゃんも休みのコマ").toHaveAttribute("src", /normal-0\.webp$/, {
      timeout: 10_000,
    });
    // 次の行は始まらない。戻ってきても再生しない
    const cut = await speakingCount();
    await page.waitForTimeout(1500);
    expect(await speakingCount(), "打ち切ったあとは次の行に進まない").toBe(cut);
    await scrollCenter(talk);
    await page.waitForTimeout(1500);
    expect(await speakingCount(), "打ち切ったあとは再生しない").toBe(cut);
    expect(cut, "最後の行まで進んでいない").toBeLessThan(3);
  });

  test("タブが隠れている間は会話を始めず、再生中に隠れたら止めて（立ち絵も休みに戻して）、表示に戻ると最初から再生する", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const castChan = page.locator("#videos .cast-chan");
    const speakingCount = async () =>
      (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;
    const faceChanges = async () =>
      (await events(page)).filter((e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face")).length;
    const chanChanges = async () => chanEvents(await events(page), "cast", "videos").length;

    // 隠れたまま会話を画面に入れても、話し始めない
    await setHidden(page, true);
    await scrollCenter(talk);
    await page.waitForTimeout(2500);
    expect(await speakingCount(), "隠れている間は話し始めない").toBe(0);

    // 表示に戻ると話し始める（1 行目はちゃんの proud）
    await setHidden(page, false);
    await waitFor(page, "話し始める", (e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking"));
    await waitFor(page, "立ち絵のちゃんが話す", (e) => e.k === "src" && e.chan === "cast" && /^proud-[12]\.webp$/.test(e.file));

    // 再生中に隠れると、話している行が止まり、顔と立ち絵は休みのコマに戻る。再生済みにはしない
    await setHidden(page, true);
    await expect(page.locator("#videos .talk-line.is-speaking")).toHaveCount(0);
    await expect(talk).not.toHaveClass(/\bis-played\b/);
    for (const f of await readFaces(page, "#videos")) {
      expect(restOrBlinkOf(f.face).has(f.file), `${f.face} の顔が休みのコマ（今は ${f.file}）`).toBe(true);
    }
    await expect(castChan, "立ち絵のちゃんも休みのコマ").toHaveAttribute("src", /normal-0\.webp$/);
    // 隠れている間は、顔の絵も立ち絵も替えない（口パクもまばたきも止まる）
    const frozenFaces = await faceChanges();
    const frozenChan = await chanChanges();
    const frozenLines = await speakingCount();
    await page.waitForTimeout(2500);
    expect(await faceChanges(), "隠れている間は顔の絵を替えない").toBe(frozenFaces);
    expect(await chanChanges(), "隠れている間は立ち絵の絵を替えない").toBe(frozenChan);
    expect(await speakingCount(), "隠れている間は次の行に進まない").toBe(frozenLines);

    // 表示に戻ると、最初の行から最後まで再生する
    await setHidden(page, false);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    const windows = speakingWindows(await events(page), "videos");
    expect(windows.slice(-3).map((w) => w.line), "戻ったあとは 1 行目から順に話す").toEqual([0, 1, 2]);
    expect(errors).toEqual([]);
  });

  test("会話の顔のコマを読んでいる途中でタブが隠れても、話し始めない（表示に戻ると再生する）", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // 会話の顔のコマを 2.5 秒遅らせる（再生の前の先読み待ちは最大 1500ms）
    await page.route("**/assets/char/talk/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const speakingCount = async () =>
      (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;

    // 画面に入れて 400ms の待ちのあと、先読みを待っている間に隠す（待ちの途中で隠れた場合も、同じく始まらない）
    await scrollCenter(talk);
    await page.waitForTimeout(900);
    expect(await speakingCount(), "先読みが済むまでは話し始めない").toBe(0);
    await setHidden(page, true);
    await page.waitForTimeout(3000);
    expect(await speakingCount(), "隠れている間は話し始めない").toBe(0);
    await expect(talk).not.toHaveClass(/\bis-played\b/);

    await setHidden(page, false);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    expect(speakingWindows(await events(page), "videos").map((w) => w.line)).toEqual([0, 1, 2]);
    expect(errors).toEqual([]);
  });

  test("ページの読み込み（load）が終わる前に相談欄の会話が始まっても、立ち絵が palm になり、口パクして、座布団も出す", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // ロゴの画像を止めて、window の load を遅らせる（すぐには要らないコマの先読みは load の後）
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/logo-wordmark-suteburu-black.png", async (route) => {
      await gate;
      await route.continue();
    });
    await installRecorder(page);
    try {
      await page.goto("/#early-access", { waitUntil: "domcontentloaded" });
      const talk = page.locator("#early-access .talk");
      await scrollCenter(talk);
      await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
      expect(await page.evaluate(() => document.readyState), "まだ load の前").not.toBe("complete");

      const evs = await events(page);
      expect(
        evs.some((e) => e.k === "src" && e.sec === "early-access" && e.chan === "cast" && /^palm-[12]\.webp$/.test(e.file)),
        "すてぶるちゃんの行で、立ち絵が palm になる"
      ).toBe(true);
      expect(
        evs.some((e) => e.k === "src" && e.sec === "early-access" && e.kun === "cast" && KUN_TALK_MOUTH.test(e.file)),
        "すてぶるくんの行で、立ち絵が口パクする"
      ).toBe(true);
      await waitFor(page, "最後に座布団になる", (e) => e.k === "src" && e.sec === "early-access" && e.chan === "cast" && e.file === "zabuton.webp");
      expect(errors).toEqual([]);
    } finally {
      release();
    }
  });

  test("休みのコマが読めないときは、話し終わったら HTML に書いた絵に戻す（最後の口パクの絵を残さない）", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.route("**/assets/char/talk/chan-normal-0.webp", (route) => route.fulfill({ status: 404, body: "" }));
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const authored = await readFaces(page, "#videos");
    expect(authored[0], "1 行目は chan normal で、HTML の絵は chan-normal-1").toEqual({
      face: "chan normal",
      file: "chan-normal-1.webp",
    });

    await scrollCenter(talk);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    const evs = await events(page);
    const first = evs.filter((e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face") && e.line === 0);
    expect(first.some((e) => /^chan-normal-2\.webp$/.test(e.file)), "1 行目は口パクした").toBe(true);
    expect(first.some((e) => e.file === "chan-normal-0.webp"), "読めなかったコマは使わない").toBe(false);
    // 終わったあとは HTML の絵（まばたきの途中なら、まばたきのコマ）
    const now = (await readFaces(page, "#videos"))[0].file;
    expect(["chan-normal-1.webp", "chan-blink-normal.webp"], `1 行目の顔（今は ${now}）`).toContain(now);
    expect(errors).toEqual([]);
  });

  test("立ち絵の palm のコマが読めないときは、palm を使わず normal の口パクで話す（読めていない形は normal）", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.route("**/assets/char/chan/palm-*.webp", (route) => route.fulfill({ status: 404, body: "" }));
    // normal のコマは、normal の形で話す行がある会話のときに先読みされる。動画欄の 3 行目を normal の形にして、先に再生しておく
    await rewriteHome(page, dropVideosPoint);
    await installRecorder(page);
    await page.goto("/");
    const videos = page.locator("#videos .talk");
    await scrollCenter(videos);
    await expect(videos).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    const talk = page.locator("#early-access .talk");
    await scrollCenter(talk);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });

    const evs = await events(page);
    const windows = speakingWindows(evs, "early-access");
    const mine = chanEvents(evs, "cast", "early-access");
    expect(mine.some((e) => /^palm-/.test(e.file)), "読めなかった palm は使わない").toBe(false);
    const during = spokenFrames(evs, "early-access", windows[1]);
    expect(during.length, "ちゃんの行のあいだ、絵は替わる").toBeGreaterThan(0);
    for (const e of during) {
      expect(e.file, `読めない形は normal の口パク（今は ${e.file}）`).toMatch(/^normal-[012]\.webp$/);
    }
    expect(during.some((e) => /^normal-[12]\.webp$/.test(e.file)), "normal-1 か normal-2 になる").toBe(true);
    // ほかの絵（座布団）は読めるので出る。終わったら normal-0
    await waitFor(page, "座布団は出る", (e) => e.k === "src" && e.chan === "cast" && e.file === "zabuton.webp");
    await expect(page.locator("#early-access .cast-chan")).toHaveAttribute("src", /normal-0\.webp$/, { timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  for (const { path } of PAGES) {
    test(`${path}：palm のコマが読めないとき（HTML は書き換えない）、相談欄の会話で palm は一度も出ず、ちゃんは normal-0 のまま、最後の座布団は出て 3 秒で normal-0 に戻る`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push({ text: msg.text(), url: msg.location().url });
        }
      });
      const requested = new Set();
      page.on("request", (request) => requested.add(new URL(request.url()).pathname.split("/").pop()));
      let palmRequests = 0;
      await page.route("**/assets/char/chan/palm-*.webp", (route) => {
        palmRequests++;
        return route.fulfill({ status: 404, body: "" });
      });
      await installRecorder(page);
      await page.goto(path);

      // 相談欄だけを画面に入れる（動画欄の会話は normal の形で話す行があり、normal-1/2 を先読みしてしまうので、再生させない）
      const talk = page.locator("#early-access .talk");
      const chan = page.locator("#early-access .cast-chan");
      await scrollCenter(talk);
      await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
      await expect(page.locator("#videos .talk"), "動画欄は再生していない").not.toHaveClass(/\bis-played\b/);
      expect(palmRequests, "palm のコマは読もうとして、404 になった").toBeGreaterThan(0);
      // この確認は、normal-1/2 が先読みされていない（読めているのは normal-0 だけ）ことを前提にしている
      expect([...requested].filter((f) => /^normal-[12]\.webp$/.test(f)), "normal-1/2 は読んでいない").toEqual([]);

      const evs = await events(page);
      const windows = speakingWindows(evs, "early-access");
      expect(windows.map((w) => (w.kun ? "kun" : "chan"))).toEqual(["kun", "chan", "kun"]);
      expect(evs.filter((e) => e.k === "src" && /^palm-/.test(e.file)), "palm はどこにも出ない").toEqual([]);

      // ちゃんの行のあいだ：口は動かず（normal-1/2 が無い）、まばたきもせず、normal-0 のまま。
      // 話し始めがまばたきの途中だったときの「normal-0 に戻す」1 回だけは除く
      const mine = chanEvents(evs, "cast", "early-access");
      const line = windows[1];
      expect(
        mine
          .filter((e) => e.t >= line.start && e.t <= line.end + 700 && !(e.file === "normal-0.webp" && /^blink-/.test(e.from)))
          .map((e) => `${e.from} → ${e.file}`),
        "ちゃんの行のあいだ、立ち絵の絵は替わらない（normal-0 のまま）"
      ).toEqual([]);
      expect(
        mine.filter((e) => /^(?!normal-0|blink-)/.test(e.file)).map((e) => e.file),
        "座布団のほかに、normal-0・まばたき以外の絵にならない"
      ).toEqual(["zabuton.webp"]);

      // 最後の行のあと、座布団（読めている）が出て、3 秒ほどで normal-0 に戻る
      await expect
        .poll(async () => chanEvents(await events(page), "cast", "early-access").some((e) => e.file === "zabuton.webp"), {
          message: "最後に座布団になる",
          timeout: 10_000,
        })
        .toBe(true);
      const last = windows[2];
      const zabuton = chanEvents(await events(page), "cast", "early-access").find((e) => e.file === "zabuton.webp");
      expect(zabuton.t - last.end, `座布団は最後の行が終わるころ（今は ${Math.round(zabuton.t - last.end)}ms 後）`).toBeGreaterThanOrEqual(-150);
      expect(zabuton.t - last.end, `座布団は最後の行が終わるころ（今は ${Math.round(zabuton.t - last.end)}ms 後）`).toBeLessThanOrEqual(900);
      await expect
        .poll(
          async () =>
            chanEvents(await events(page), "cast", "early-access").some((e) => e.t > zabuton.t && e.file === "normal-0.webp"),
          { message: "座布団のあと normal-0 に戻る", timeout: 10_000 }
        )
        .toBe(true);
      const back = chanEvents(await events(page), "cast", "early-access").find((e) => e.t > zabuton.t && e.file === "normal-0.webp");
      expect(back.from, "座布団から normal-0 に戻る").toBe("zabuton.webp");
      expect(back.t - zabuton.t, `座布団は 3 秒ほど（今は ${Math.round(back.t - zabuton.t)}ms）`).toBeGreaterThanOrEqual(2900);
      expect(back.t - zabuton.t, `座布団は 3 秒ほど（今は ${Math.round(back.t - zabuton.t)}ms）`).toBeLessThanOrEqual(3700);
      await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);

      // エラーは出ない。コンソールのエラーは、palm の 404（わざと失敗させた読み込み）と、フィクスチャが止めた計測のタグ（ANALYTICS）だけ
      expect(errors).toEqual([]);
      expect(consoleErrors.filter((c) => /\/chan\/palm-[012]\.webp$/.test(c.url)).length, "palm の 404 はコンソールに出る").toBeGreaterThan(0);
      expect(
        consoleErrors.filter((c) => !/\/chan\/palm-[012]\.webp$/.test(c.url) && !ANALYTICS.test(c.url)),
        "palm の 404・止めた計測タグ以外のコンソールエラー"
      ).toEqual([]);
    });
  }

  test("data-pose が無い行は顔の表情から決め（proud は proud、serious は normal）、知らない data-pose は normal になる", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // 配信される HTML を書き換える：動画欄の 1 行目は data-pose を外して顔を chan proud に、3 行目は data-pose を外す（顔は chan serious）。
    // 相談欄のちゃんの行は data-pose="bogus"。（normal のコマは動画欄の 3 行目が先読みする）
    await rewriteHome(page, (source) => {
      let html = source.replace(/<p class="talk-line talk-chan" data-pose="proud">(.*?)data-face="chan normal"/s, (_, mid) => {
        return `<p class="talk-line talk-chan">${mid}data-face="chan proud"`;
      });
      html = dropVideosPoint(html);
      return html.replace('<p class="talk-line talk-chan" data-pose="palm">', '<p class="talk-line talk-chan" data-pose="bogus">');
    });
    await installRecorder(page);
    await page.goto("/");
    expect(await page.locator("#videos .talk-line").first().getAttribute("data-pose"), "書き換えが効いている").toBeNull();
    const videos = page.locator("#videos .talk");
    await scrollCenter(videos);
    await expect(videos).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    const guest = page.locator("#early-access .talk");
    await scrollCenter(guest);
    await expect(guest).toHaveClass(/\bis-played\b/, { timeout: 25_000 });

    const evs = await events(page);
    const during = (sec, w) => spokenFrames(evs, sec, w).map((e) => e.file);
    const v = speakingWindows(evs, "videos");
    expect(during("videos", v[0]).length, "1 行目は口パクする").toBeGreaterThan(0);
    expect(during("videos", v[0]).every((f) => /^proud-[012]\.webp$/.test(f)), "顔が chan proud なら proud の口パク").toBe(true);
    expect(during("videos", v[2]).length, "3 行目は口パクする").toBeGreaterThan(0);
    expect(during("videos", v[2]).every((f) => /^normal-[012]\.webp$/.test(f)), "顔が chan serious なら normal の口パク").toBe(true);
    const g = speakingWindows(evs, "early-access");
    expect(during("early-access", g[1]).length, "相談欄のちゃんの行は口パクする").toBeGreaterThan(0);
    expect(during("early-access", g[1]).every((f) => /^normal-[012]\.webp$/.test(f)), "知らない data-pose は normal の口パク").toBe(true);
    expect(errors).toEqual([]);
  });

  test("IntersectionObserver の無いブラウザでは、何も動かさず、エラーも出さない", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      delete window.IntersectionObserver;
    });
    await installRecorder(page);
    await page.goto("/");
    await scrollCenter(page.locator("#videos .talk"));
    await page.waitForTimeout(3000);
    const mine = (await events(page)).filter((e) => e.kun || e.chan || e.face || hasCls(e, "talk") || hasCls(e, "talk-line"));
    expect(mine, "キャラの絵もクラスも替わらない").toEqual([]);
    expect(await page.locator(".kun-rig.is-live, [data-chan].is-live, .talk.is-played").count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

// ─── 4. 生きている間だけ動く・上下 ───────────────────────────────────────────

test("生きている間だけ動く：画面に入っていて、タブが表示中のときだけ is-live が付き、CSS の動き（上下・呼吸・揺れ）が働く", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto("/");
  const rig = page.locator(HERO_RIG);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });

  // 上下（腕と体）・呼吸・腕の揺れ・すてぶるちゃんの上下（腕は手を振っている間だけ kun-wave に替わる）。足は動かない
  await expect.poll(() => animationName(rig.locator(".kun-bob"))).toBe("kun-bob");
  expect(await animationName(rig.locator(".kun-body"))).toBe("kun-breathe");
  expect(await animationName(rig.locator(".kun-arm-l"))).toBe("kun-arm-l-sway");
  expect(["kun-arm-r-sway", "kun-wave"]).toContain(await animationName(rig.locator(".kun-arm-r")));
  expect(await animationName(page.locator(HERO_CHAN))).toBe("chan-bob");
  expect(await animationName(rig.locator(".kun-foot-l")), "左足は動かない").toBe("none");
  expect(await animationName(rig.locator(".kun-foot-r")), "右足は動かない").toBe("none");
  expect(await animationName(rig), "すてぶるくんの枠そのものは動かない").toBe("none");

  // 周期：すてぶるくんの上下・呼吸・腕の揺れは 2.6 秒でそろい、すてぶるちゃんの上下は 3.2 秒
  const duration = (locator) => locator.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(await duration(rig.locator(".kun-bob")), "kun-bob").toBe("2.6s");
  expect(await duration(rig.locator(".kun-body")), "kun-breathe").toBe("2.6s");
  expect(await duration(rig.locator(".kun-arm-l")), "kun-arm-l-sway").toBe("2.6s");
  expect(await duration(page.locator(HERO_CHAN)), "chan-bob").toBe("3.2s");

  // 画面に入っていない立ち絵は生きていない
  const cast = page.locator("#videos .cast-kun");
  const castChan = page.locator("#videos .cast-chan");
  await expect(cast).not.toHaveClass(IS_LIVE);
  expect(await animationName(cast.locator(".kun-bob"))).toBe("none");
  expect(await animationName(cast.locator(".kun-body"))).toBe("none");
  expect(await animationName(castChan)).toBe("none");

  // ページの下までスクロールすると、ヒーローの is-live が外れ、CSS の動きも止まる
  await scrollCenter(page.locator("#early-access"));
  await expect(rig).not.toHaveClass(IS_LIVE);
  expect(await animationName(rig.locator(".kun-bob"))).toBe("none");
  expect(await animationName(rig.locator(".kun-body"))).toBe("none");
  expect(await animationName(page.locator(HERO_CHAN))).toBe("none");

  // 動画欄に入ると、そこの立ち絵（くんもちゃんも）が生きる
  await scrollCenter(page.locator("#videos .cast"));
  await expect(cast).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await expect(castChan).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await expect.poll(() => animationName(cast.locator(".kun-bob"))).toBe("kun-bob");
  await expect.poll(() => animationName(cast.locator(".kun-body"))).toBe("kun-breathe");
  expect(await animationName(castChan)).toBe("chan-bob");
  expect(await animationName(cast.locator(".kun-foot-l"))).toBe("none");

  // 戻ると、またヒーローが生きる
  await scrollTop(page, 0);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });

  // タブが隠れると止まり、戻ると動く（visibilitychange を拾う）
  await setHidden(page, true);
  await expect(rig).not.toHaveClass(IS_LIVE);
  await expect(page.locator(HERO_CHAN)).not.toHaveClass(IS_LIVE);
  await setHidden(page, false);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await expect(page.locator(HERO_CHAN)).toHaveClass(IS_LIVE, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

// 動きの中ほど（50%）まで進めて止め、いまの translateY を返す（Web Animations API はテストの側でだけ使う）
const seekTranslate = (locator, name, fraction) =>
  locator.evaluate(
    (el, [animation, at]) => {
      const a = el.getAnimations().find((x) => x.animationName === animation);
      if (!a) {
        return null;
      }
      a.pause();
      a.currentTime = a.effect.getComputedTiming().duration * at;
      const m = /^matrix\(([^)]*)\)$/.exec(getComputedStyle(el).transform);
      return { y: m ? Number(m[1].split(",")[5]) : 0, height: el.offsetHeight };
    },
    [name, fraction]
  );

test("上下：腕と体（.kun-bob）が約 2.5%、すてぶるちゃんが約 1.8% 持ち上がり、足は動かない", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const rig = page.locator(HERO_RIG);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await expect(page.locator(HERO_CHAN)).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await settled(page, ".hero-cast"); // 登場のせり上がりが終わってから測る
  const foot = rig.locator(".kun-foot-l");
  const bob = rig.locator(".kun-bob");
  const rectOf = (locator) => locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });

  // 動きの始め（0%）：すべて元の位置
  const start = await seekTranslate(bob, "kun-bob", 0);
  expect(start, "kun-bob の動きがある").toBeTruthy();
  expect(Math.abs(start.y), "始めは元の位置").toBeLessThanOrEqual(0.05);
  const footStart = await rectOf(foot);
  const bobStart = await rectOf(bob);

  // 中ほど（50%）：体と腕の枠が高さの 2.5% だけ上がる。足は動かない
  const peak = await seekTranslate(bob, "kun-bob", 0.5);
  expect(peak.y, "kun-bob は上へ高さの 2.5%").toBeLessThan(0);
  expect(Math.abs(peak.y + peak.height * 0.025), `kun-bob の持ち上がり ${peak.y.toFixed(2)}px（高さ ${peak.height}px の 2.5%）`).toBeLessThanOrEqual(0.3);
  const footPeak = await rectOf(foot);
  const bobPeak = await rectOf(bob);
  expect(footPeak, "足は動かない").toEqual(footStart);
  expect(bobStart.top - bobPeak.top, "体と腕の枠は実際に上がる").toBeGreaterThan(1);
  expect(bobPeak.top, "体と腕は下には沈まない").toBeLessThan(bobStart.top);

  // すてぶるちゃん：絵の高さの 1.8%
  const chan = page.locator(HERO_CHAN);
  expect(Math.abs((await seekTranslate(chan, "chan-bob", 0)).y), "始めは元の位置").toBeLessThanOrEqual(0.05);
  const chanPeak = await seekTranslate(chan, "chan-bob", 0.5);
  expect(chanPeak.y, "chan-bob は上へ").toBeLessThan(0);
  expect(Math.abs(chanPeak.y + chanPeak.height * 0.018), `chan-bob の持ち上がり ${chanPeak.y.toFixed(2)}px（高さ ${chanPeak.height}px の 1.8%）`).toBeLessThanOrEqual(0.3);
});

// ─── 5. reduce ──────────────────────────────────────────────────────────────

test("reduce：体が動くもの（上下・呼吸・腕の揺れ・手を振る・登場）は止まり、まばたきと会話は残る", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installRecorder(page);
  await page.goto("/");
  const rig = page.locator(HERO_RIG);
  const chan = page.locator(HERO_CHAN);

  expect(await animationName(rig.locator(".kun-bob")), "上下").toBe("none");
  expect(await animationName(rig.locator(".kun-body")), "呼吸").toBe("none");
  expect(await animationName(rig.locator(".kun-arm-l")), "腕の揺れ").toBe("none");
  expect(await animationName(chan), "すてぶるちゃんの上下").toBe("none");

  // まばたきは残る＝ヒーローは動いている（すてぶるくんもすてぶるちゃんも）。そのうえで登場のポーズ送りも手振りも起きない
  await expect
    .poll(
      async () => {
        const files = (await events(page))
          .filter((e) => e.k === "src" && hasCls(e, "kun-eyes") && e.kun === "hero")
          .map((e) => e.file);
        return hasRun(files, ["eyes-half.webp", "eyes-closed.webp", "eyes-half.webp", "eyes-open.webp"]);
      },
      { message: "reduce でもすてぶるくんがまばたきする", timeout: 15_000 }
    )
    .toBe(true);
  await expect
    .poll(
      async () => blinkGroups(chanEvents(await events(page), "hero")).length > 0,
      { message: "reduce でもすてぶるちゃんがまばたきする", timeout: 20_000 }
    )
    .toBe(true);
  await page.waitForFunction(() => performance.now() > 3200);
  const evs = await events(page);
  expect(evs.some((e) => e.k === "class" && e.added.includes("is-waving")), "手を振らない").toBe(false);
  const heroFiles = chanEvents(evs, "hero").map((e) => e.file);
  expect(heroFiles, "登場のポーズ送り（side-glance・look-camera）をしない").not.toContain("side-glance.webp");
  expect(heroFiles, "登場のポーズ送り（side-glance・look-camera）をしない").not.toContain("look-camera.webp");
  for (const file of heroFiles) {
    expect(file, `reduce のヒーローが使う絵（${file}）`).toMatch(/^(normal-0|blink-half|blink-normal|proud-0|fist)\.webp$/);
  }
  await expect(chan).toHaveAttribute("src", /(normal-0|blink-half|blink-normal|proud-0|fist)\.webp$/);
  await expect(rig).not.toHaveClass(/\bis-waving\b/);

  // 会話は再生される（口パクは残る）。立ち絵のちゃんも仕草をする（絵の差し替えだけ）
  const talk = page.locator("#videos .talk");
  await scrollCenter(talk);
  await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
  const after = await events(page);
  expect(
    after.some((e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face") && TALK_FRAME.test(e.file)),
    "reduce でも顔が口パクする"
  ).toBe(true);
  expect(
    after.some((e) => e.k === "src" && e.sec === "videos" && e.kun === "cast" && KUN_TALK_MOUTH.test(e.file)),
    "reduce でも立ち絵のすてぶるくんが口パクする"
  ).toBe(true);
  expect(
    after.some((e) => e.k === "src" && e.sec === "videos" && e.chan === "cast" && /^proud-[12]\.webp$/.test(e.file)),
    "reduce でも立ち絵のすてぶるちゃんが proud の口パクをする"
  ).toBe(true);

  // CSS：画面に入って is-live が付いても、手を振っても、動きはすべて none（付けて確かめ、元に戻す）
  // （手を振るは is-live と別に、is-waving だけでも確かめる。両方付くと後ろの規則だけで none になってしまう）
  const forced = await page.evaluate(() => {
    const rigEl = document.querySelector('.kun-rig[data-kun="hero"]');
    const chanEl = document.querySelector(".hero-cast-chan");
    const name = (el) => getComputedStyle(el).animationName;
    const hadLive = rigEl.classList.contains("is-live");
    const chanHadLive = chanEl.classList.contains("is-live");
    rigEl.classList.add("is-live");
    chanEl.classList.add("is-live");
    const result = {
      bob: name(rigEl.querySelector(".kun-bob")),
      breathe: name(rigEl.querySelector(".kun-body")),
      armL: name(rigEl.querySelector(".kun-arm-l")),
      armR: name(rigEl.querySelector(".kun-arm-r")),
      chan: name(chanEl),
    };
    rigEl.classList.remove("is-live");
    rigEl.classList.add("is-waving");
    result.wave = name(rigEl.querySelector(".kun-arm-r"));
    rigEl.classList.remove("is-waving");
    if (hadLive) {
      rigEl.classList.add("is-live");
    }
    if (!chanHadLive) {
      chanEl.classList.remove("is-live");
    }
    return result;
  });
  expect(forced).toEqual({ bob: "none", breathe: "none", armL: "none", armR: "none", chan: "none", wave: "none" });
  expect(errors).toEqual([]);
});

// ─── 6. ヒーローの登場・手を振る ─────────────────────────────────────────────

test.describe("ヒーローの登場", () => {
  test("登場：見えてから、すてぶるちゃんは side-glance → look-camera（900ms）→ normal-0（1500ms）。手を振る（すてぶるくん）は 1.2 秒後に 1 回だけ", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // 登場は「スクリプト開始から 800ms 以内に初めて見えたとき」だけ。実時間だと機械の重さで窓を外すので、
    // ページの時計（setTimeout・performance.now）を止めて読み込み、時間は runFor で進める。
    // （CSS のアニメーションと画像の読み込み、IntersectionObserver は実時間のまま）
    await freezeClock(page);
    await installRecorder(page);
    const rig = page.locator(HERO_RIG);
    const chan = page.locator(HERO_CHAN);
    const heroRig = (e) => e.k === "class" && hasCls(e, "kun-rig") && e.kun === "hero";
    const heroChanFiles = async () => chanEvents(await events(page), "hero").map((e) => e.file);

    await page.goto("/");
    await expect(rig).toHaveClass(IS_LIVE, { timeout: 15_000 });
    // すてぶるちゃんは、登場の絵の先読みが済むと、まず side-glance に替わる（時計は止まったまま）
    await waitFor(page, "ヒーローのすてぶるちゃんが side-glance に替わる", (e) => e.k === "src" && e.chan === "hero");
    expect((await heroChanFiles())[0], "ヒーローの絵は、まず side-glance に替わる").toBe("side-glance.webp");
    expect((await events(page)).some((e) => heroRig(e) && e.added.includes("is-waving")), "まだ手を振らない").toBe(false);
    const start = chanEvents(await events(page), "hero")[0];
    expect(start.from, "登場の前は HTML の normal-0").toBe("normal-0.webp");

    // 900ms でこちらを向く（look-camera）。899ms まではよそ見のまま
    await page.clock.runFor(899);
    await expect(chan).toHaveAttribute("src", /side-glance\.webp$/);
    await page.clock.runFor(1);
    await expect(chan).toHaveAttribute("src", /look-camera\.webp$/);

    // 1200ms で手を振り始める（すてぶるくん）。そのあいだ、すてぶるちゃんはこちらを向いたまま
    await page.clock.runFor(300);
    await waitFor(page, "is-waving が付く", (e) => heroRig(e) && e.added.includes("is-waving"));
    const on = (await events(page)).find((e) => heroRig(e) && e.added.includes("is-waving"));
    // 手を振り始めたときの右腕の動きが kun-wave（記録した時点の値で見る）
    expect(on.armAnim, "手を振っている間は、右腕の動きが kun-wave").toBe("kun-wave");
    await expect(chan).toHaveAttribute("src", /look-camera\.webp$/);

    // 1500ms で normal-0（ほほえみ）に戻る。手振りは animationend か、遅くとも 2200ms 後（3400ms）に外れる
    await page.clock.runFor(299);
    await expect(chan).toHaveAttribute("src", /look-camera\.webp$/);
    await page.clock.runFor(1);
    await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);
    await page.clock.runFor(1900);
    await waitFor(page, "is-waving が外れる", (e) => heroRig(e) && e.removed.includes("is-waving"));
    const evs = await events(page);
    const live = evs.find((e) => heroRig(e) && e.added.includes("is-live"));
    const off = evs.find((e) => heroRig(e) && e.removed.includes("is-waving"));
    expect(on.t - live.t, "見えてから 1200ms 後に手を振る").toBeGreaterThanOrEqual(1200);
    expect(on.t - live.t, "見えてから 1200ms 後に手を振る").toBeLessThanOrEqual(1250);
    expect(off.t - on.t, "手振りは 2200ms 以内に外れる").toBeLessThanOrEqual(2250);

    const files = chanEvents(evs, "hero");
    expect(files.slice(0, 3).map((e) => e.file), "登場は side-glance → look-camera → normal-0").toEqual([
      "side-glance.webp",
      "look-camera.webp",
      "normal-0.webp",
    ]);
    expect(files[1].t - files[0].t, "side-glance の 900ms 後に look-camera").toBeGreaterThanOrEqual(900);
    expect(files[1].t - files[0].t, "side-glance の 900ms 後に look-camera").toBeLessThanOrEqual(950);
    expect(files[2].t - files[0].t, "side-glance の 1500ms 後に normal-0").toBeGreaterThanOrEqual(1500);
    expect(files[2].t - files[0].t, "side-glance の 1500ms 後に normal-0").toBeLessThanOrEqual(1550);

    // 立ち絵（data-kun="cast"）は手を振らない。ヒーローも 1 回だけ
    await page.clock.runFor(3000);
    const waves = (await events(page)).filter((e) => e.k === "class" && e.added.includes("is-waving"));
    expect(waves, "手を振るのはヒーローで 1 回だけ").toHaveLength(1);
    expect(waves[0].kun).toBe("hero");
    expect(errors).toEqual([]);
  });

  test("手を振る動きは 1.8 秒。animationend が来なくても、2200ms ちょうどで is-waving を外す（それより早くは外さない）", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await freezeClock(page);
    // animationend を window の捕捉の段階で止めて、すてぶるくんまで届かないようにする（保険のタイマーだけで外れるかを見る）
    await page.addInitScript(() => {
      window.addEventListener("animationend", (e) => e.stopImmediatePropagation(), true);
    });
    await page.goto("/");
    const rig = page.locator(HERO_RIG);
    await expect(rig).toHaveClass(IS_LIVE, { timeout: 15_000 });
    await page.clock.runFor(1200);
    await expect(rig).toHaveClass(/\bis-waving\b/);
    const arm = await rig.locator(".kun-arm-r").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, duration: cs.animationDuration, count: cs.animationIterationCount };
    });
    expect(arm, "右腕は kun-wave を 1.8 秒・1 回").toEqual({ name: "kun-wave", duration: "1.8s", count: "1" });

    // 実時間で 1.8 秒を過ぎても（animationend は止めてある）、2199ms までは振ったまま
    await page.waitForTimeout(2000);
    await page.clock.runFor(2199);
    await expect(rig).toHaveClass(/\bis-waving\b/);
    // 2200ms で外れる
    await page.clock.runFor(1);
    await expect(rig).not.toHaveClass(/\bis-waving\b/);
    expect(errors).toEqual([]);
  });

  test("登場の途中でタブが隠れたら、登場は終わりにして normal-0 に戻り、表示に戻っても登場をやり直さない", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await freezeClock(page);
    await installRecorder(page);
    await page.goto("/");
    const rig = page.locator(HERO_RIG);
    const chan = page.locator(HERO_CHAN);
    await expect(rig).toHaveClass(IS_LIVE, { timeout: 15_000 });
    await waitFor(page, "side-glance に替わる", (e) => e.k === "src" && e.chan === "hero" && e.file === "side-glance.webp");

    // 登場の途中（side-glance）で隠れる：normal-0 に戻り、時計を進めても続きは起きない
    await setHidden(page, true);
    await expect(rig).not.toHaveClass(IS_LIVE);
    await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);
    await page.clock.runFor(5000);
    await expect(chan).toHaveAttribute("src", /normal-0\.webp$/);
    expect(chanEvents(await events(page), "hero").map((e) => e.file), "登場の続き（look-camera）は起きない").toEqual([
      "side-glance.webp",
      "normal-0.webp",
    ]);

    // 表示に戻っても登場しない（まばたきと待機の仕草だけ）
    await setHidden(page, false);
    await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });
    await advance(page, 8000);
    const files = chanEvents(await events(page), "hero").map((e) => e.file);
    expect(files.filter((f) => f === "side-glance.webp"), "登場をやり直さない").toHaveLength(1);
    expect(files, "look-camera は出ない").not.toContain("look-camera.webp");
    expect(errors).toEqual([]);
  });

  test("スクリプトが動き出したときヒーローが画面に無ければ、あとで見えても手を振らず、登場もしない（normal-0 のまま、まばたきと待機の仕草だけ）", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await installRecorder(page);
    // characters.js を止めておき、ページの下までスクロールしてから動かす（ヒーローが見えないまま始まる）
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/characters.js", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForFunction(() => document.readyState !== "loading");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    release();
    await expect(page.locator("#early-access")).toBeInViewport({ timeout: 10_000 });
    await page.waitForLoadState("load");
    // スクリプト開始から 800ms をすぎるまで、下で待つ
    await page.waitForTimeout(1500);
    const rig = page.locator(HERO_RIG);
    await expect(rig).not.toHaveClass(IS_LIVE);

    await scrollTop(page, 0);
    await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });
    await page.waitForTimeout(3000);
    const evs = await events(page);
    expect(evs.some((e) => e.k === "class" && e.added.includes("is-waving")), "手を振らない").toBe(false);
    const files = chanEvents(evs, "hero").map((e) => e.file);
    expect(files, "登場のポーズ送り（side-glance）をしない").not.toContain("side-glance.webp");
    expect(files, "登場のポーズ送り（look-camera）をしない").not.toContain("look-camera.webp");
    await expect(page.locator(HERO_CHAN)).toHaveAttribute("src", /(normal-0|blink-half|blink-normal)\.webp$/);
  });
});

// ─── 6a. 先読みの観測（installAppLoadTracker）が、ページの絵に悪さをしない ──────────────────

test("先読みの観測：onload・onerror を代入しない絵には何もせず、代入した絵は元のハンドラーをそのまま呼んで、終わりを数える", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await installAppLoadTracker(page);
  await page.goto("/");
  await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 15_000 });
  await waitForAppLoads(page, HERO_SCENE); // アプリの先読みが落ち着いてから、こちらの確認を始める（読み込み中は 0 から数える）

  const r = await page.evaluate(async () => {
    const state = () => window.__appLoadState();
    const inLoaded = (url) => state().loaded.includes(new URL(url).pathname);
    const out = {};
    // HTML の img は onload・onerror を代入していない：何も包まれず null のまま
    out.domHandlers = Array.prototype.filter.call(document.images, (img) => img.onload || img.onerror).length;
    out.domCount = document.images.length;
    out.pendingAtStart = state().pending;

    // 代入した絵：元の関数がそのまま取り出せ、this・event は元のまま、呼び終えてから印が付く。読み込み中は 1 つ増えて、終わると戻る
    const url = new URL("assets/char/kun/foot-l.webp?probe=1", location.href).href;
    out.markedBefore = inLoaded(url);
    const img = new Image();
    const calls = [];
    const handler = function (event) {
      calls.push({ self: this === img, type: event.type, markedInside: inLoaded(url) });
      return "returned";
    };
    img.onload = handler;
    out.sameHandler = img.onload === handler;
    img.onerror = () => calls.push({ type: "error" });
    out.pendingDuring = state().pending;
    const done = new Promise((resolve) => img.addEventListener("load", resolve, { once: true })); // addEventListener は元のまま動く
    img.src = url;
    await done;
    out.calls = calls;
    out.markedAfter = inLoaded(url);
    out.pendingAfter = state().pending;

    // 読めない絵：onerror が呼ばれ、読み込み中から外れ、読み込み済みにはならない
    const missing = new URL("assets/char/kun/probe-missing.webp", location.href).href;
    const bad = new Image();
    const errorCalls = [];
    bad.onerror = function (event) {
      errorCalls.push({ self: this === bad, type: event.type });
    };
    const failed = new Promise((resolve) => bad.addEventListener("error", resolve, { once: true }));
    out.pendingBadStart = state().pending;
    bad.src = missing;
    await failed;
    out.errorCalls = errorCalls;
    out.missingMarked = inLoaded(missing);
    out.pendingBadEnd = state().pending;

    // 関数でない値（null）は、そのまま入って、そのまま取り出せる。ページに付けた（切り離されていない）img は、読み込み中に数えない
    const plain = new Image();
    plain.onload = null;
    out.nullKept = plain.onload === null;
    const attached = document.createElement("img");
    document.body.appendChild(attached);
    attached.onload = () => {};
    out.pendingAttached = state().pending;
    attached.remove();
    return out;
  });

  expect(r.domCount, "HTML に img がある").toBeGreaterThan(0);
  expect(r.domHandlers, "HTML の img には onload・onerror が付いていない").toBe(0);
  expect(r.pendingAtStart, "確認の前に、アプリの先読みは終わっている").toBe(0);
  expect(r.markedBefore, "読み込む前は印が無い").toBe(false);
  expect(r.sameHandler, "代入した関数がそのまま取り出せる").toBe(true);
  expect(r.pendingDuring, "代入した img は読み込み中に数える").toBe(1);
  expect(r.calls, "元のハンドラーは 1 回、this と event のまま呼ばれ、その中ではまだ印が付いていない（呼び終えてから付く）").toEqual([
    { self: true, type: "load", markedInside: false },
  ]);
  expect(r.markedAfter, "呼び終えたあと、読み込み済みの印が付く").toBe(true);
  expect(r.pendingAfter, "読み込み中から外れる").toBe(0);
  expect(r.pendingBadStart, "読めない絵も、代入すると読み込み中に数える").toBe(1);
  expect(r.errorCalls, "読めない絵は onerror が元のまま呼ばれる").toEqual([{ self: true, type: "error" }]);
  expect(r.missingMarked, "読めない絵は読み込み済みにならない").toBe(false);
  expect(r.pendingBadEnd, "読めない絵も、終わったら読み込み中から外れる").toBe(0);
  expect(r.nullKept, "null はそのまま").toBe(true);
  expect(r.pendingAttached, "ページに付けた img は読み込み中に数えない").toBe(0);
  expect(errors).toEqual([]);
});

// ─── 6b. ヒーローのまばたきと待機の仕草（ページの時計で数える） ───────────────────

test("ヒーローのすてぶるちゃん：登場のあと、2.5〜5.5 秒おきにまばたき（ときどき 2 回続け）、12〜20 秒おきに proud か fist の仕草をする", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await installAppLoadTracker(page);
  await seedRandom(page, SEED); // 続けて 2 回・ふつうの間隔・proud・fist の割合を、同じ並びで確かめる
  await freezeClock(page);
  await stillFrames(page);
  await installRecorder(page);
  await page.goto("/");
  await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 15_000 });
  await waitFor(page, "登場が始まる", (e) => e.k === "src" && e.chan === "hero" && e.file === "side-glance.webp");
  // その場面で先読みされるコマ（くんの目と口・ちゃんのまばたきと仕草・登場の絵）が、アプリの onload まで済むのを待ってから、時計を進める
  await waitForAppLoads(page, HERO_SCENE);
  await advance(page, 300_000);

  const evs = await events(page);
  const hero = chanEvents(evs, "hero");
  const live = evs.find((e) => e.k === "class" && hasCls(e, "kun-rig") && e.kun === "hero" && e.added.includes("is-live"));
  const introEnd = hero.find((e) => e.file === "normal-0.webp" && e.from === "look-camera.webp");
  expect(introEnd, "登場は normal-0 で終わる").toBeTruthy();

  // まばたき：登場のあと。blink-half 50ms → blink-normal 110ms → blink-half 50ms → normal-0。登場のあいだはしない
  const groups = blinkGroups(hero);
  expect(groups.length, `300 秒でまばたきした回数（${groups.length}）`).toBeGreaterThanOrEqual(25);
  expect(groups[0][0].t, "登場のあいだはまばたきしない").toBeGreaterThan(introEnd.t);
  expect(groups[0][0].t - introEnd.t, "登場のあと、最初のまばたきまで").toBeLessThanOrEqual(6500);
  for (const [i, g] of groups.entries()) {
    expectBlinkShape(g, `${i + 1} 回目のまばたき`);
  }
  // 仕草の途中で来たまばたきは後回し（仕草が終わってから改めて 2.5〜5.5 秒）なので、上は 5.5 + 2.4 + 5.5 秒まで
  const gaps = expectBlinkGaps(groups, 14_000, "ヒーロー");
  expect(gaps.some((g) => Math.abs(g - 180) <= 30), "ときどき（20% ほど）続けて 2 回まばたきする").toBe(true);
  expect(gaps.some((g) => g >= 2250), "ふつうは 2.5〜5.5 秒おき").toBe(true);
  // 2 回続けるのは 20% ほど：全体の中で多すぎず、少なすぎない
  const doubles = gaps.filter((g) => Math.abs(g - 180) <= 30).length;
  expect(doubles / gaps.length, `続けて 2 回の割合（${doubles}/${gaps.length}）`).toBeGreaterThan(0.03);
  expect(doubles / gaps.length, `続けて 2 回の割合（${doubles}/${gaps.length}）`).toBeLessThan(0.4);

  // 待機の仕草：proud-0 を 2400ms か fist を 1800ms 出して normal-0 に戻す。12〜20 秒おき。仕草のあいだはまばたきしない
  const gestures = hero.filter((e) => e.file === "proud-0.webp" || e.file === "fist.webp");
  expect(gestures.length, `300 秒で仕草をした回数（${gestures.length}）`).toBeGreaterThanOrEqual(8);
  expect(new Set(gestures.map((g) => g.file)), "proud-0 も fist も出る（半々）").toEqual(new Set(["proud-0.webp", "fist.webp"]));
  expect(gestures[0].t - live.t, "最初の仕草は 12 秒以上あと").toBeGreaterThanOrEqual(11_900);
  for (const [i, g] of gestures.entries()) {
    const hold = g.file === "proud-0.webp" ? 2400 : 1800;
    const next = hero.find((e) => e.t > g.t && e.id === g.id);
    if (!next) {
      continue; // 時計を止めたところで仕草の途中
    }
    expect(next.file, `${i + 1} 回目の仕草は normal-0 に戻る`).toBe("normal-0.webp");
    expect(Math.abs(next.t - g.t - hold), `${g.file} は ${hold}ms 出す（今は ${Math.round(next.t - g.t)}ms）`).toBeLessThanOrEqual(40);
    expect(
      hero.filter((e) => e.t > g.t && e.t < next.t && /^blink-/.test(e.file)),
      "仕草のあいだはまばたきしない"
    ).toEqual([]);
    if (i > 0) {
      const gap = g.t - gestures[i - 1].t;
      expect(gap, `仕草の間 ${Math.round(gap)}ms は 12〜20 秒おき`).toBeGreaterThanOrEqual(11_900);
      expect(gap, `仕草の間 ${Math.round(gap)}ms は 12〜20 秒おき（出している時間を足しても 23 秒以内）`).toBeLessThanOrEqual(23_000);
    }
  }
  // 登場のあと以外では side-glance・look-camera は出ない
  expect(hero.filter((e) => e.file === "side-glance.webp"), "登場は 1 回だけ").toHaveLength(1);
  expect(errors).toEqual([]);
});

test("立ち絵のすてぶるちゃん：画面にいる間、normal-0 のまま 2.5〜5.5 秒おきにまばたきする（話す・仕草のあいだはしない）", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await installAppLoadTracker(page);
  await seedRandom(page, SEED); // 続けて 2 回とふつうの間隔の両方が出ることを、同じ並びで確かめる
  await freezeClock(page);
  await stillFrames(page);
  await installRecorder(page);
  await page.goto("/");
  // 動画欄の立ち絵を画面に入れる（会話も始まるが、時計が止まっているので、進めるまで話さない）
  await scrollCenter(page.locator("#videos .cast"));
  const chan = page.locator("#videos .cast-chan");
  await expect(chan).toHaveClass(IS_LIVE, { timeout: 15_000 });
  // 動画欄で先読みされるコマ（会話の顔・立ち絵の仕草・まばたき・くんの目と口）が、アプリの onload まで済むのを待ってから、時計を進める
  await waitForAppLoads(page, await talkScene(page, "videos"));
  await advance(page, 150_000);

  const evs = await events(page);
  const mine = chanEvents(evs, "cast", "videos");
  const groups = blinkGroups(mine);
  expect(groups.length, `150 秒でまばたきした回数（${groups.length}）`).toBeGreaterThanOrEqual(10);
  for (const [i, g] of groups.entries()) {
    expectBlinkShape(g, `立ち絵 ${i + 1} 回目のまばたき`);
  }
  const gaps = expectBlinkGaps(groups, 16_000, "立ち絵");
  expect(gaps.some((g) => Math.abs(g - 180) <= 30), "ときどき（20% ほど）続けて 2 回まばたきする").toBe(true);
  expect(gaps.some((g) => g >= 2250), "ふつうは 2.5〜5.5 秒おき").toBe(true);

  // 話しているあいだ（口パクと、そのあとの pose-0）はまばたきしない
  const windows = speakingWindows(evs, "videos").filter((w) => !w.kun);
  for (const w of windows) {
    expect(
      mine.filter((e) => e.t > w.start && e.t < w.end + 650 && /^blink-/.test(e.file)),
      "ちゃんが話しているあいだはまばたきしない"
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

// ─── すてぶるくんの目 ────────────────────────────────────────────────────────

test("すてぶるくんのまばたき（half → closed → half → open）と目線（横を見て、open に戻る）。重ならない", async ({ page }) => {
  test.setTimeout(90_000);
  await installRecorder(page);
  await page.goto("/");
  const heroEyes = (evs) => evs.filter((e) => e.k === "src" && hasCls(e, "kun-eyes") && e.kun === "hero");

  await expect
    .poll(
      async () =>
        hasRun(heroEyes(await events(page)).map((e) => e.file), [
          "eyes-half.webp",
          "eyes-closed.webp",
          "eyes-half.webp",
          "eyes-open.webp",
        ]),
      { message: "まばたき", timeout: 15_000 }
    )
    .toBe(true);
  await expect
    .poll(
      async () => heroEyes(await events(page)).some((e) => /^eyes-(left|right)\.webp$/.test(e.file)),
      { message: "6〜10 秒おきの目線", timeout: 25_000 }
    )
    .toBe(true);
  // 目線のあと、eyes-open に戻るまでを待つ
  await expect
    .poll(async () => {
      const list = heroEyes(await events(page));
      const at = list.findIndex((e) => /^eyes-(left|right)\.webp$/.test(e.file));
      return list.slice(at + 1).length > 0;
    })
    .toBe(true);

  const list = heroEyes(await events(page));
  // 目の動きは「open → half → closed → half → open」と「open → 左右 → open」だけ（まばたきと目線が重ならない）
  const allowed = new Set([
    "eyes-open.webp>eyes-half.webp",
    "eyes-half.webp>eyes-closed.webp",
    "eyes-closed.webp>eyes-half.webp",
    "eyes-half.webp>eyes-open.webp",
    "eyes-open.webp>eyes-left.webp",
    "eyes-open.webp>eyes-right.webp",
    "eyes-left.webp>eyes-open.webp",
    "eyes-right.webp>eyes-open.webp",
  ]);
  for (const e of list) {
    expect(allowed.has(`${e.from}>${e.file}`), `目の動き ${e.from} → ${e.file}`).toBe(true);
  }
  const look = list.findIndex((e) => /^eyes-(left|right)\.webp$/.test(e.file));
  const back = list[look + 1];
  expect(back.file).toBe("eyes-open.webp");
  expect(back.t - list[look].t, "横を見るのは 900〜1300ms ほど").toBeGreaterThan(800);
  expect(back.t - list[look].t, "横を見るのは 900〜1300ms ほど").toBeLessThan(2500);
  const closed = list.find((e) => e.file === "eyes-closed.webp");
  const next = list.find((e) => e.t > closed.t && e.id === closed.id);
  expect(next.t - closed.t, "目を閉じているのは 70ms ほど").toBeLessThan(800);
});

// ─── すてぶるくんの目線の向き（右のすてぶるちゃんを多めに見る） ─────────────────────────
// すてぶるちゃんのいる側（ヒーローも立ち絵も右）を 70% で見る。assets/characters.js は Math.random() < 0.7 なら右、そうでなければ左を見る。
// Math.random を一定の値にして、ヒーローも立ち絵（動画欄・相談欄）も、決まった側（0.5 なら右、0.9 なら左）だけを見ることを確かめる。
// 立ち絵のすてぶるくんは画面に入るまで動かないので、その欄を画面の真ん中に送ってから時計を進める。
// 会話が始まると目線は口パクのあとに回るので、会話（10 秒ほど）が終わってから数えられるよう、十分に進める
for (const { path } of PAGES) {
  for (const [value, side] of [
    [0.5, "right"],
    [0.9, "left"],
  ]) {
    test(`${path}：Math.random が ${value} のとき、ヒーローも立ち絵（動画欄・相談欄）のすてぶるくんも eyes-${side} だけを見る`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await installAppLoadTracker(page);
      await fixRandom(page, value);
      await freezeClock(page);
      await stillFrames(page);
      await installRecorder(page);
      await page.goto(path);
      const gazes = async (kun, sec) =>
        (await events(page))
          .filter((e) => e.k === "src" && hasCls(e, "kun-eyes") && e.kun === kun && (sec === undefined || e.sec === sec))
          .map((e) => e.file)
          .filter((file) => /^eyes-(left|right)\.webp$/.test(file));
      const expected = `eyes-${side}.webp`;

      // ヒーロー：6〜10 秒おき（値が一定なら 8 秒おき）の目線を、40 秒で数回
      await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 15_000 });
      await waitForAppLoads(page, HERO_SCENE);
      await advance(page, 40_000);
      const hero = await gazes("hero");
      expect(hero.length, `ヒーロー: 40 秒で目線を向けた回数（${hero.length}）`).toBeGreaterThanOrEqual(2);
      expect(new Set(hero), `ヒーロー: 目線は ${expected} だけ（今は ${[...new Set(hero)].join(", ")}）`).toEqual(new Set([expected]));

      // 立ち絵（動画欄・相談欄）：画面に入れてから進める
      for (const section of ["videos", "early-access"]) {
        await scrollCenter(page.locator(`#${section} .cast`));
        await expect(page.locator(`#${section} .cast-kun`)).toHaveClass(IS_LIVE, { timeout: 15_000 });
        await waitForAppLoads(page, await talkScene(page, section));
        await advance(page, 90_000);
        const cast = await gazes("cast", section);
        expect(cast.length, `${section} の立ち絵: 90 秒で目線を向けた回数（${cast.length}）`).toBeGreaterThanOrEqual(2);
        expect(new Set(cast), `${section} の立ち絵: 目線は ${expected} だけ（今は ${[...new Set(cast)].join(", ")}）`).toEqual(new Set([expected]));
      }
      expect(errors).toEqual([]);
    });
  }
}

// ─── 7. 狭い幅 ──────────────────────────────────────────────────────────────

test.describe("狭い幅", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("390px：一番下までスクロールしても、立ち絵（kun/・chan/）は 1 枚も読まず、会話の顔（talk/）は読む", async ({ page }) => {
    test.setTimeout(90_000);
    const paths = [];
    page.on("request", (req) => paths.push(new URL(req.url()).pathname));
    await page.goto("/");
    await scrollThrough(page);
    await page.waitForTimeout(500);

    expect(
      paths.filter((p) => p.startsWith("/assets/char/kun/") || p.startsWith("/assets/char/chan/")),
      "立ち絵は狭い幅で出さないので読まない"
    ).toEqual([]);
    expect(paths.filter((p) => p.startsWith("/assets/char/talk/")).length, "会話の顔は読む").toBeGreaterThan(0);

    // 立ち絵は出ておらず、動いてもいない
    const displays = await page.locator(".hero-cast, .cast").evaluateAll((els) => els.map((el) => getComputedStyle(el).display));
    expect(displays.length).toBeGreaterThan(0);
    expect(new Set(displays)).toEqual(new Set(["none"]));
    expect(await page.locator(".is-live").count(), "立ち絵は生きない").toBe(0);

    // 顔は読み込まれている
    const sizes = await sizesOf(page.locator(".talk-face"));
    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes.map((s) => s.join("x")))).toEqual(new Set(["112x112"]));
  });
});

// ─── 8. JS なし ─────────────────────────────────────────────────────────────

test.describe("JS なし", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, lang } of PAGES) {
    test(`${path}：絵は HTML に書いたまま読み込まれ、動きの印（is-*）はどこにも付かない`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(path);

      // 顔の絵と data-face は設計書 v1 §2-4 の表のとおり。行の話し手と合う
      const lines = await page.locator(".talk-line").evaluateAll((els) =>
        els.map((el) => ({
          who: el.classList.contains("talk-kun") ? "kun" : el.classList.contains("talk-chan") ? "chan" : "",
          face: el.querySelector("img.talk-face").getAttribute("data-face"),
          src: el.querySelector("img.talk-face").getAttribute("src"),
          alt: el.querySelector("img.talk-face").getAttribute("alt"),
        }))
      );
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        const file = l.src.split("/").pop();
        expect(FACE_BY_FILE[file], `${l.src} の data-face`).toBe(l.face);
        expect(l.face.split(" ")[0], `${l.src} は ${l.who} の行`).toBe(l.who);
        expect(l.alt, "顔は装飾").toBe("");
      }
      // 動画欄の最初の顔は chan-normal-1（HTML に書いたまま）
      const first = await page.locator("#videos .talk-face").first().getAttribute("src");
      expect(first).toMatch(lang === "en" ? /^\/assets\/char\/talk\/chan-normal-1\.webp$/ : /^assets\/char\/talk\/chan-normal-1\.webp$/);

      // ヒーロー・立ち絵の組み立て（設計書 v1 §2-1〜2-3 と v2 §3）
      const shape = await page.evaluate(() => {
        const attr = (el, name) => (el ? el.getAttribute(name) : null);
        const file = (el) => (el ? el.getAttribute("src").split("/").pop() : null);
        const chanOf = (el) => ({ src: file(el), w: attr(el, "width"), h: attr(el, "height"), mode: attr(el, "data-chan") });
        return {
          heroRig: Array.prototype.map.call(document.querySelectorAll('.hero-cast .kun-rig[data-kun="hero"] img'), file),
          heroMouth: file(document.querySelector('.hero-cast .kun-mouth')),
          heroChan: chanOf(document.querySelector('.hero-cast img[data-chan]')),
          videos: {
            chan: chanOf(document.querySelector("#videos .cast img[data-chan]")),
            mouth: file(document.querySelector("#videos .cast .kun-mouth")),
            kun: attr(document.querySelector("#videos .cast .kun-rig"), "data-kun"),
          },
          guest: {
            chan: chanOf(document.querySelector("#early-access .cast img[data-chan]")),
            mouth: file(document.querySelector("#early-access .cast .kun-mouth")),
            kun: attr(document.querySelector("#early-access .cast .kun-rig"), "data-kun"),
          },
          castRig: Array.prototype.map.call(document.querySelectorAll("#videos .cast .kun-rig img"), file),
          parts: Array.prototype.map.call(document.querySelectorAll(".kun-rig img, [data-chan]"), (i) => [i.getAttribute("alt"), i.closest("[aria-hidden='true']") ? "hidden" : "exposed"]),
        };
      });
      const rigParts = ["foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks", "eyes-open", "mouth-rest"].map((n) => `${n}.webp`);
      expect(shape.heroRig).toEqual(rigParts);
      expect(shape.heroMouth).toBe("mouth-rest.webp");
      expect(shape.heroChan).toEqual({ src: "normal-0.webp", w: "400", h: "388", mode: "hero" });
      expect(shape.videos).toEqual({
        chan: { src: "normal-0.webp", w: "400", h: "388", mode: "cast" },
        mouth: "mouth-o.webp",
        kun: "cast",
      });
      expect(shape.guest).toEqual({
        chan: { src: "normal-0.webp", w: "400", h: "388", mode: "cast" },
        mouth: "mouth-rest.webp",
        kun: "cast",
      });
      expect(shape.castRig).toEqual(rigParts.map((n) => (n === "mouth-rest.webp" ? "mouth-o.webp" : n)));
      for (const [alt, hidden] of shape.parts) {
        expect(alt, "立ち絵の絵は装飾").toBe("");
        expect(hidden, "立ち絵は読み上げない").toBe("hidden");
      }

      // 動きの印はどこにも付かない（JS が動いていない）
      await expect(page.locator(".is-live, .is-waving, .is-speaking, .is-played")).toHaveCount(0);
      // 顔の絵は読み込まれる
      const faces = page.locator(".talk-face");
      for (let i = 0; i < (await faces.count()); i++) {
        await faces.nth(i).scrollIntoViewIfNeeded();
      }
      await expect.poll(() => sizesOf(faces), { message: "顔が読み込まれる" }).toEqual(Array(lines.length).fill([112, 112]));
    });
  }
});

// ─── 9. 本番ヘッダ（CSP・Trusted Types） ─────────────────────────────────────

test.describe("本番ヘッダをかけたページ", () => {
  test.use({ prodHeaders: true });

  for (const { path, lang } of PAGES) {
    test(`${path}：会話を再生しても、img-src・style-src・script-src・Trusted Types の違反が出ない`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await installRecorder(page);
      await installViolationRecorder(page);
      const response = await page.goto(path);
      // 本番ヘッダが応答に付いている（この確認が通らなければ、以降の確認は意味がない）
      const csp = response.headers()["content-security-policy"];
      expect(csp).toContain("img-src 'self' data:");
      expect(csp).toContain("style-src 'self';");
      expect(csp).toContain("require-trusted-types-for 'script'");
      await expect(page.locator("html")).toHaveAttribute("lang", lang);

      // ヒーローが動き（登場・上下）、動画欄・相談欄の会話が再生される（立ち絵とも連動する）
      await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 10_000 });
      await expect.poll(() => animationName(page.locator(".kun-rig[data-kun=hero] .kun-bob"))).toBe("kun-bob");
      for (const section of ["#videos", "#early-access"]) {
        const talk = page.locator(`${section} .talk`);
        await scrollCenter(talk);
        await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
      }
      const evs = await events(page);
      expect(
        evs.some((e) => e.k === "src" && hasCls(e, "talk-face") && TALK_FRAME.test(e.file)),
        "顔の差し替えが実際に起きた"
      ).toBe(true);
      expect(
        evs.some((e) => e.k === "src" && e.kun === "cast" && KUN_TALK_MOUTH.test(e.file)),
        "立ち絵の口の差し替えが実際に起きた"
      ).toBe(true);
      expect(
        evs.some((e) => e.k === "src" && e.chan === "cast" && e.sec === "videos" && /^(proud|point)-[12]\.webp$/.test(e.file)),
        "動画欄の立ち絵のちゃんの仕草が実際に起きた"
      ).toBe(true);
      expect(
        evs.some((e) => e.k === "src" && e.chan === "cast" && e.sec === "early-access" && /^palm-[12]\.webp$/.test(e.file)),
        "相談欄の立ち絵のちゃんの仕草が実際に起きた"
      ).toBe(true);
      await waitFor(page, "座布団が実際に出た", (e) => e.k === "src" && e.chan === "cast" && e.file === "zabuton.webp");

      const violations = await page.evaluate(() => window.__csp.slice());
      const mine = violations.filter((v) => /^(img-src|style-src|script-src|require-trusted-types-for|trusted-types)/.test(v));
      expect(mine, "CSP・Trusted Types の違反").toEqual([]);

      // 対照：許していない画像・インラインの style・名前の違う Trusted Types のポリシーは、この環境でも止まる（見張りが働いている）
      // （innerHTML は使えない：ページが default ポリシーで通すので、違反として報告されない）
      await page.evaluate(() => {
        const img = new Image();
        img.src = "https://not-allowed.invalid/x.webp";
        document.body.setAttribute("style", "color: red");
        try {
          window.trustedTypes.createPolicy("not-allowed", {});
        } catch (error) {
          // 'trusted-types default' の外の名前なので TypeError になる
        }
      });
      const seen = (re) => page.evaluate((src) => window.__csp.some((v) => new RegExp(src).test(v)), re.source);
      await expect.poll(() => seen(/^img-src .*not-allowed/)).toBe(true);
      await expect.poll(() => seen(/^style-src/)).toBe(true);
      await expect.poll(() => seen(/^trusted-types/)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});

// ─── 10. 決まり（コードに入れない書き方） ────────────────────────────────────

// コメントを除いて、コードだけを見る（「使わない」と説明するコメントは許す）
const stripJsComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

// CSS を（セレクタ, 本体）の並びに分ける。@media などの入れ子は中を展開し、@keyframes は 1 つの塊のまま
const cssRules = (css) => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(import|charset)[^;]*;/g, "");
  const rules = [];
  const walk = (src) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open < 0) {
        break;
      }
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        depth += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0;
        j++;
      }
      const head = src.slice(i, open).trim();
      const body = src.slice(open + 1, j - 1);
      if (/^@(media|supports|layer)\b/.test(head)) {
        walk(body);
      } else {
        rules.push({ selector: head, body });
      }
      i = j;
    }
  };
  walk(text);
  return rules;
};

// キャラの節の規則：すてぶるくんの部品・立ち絵・ヒーローの二人・会話、それに kun-*／chan-* の @keyframes
// （FAQ の寝て浮く絵 .faq-nap-* は今回触らないので入れない）
const CHARACTER_SELECTOR = /\.kun-|\.cast|\.hero-cast|\.talk|\[data-chan\]|\[data-kun\]|^@keyframes (kun|chan)-/;
const STAND_SELECTOR = /\.kun-|\.cast|\.hero-cast|\[data-chan\]|\[data-kun\]/;

test.describe("決まり", () => {
  test("assets/characters.js：左右反転・色の加工・HTML の組み立て・インラインの style・新しすぎる書き方を使わず、古い名前（thigh・wink・greet）を残さない", () => {
    const raw = readText("assets/characters.js");
    expect(raw, "strict mode").toContain('"use strict"');
    const code = stripJsComments(raw);
    const banned = [
      [/scaleX\(\s*-/, "左右反転（scaleX(-1)）"],
      [/hue-rotate/, "色の加工（hue-rotate）"],
      [/\bfilter\s*:|["'`]filter["'`]/, "CSS の filter"],
      [/\binnerHTML\b/, "innerHTML"],
      [/\bouterHTML\b/, "outerHTML"],
      [/insertAdjacentHTML/, "insertAdjacentHTML"],
      [/\bsrcdoc\b/, "srcdoc"],
      [/document\.write/, "document.write"],
      [/\beval\s*\(/, "eval"],
      [/new\s+Function\b/, "new Function"],
      [/\.style\b/, ".style（el.style.*）"],
      [/setAttribute\(\s*["'`]style["'`]/, "setAttribute('style', …)"],
      [/cssText/, "cssText"],
      [/\.animate\s*\(/, "Web Animations API（.animate()）"],
      [/getContext\s*\(/, "Canvas／WebGL"],
      // ES2017 まで
      [/\?\.(?!\d)/, "optional chaining（?.）"],
      [/\?\?/, "nullish coalescing（??）"],
      [/\bcatch\s*\{/, "optional catch binding"],
      [/\.finally\s*\(/, "Promise.prototype.finally"],
      [/\.(flat|flatMap|matchAll|replaceAll|at)\s*\(/, "ES2018 以降の配列・文字列のメソッド"],
      [/Object\.fromEntries|structuredClone|\bBigInt\b/, "ES2019 以降の API"],
      [/\d_\d/, "数値の区切り（_）"],
      // 設計書 v2 §5-1：待機のウインク（wink）・greet・thigh の名前は全部消す
      [/\bthigh\b|thigh-/, "太ももまでの絵（thigh）"],
      [/\bwink\b|reach-wink/, "待機のウインク（wink）"],
      [/\bgreet\b/, "greet"],
    ];
    for (const [re, label] of banned) {
      expect(code, `assets/characters.js に ${label} がある`).not.toMatch(re);
    }
  });

  test("assets/lp.css：左右反転・負の scale を使わず、キャラの規則に filter・hue-rotate・使わない CSS が無く、古い動き（chan-breathe）・thigh を残さない", () => {
    const css = readText("assets/lp.css");
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // 設計書 v1 §5-10 は lp.css 全体に hue-rotate が無いことを求めるが、ヒーローのロゴ（.hero-logo）が元から使っている。
    // そのため hue-rotate と filter は、キャラの規則に限って見る（左右反転と負の scale は全体で見る）
    expect(withoutComments, "scaleX(-1)").not.toMatch(/scaleX\(\s*-/);
    expect(withoutComments, "innerHTML・.style.").not.toMatch(/innerHTML|\.style\./);
    expect(withoutComments, "負の scale").not.toMatch(/scale\(\s*-|scale\([^)]*,\s*-|scaleY\(\s*-/);
    expect(withoutComments, "@property").not.toContain("@property");
    expect(withoutComments, "offset-path").not.toContain("offset-path");
    expect(withoutComments, "太ももまでの絵（thigh）").not.toMatch(/thigh/);
    expect(withoutComments, "chan-breathe は消した").not.toContain("chan-breathe");

    const rules = cssRules(css);
    const character = rules.filter((r) => CHARACTER_SELECTOR.test(r.selector));
    expect(character.length, "キャラの規則を取り出せた").toBeGreaterThan(15);
    const problems = [];
    for (const r of character) {
      const where = r.selector.replace(/\s+/g, " ");
      const has = (re) => re.test(r.body);
      if (has(/(^|[;{\s])filter\s*:/)) problems.push(`${where}: filter`);
      if (has(/hue-rotate/)) problems.push(`${where}: hue-rotate`);
      if (has(/scaleX\(\s*-|scale\(\s*-|scale\([^)]*,\s*-|scaleY\(\s*-/)) problems.push(`${where}: 負の scale`);
      if (has(/aspect-ratio/)) problems.push(`${where}: aspect-ratio`);
      if (has(/(^|[;{\s])inset\s*:/)) problems.push(`${where}: inset`);
      if (has(/(^|[;{\s])(translate|rotate|scale)\s*:/)) problems.push(`${where}: 個別の transform プロパティ`);
      if (STAND_SELECTOR.test(r.selector) && has(/(^|[;{\s])(row-|column-)?gap\s*:/)) problems.push(`${where}: gap`);
      if (has(/box-shadow|text-shadow|border-radius/)) problems.push(`${where}: 影・角丸`);
    }
    expect(problems, "キャラの規則に書かない CSS").toEqual([]);

    // 動きの @keyframes がそろっている（上下は kun-bob・chan-bob）
    for (const name of ["kun-bob", "kun-breathe", "kun-arm-l-sway", "kun-arm-r-sway", "kun-wave", "chan-bob"]) {
      expect(rules.some((r) => r.selector === `@keyframes ${name}`), `@keyframes ${name}`).toBe(true);
    }
  });

  for (const { file } of PAGES) {
    test(`${file}：HTML に太ももまでの絵と古い data-chan（wink・greet）を残さない`, () => {
      const html = readText(file);
      expect(html).not.toMatch(/thigh/);
      expect(html).not.toMatch(/data-chan="(wink|greet)"/);
    });
  }
});
