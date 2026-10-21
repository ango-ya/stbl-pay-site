import { test as base, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── すてぶるくん・すてぶるちゃんの動き ──────────────────────────────────────

// このファイルが保証する範囲
// - 素材（assets/char/ の 51 枚）の有無・大きさ・透過、HTML の参照、部品の組み立て、assets/characters.js の動き
//   （生きている間だけ動く・reduce・手を振る・まばたき・目線・ウインク・会話の口パクと立ち絵の連動）、
//   狭い幅で立ち絵を読まないこと、JS なしの見え方、本番ヘッダ（CSP・Trusted Types）で違反が出ないこと、
//   コードに入れない書き方（assets/characters.js と assets/lp.css のキャラの節）
// - 時間に頼る確認は expect.poll（〜15 秒）。コマの差し替えは addInitScript の MutationObserver が記録し（window.__rec）、
//   記録を後から見て順番や間隔を確かめる（ポーリングの隙間に起きた変化も取りこぼさない）
// - 動きの見た目（絵が自然に見えるか、位置と大きさ）はここでは見ない。目で見る（スクリーンショット）
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

// ─── 素材の一覧（設計書 §1） ────────────────────────────────────────────────

const KUN_PARTS = [
  "foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks",
  "eyes-open", "eyes-half", "eyes-closed", "eyes-left", "eyes-right", "eyes-wide",
  "mouth-rest", "mouth-dot", "mouth-o", "mouth-talk-a", "mouth-talk-i", "mouth-talk-o", "mouth-talk-n",
];
const CHAN_POSES = ["thigh-stand", "thigh-reach", "thigh-reach-wink"];
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
  ...CHAN_POSES.map((n) => ({ path: `assets/char/chan/${n}.webp`, width: 340, height: 480, alpha: true })),
  ...TALK_FILES.map((n) => ({ path: `assets/char/talk/${n}.webp`, width: 112, height: 112, alpha: false })),
];

// 設計書 §1-4：HTML から参照を無くす古い絵（sleep-kun・zabuton は FAQ で使い続けるので入れない）
const OLD_ARTWORK = [
  "hero-chan", "present-chan", "guest-chan", "stand-kun-blank", "stand-kun-o", "stand-kun-smile",
  "face-chan-y1-1", "face-chan-y1-2", "face-chan-y1-3", "face-chan-y1-6", "face-chan-y1-7", "face-chan-y2-1",
  "face-kun-1", "face-kun-2", "face-kun-5", "face-kun-8",
].map((n) => `${n}.webp`);

// 設計書 §4-4：会話の顔の data-face ごとの、休み・話す・まばたきのコマ
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

// 設計書 §2-4：HTML に書いてある顔の絵と data-face の対応
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

// 設計書 §4-4 の話す時間：文字数（※ と数字の脚注記号は数えない）× 日本語 95ms／英語 45ms、700〜2600ms
const speakMs = (text, lang) => {
  const count = text.replace(/[※0-9０-９]/g, "").replace(/\s+/g, " ").trim().length;
  return Math.min(2600, Math.max(700, count * (lang === "en" ? 45 : 95)));
};

// 部品の組み立て：全部が左上をそろえて同じ大きさで重なる（transform に左右されない offset* で見る）
const assemblyOf = (rig) =>
  rig.evaluate((el) => {
    const parts = Array.prototype.slice.call(el.querySelectorAll("img"));
    return {
      width: el.offsetWidth,
      height: el.offsetHeight,
      parts: parts.map((p) => ({ left: p.offsetLeft, top: p.offsetTop, width: p.offsetWidth, height: p.offsetHeight })),
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
};

const animationName = (locator) => locator.evaluate((el) => getComputedStyle(el).animationName);

const HERO_RIG = '.kun-rig[data-kun="hero"]';
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

// ─── 1. 素材と HTML ─────────────────────────────────────────────────────────

test.describe("素材と HTML", () => {
  test("設計書 §1 の 51 枚が assets/char/ にそろい、大きさと透過が決まりどおり", () => {
    expect(ASSETS, "kun 19 + chan 3 + talk 29").toHaveLength(51);
    expect(new Set(ASSETS.map((a) => a.path)).size, "名前が重ならない").toBe(51);
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
        expect(known.has(repoPath), `${src} は §1 の素材`).toBe(true);
        expect(existsSync(join(ROOT, repoPath)), `${src} のファイル`).toBe(true);
        const res = await request.head(new URL(src, page.url()).href);
        expect(res.status(), `${src} の配信`).toBe(200);
      }

      // 古い絵への参照は HTML に残さない
      const html = readText(file);
      for (const old of OLD_ARTWORK) {
        expect(html, `${file} に古い絵 ${old} が残っている`).not.toContain(`assets/char/${old}`);
      }

      // FAQ の寝て浮くすてぶるくんと座布団は変えない
      const nap = await srcs(".faq-nap img");
      expect(nap.map((s) => s.split("/").pop())).toEqual(["sleep-kun.webp", "zabuton.webp"]);
      for (const old of ["sleep-kun.webp", "zabuton.webp"]) {
        expect(existsSync(join(ROOT, "assets/char", old)), `${old} は残す`).toBe(true);
      }

      // characters.js は lp.js の直後に defer で読む
      const prefix = lang === "en" ? "/assets" : "assets";
      expect(html, `${file} のスクリプト`).toContain(
        `<script src="${prefix}/lp.js" defer></script>\n    <script src="${prefix}/characters.js" defer></script>`
      );
    });
  }
});

// ─── 2. 組み立て ────────────────────────────────────────────────────────────

test.describe("組み立て", () => {
  for (const { path } of PAGES) {
    test(`${path}：すてぶるくんは部品 8 枚が同じ大きさで重なり、ヒーローの絵は決まった大きさ`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(path);

      // ヒーロー（1280×900）
      const heroParts = page.locator(".hero-cast-kun img");
      await expect(heroParts).toHaveCount(8);
      await expect.poll(() => sizesOf(heroParts), { message: "ヒーローの部品が全部読み込まれる" }).toEqual(
        Array(8).fill([374, 261])
      );
      const heroChan = page.locator(".hero-cast-chan");
      await expect.poll(() => sizesOf(heroChan), { message: "ヒーローのすてぶるちゃん" }).toEqual([[340, 480]]);
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
          [340, 480],
        ]);
        expectAssembled(await assemblyOf(page.locator(`${cast} .cast-kun`)), cast);
      }
    });
  }
});

// ─── 3. 会話の再生 ──────────────────────────────────────────────────────────

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
  }

  test("再生の途中で画面の外へ出たら、そこで打ち切って、顔を休みのコマに戻す（もう再生しない）", async ({ page }) => {
    test.setTimeout(90_000);
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const speakingCount = async () =>
      (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;
    await scrollCenter(talk);
    await waitFor(page, "話し始める", (e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking"));

    // 画面の外へ出ると、そこで打ち切る（is-played が付く）。最後の行までは進まない
    await scrollTop(page, 0);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 15_000 });
    await expect(page.locator("#videos .talk-line.is-speaking")).toHaveCount(0);
    for (const f of await readFaces(page, "#videos")) {
      expect(restOrBlinkOf(f.face).has(f.file), `${f.face} の顔が休みのコマ（今は ${f.file}）`).toBe(true);
    }
    // 次の行は始まらない。戻ってきても再生しない
    const cut = await speakingCount();
    await page.waitForTimeout(1500);
    expect(await speakingCount(), "打ち切ったあとは次の行に進まない").toBe(cut);
    await scrollCenter(talk);
    await page.waitForTimeout(1500);
    expect(await speakingCount(), "打ち切ったあとは再生しない").toBe(cut);
    expect(cut, "最後の行まで進んでいない").toBeLessThan(3);
  });

  test("相談欄：すてぶるちゃんの行のあいだだけ立ち絵が手を伸ばし（reach）、話し終わって少ししたら立ち姿に戻る", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#early-access .talk");
    const chan = page.locator('#early-access .cast-chan[data-chan="greet"]');
    await expect(chan).toHaveAttribute("src", /thigh-stand\.webp$/);
    await scrollCenter(talk);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });

    const evs = await events(page);
    const windows = speakingWindows(evs, "early-access");
    expect(windows.map((w) => (w.kun ? "kun" : "chan"))).toEqual(["kun", "chan", "kun"]);
    const chanWindow = windows.find((w) => !w.kun);
    const chanEvents = evs.filter((e) => e.k === "src" && e.sec === "early-access" && e.chan === "greet");
    const reach = chanEvents.find((e) => e.file === "thigh-reach.webp");
    expect(reach, "ちゃんの行で thigh-reach になる").toBeTruthy();
    expect(Math.abs(reach.t - chanWindow.start), "reach になるのは、ちゃんが話し始めるころ").toBeLessThanOrEqual(400);
    for (const e of chanEvents.filter((x) => x.file === "thigh-reach.webp")) {
      expect(e.t, "くんの行のあいだは reach にしない").toBeGreaterThanOrEqual(chanWindow.start - 150);
    }
    const back = chanEvents.find((e) => e.file === "thigh-stand.webp" && e.t > reach.t);
    expect(back, "話し終わったら thigh-stand に戻る").toBeTruthy();
    const afterSpeech = back.t - chanWindow.end;
    expect(afterSpeech, `話し終わって 600ms ほど後に戻る（今は ${Math.round(afterSpeech)}ms）`).toBeGreaterThan(450);
    expect(afterSpeech, `話し終わって 600ms ほど後に戻る（今は ${Math.round(afterSpeech)}ms）`).toBeLessThan(2500);
    await expect(chan).toHaveAttribute("src", /thigh-stand\.webp$/);

    // 立ち絵のすてぶるくんは、くんの行のあいだだけ口を動かす
    const kunWindows = windows.filter((w) => w.kun);
    const mouthTalk = evs.filter(
      (e) => e.k === "src" && e.sec === "early-access" && e.kun === "cast" && hasCls(e, "kun-mouth") && KUN_TALK_MOUTH.test(e.file)
    );
    expect(mouthTalk.length).toBeGreaterThan(0);
    for (const e of mouthTalk) {
      expect(kunWindows.some((w) => e.t >= w.start - 150 && e.t <= w.end + 150)).toBe(true);
    }
  });

  test("タブが隠れている間は会話を始めず、再生中に隠れたら止めて、表示に戻ると最初から再生する", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await installRecorder(page);
    await page.goto("/");
    const talk = page.locator("#videos .talk");
    const speakingCount = async () =>
      (await events(page)).filter((e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking")).length;
    const faceChanges = async () =>
      (await events(page)).filter((e) => e.k === "src" && e.sec === "videos" && hasCls(e, "talk-face")).length;

    // 隠れたまま会話を画面に入れても、話し始めない
    await setHidden(page, true);
    await scrollCenter(talk);
    await page.waitForTimeout(2500);
    expect(await speakingCount(), "隠れている間は話し始めない").toBe(0);

    // 表示に戻ると話し始める
    await setHidden(page, false);
    await waitFor(page, "話し始める", (e) => e.k === "class" && e.sec === "videos" && e.added.includes("is-speaking"));

    // 再生中に隠れると、話している行が止まり、顔は休みのコマに戻る。再生済みにはしない
    await setHidden(page, true);
    await expect(page.locator("#videos .talk-line.is-speaking")).toHaveCount(0);
    await expect(talk).not.toHaveClass(/\bis-played\b/);
    for (const f of await readFaces(page, "#videos")) {
      expect(restOrBlinkOf(f.face).has(f.file), `${f.face} の顔が休みのコマ（今は ${f.file}）`).toBe(true);
    }
    // 隠れている間は、顔の絵を替えない（口パクもまばたきも止まる）
    const frozenFaces = await faceChanges();
    const frozenLines = await speakingCount();
    await page.waitForTimeout(2500);
    expect(await faceChanges(), "隠れている間は顔の絵を替えない").toBe(frozenFaces);
    expect(await speakingCount(), "隠れている間は次の行に進まない").toBe(frozenLines);

    // 表示に戻ると、最初の行から最後まで再生する
    await setHidden(page, false);
    await expect(talk).toHaveClass(/\bis-played\b/, { timeout: 25_000 });
    const windows = speakingWindows(await events(page), "videos");
    expect(windows.slice(-3).map((w) => w.line), "戻ったあとは 1 行目から順に話す").toEqual([0, 1, 2]);
    expect(errors).toEqual([]);
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

// ─── 4. 生きている間だけ動く ─────────────────────────────────────────────────

test("生きている間だけ動く：画面に入っていて、タブが表示中のときだけ is-live が付き、CSS の動きが働く", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto("/");
  const rig = page.locator(HERO_RIG);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });

  // 呼吸・腕の揺れ・すてぶるちゃんの呼吸（腕は手を振っている間だけ kun-wave に替わる）
  await expect.poll(() => animationName(rig.locator(".kun-body"))).toBe("kun-breathe");
  expect(await animationName(rig.locator(".kun-arm-l"))).toBe("kun-arm-l-sway");
  expect(["kun-arm-r-sway", "kun-wave"]).toContain(await animationName(rig.locator(".kun-arm-r")));
  expect(await animationName(page.locator(".hero-cast-chan"))).toBe("chan-breathe");

  // 画面に入っていない立ち絵は生きていない
  const cast = page.locator("#videos .cast-kun");
  await expect(cast).not.toHaveClass(IS_LIVE);
  expect(await animationName(cast.locator(".kun-body"))).toBe("none");

  // ページの下までスクロールすると、ヒーローの is-live が外れ、CSS の動きも止まる
  await scrollCenter(page.locator("#early-access"));
  await expect(rig).not.toHaveClass(IS_LIVE);
  expect(await animationName(rig.locator(".kun-body"))).toBe("none");
  expect(await animationName(page.locator(".hero-cast-chan"))).toBe("none");

  // 動画欄に入ると、そこの立ち絵が生きる
  await scrollCenter(page.locator("#videos .cast"));
  await expect(cast).toHaveClass(IS_LIVE, { timeout: 10_000 });
  await expect.poll(() => animationName(cast.locator(".kun-body"))).toBe("kun-breathe");

  // 戻ると、またヒーローが生きる
  await scrollTop(page, 0);
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });

  // タブが隠れると止まり、戻ると動く（visibilitychange を拾う）
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(rig).not.toHaveClass(IS_LIVE);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(rig).toHaveClass(IS_LIVE, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

// ─── 5. reduce ──────────────────────────────────────────────────────────────

test("reduce：体が動くもの（呼吸・腕の揺れ・手を振る・登場のポーズ送り）は止まり、まばたきと会話は残る", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installRecorder(page);
  await page.goto("/");
  const rig = page.locator(HERO_RIG);
  const chan = page.locator(".hero-cast-chan");

  expect(await animationName(rig.locator(".kun-body")), "呼吸").toBe("none");
  expect(await animationName(rig.locator(".kun-arm-l")), "腕の揺れ").toBe("none");
  expect(await animationName(chan), "すてぶるちゃんの呼吸").toBe("none");

  // まばたきは残る＝ヒーローは動いている。そのうえで 3 秒たっても、登場のポーズ送りも手振りも起きない
  await expect
    .poll(
      async () => {
        const files = (await events(page))
          .filter((e) => e.k === "src" && hasCls(e, "kun-eyes") && e.kun === "hero")
          .map((e) => e.file);
        return hasRun(files, ["eyes-half.webp", "eyes-closed.webp", "eyes-half.webp", "eyes-open.webp"]);
      },
      { message: "reduce でもまばたきする", timeout: 15_000 }
    )
    .toBe(true);
  await page.waitForFunction(() => performance.now() > 3200);
  const evs = await events(page);
  expect(evs.some((e) => e.k === "class" && e.added.includes("is-waving")), "手を振らない").toBe(false);
  expect(evs.filter((e) => e.k === "src" && e.chan === "hero"), "ヒーローのすてぶるちゃんの絵を替えない").toEqual([]);
  await expect(chan).toHaveAttribute("src", /thigh-reach-wink\.webp$/);
  await expect(rig).not.toHaveClass(/\bis-waving\b/);

  // 会話は再生される（口パクは残る）
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

  // CSS：画面に入って is-live が付いても、手を振っても、4 種のアニメーションは none（付けて確かめ、元に戻す）
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
  expect(forced).toEqual({ breathe: "none", armL: "none", armR: "none", chan: "none", wave: "none" });
  expect(errors).toEqual([]);
});

// ─── 6. 手を振る・登場のポーズ送り ───────────────────────────────────────────

test.describe("ヒーローの登場", () => {
  test("手を振る：見えてから 1.2 秒ほどで is-waving が付いて 1 回だけ外れ、すてぶるちゃんは立ち姿から手を伸ばしてウインクする", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await installRecorder(page);
    const rig = page.locator(HERO_RIG);
    const chan = page.locator(".hero-cast-chan");
    const heroRig = (e) => e.k === "class" && hasCls(e, "kun-rig") && e.kun === "hero";
    // 手を振るのは「スクリプト開始から 800ms 以内に初めて見えたとき」だけ。機械が重くてその窓を外したら、読み直す（3 回まで）
    let sinceStart = Infinity;
    for (let attempt = 0; attempt < 3 && sinceStart > 650; attempt++) {
      await page.goto("/");
      await expect(rig).toHaveClass(IS_LIVE, { timeout: 15_000 });
      const first = (await events(page)).find((e) => heroRig(e) && e.added.includes("is-live"));
      sinceStart = first.t - (await page.evaluate(() => window.__dcl));
    }
    expect(sinceStart, "このマシンが重すぎて、登場の窓（スクリプト開始から 800ms）に 3 回とも間に合わなかった").toBeLessThanOrEqual(650);

    await waitFor(page, "is-waving が付く", (e) => heroRig(e) && e.added.includes("is-waving"), 6000);
    await waitFor(page, "is-waving が外れる", (e) => heroRig(e) && e.removed.includes("is-waving"), 6000);

    const evs = await events(page);
    const live = evs.find((e) => heroRig(e) && e.added.includes("is-live"));
    const on = evs.find((e) => heroRig(e) && e.added.includes("is-waving"));
    const off = evs.find((e) => heroRig(e) && e.removed.includes("is-waving"));
    // 手を振り始めたときの右腕の動きが kun-wave（記録した時点の値で見る）
    expect(on.armAnim, "手を振っている間は、右腕の動きが kun-wave").toBe("kun-wave");
    expect(on.t - live.t, "見えてから 1200ms ほど後に手を振る").toBeGreaterThan(1000);
    expect(on.t - live.t, "見えてから 1200ms ほど後に手を振る").toBeLessThan(3000);
    expect(off.t - on.t, "手を振るのは 1.8 秒の動き（animationend か 2200ms 後に外す）").toBeGreaterThan(1500);
    expect(off.t - on.t, "手を振るのは 1.8 秒の動き（animationend か 2200ms 後に外す）").toBeLessThan(3500);

    // 立ち絵（data-kun="cast"）は手を振らない。ヒーローも 1 回だけ
    await page.waitForTimeout(1500);
    const later = await events(page);
    const waves = later.filter((e) => e.k === "class" && e.added.includes("is-waving"));
    expect(waves, "手を振るのはヒーローで 1 回だけ").toHaveLength(1);
    expect(waves[0].kun).toBe("hero");

    // すてぶるちゃん：thigh-stand → thigh-reach → thigh-reach-wink → thigh-reach
    await expect
      .poll(
        async () =>
          hasOrder(
            (await events(page)).filter((e) => e.k === "src" && e.chan === "hero").map((e) => e.file),
            ["thigh-stand.webp", "thigh-reach.webp", "thigh-reach-wink.webp", "thigh-reach.webp"]
          ),
        { message: "ポーズ送り", timeout: 10_000 }
      )
      .toBe(true);
    const files = (await events(page)).filter((e) => e.k === "src" && e.chan === "hero").map((e) => e.file);
    expect(files[0], "ヒーローの絵は、まず立ち姿に替わる").toBe("thigh-stand.webp");
    // 登場が終わったあと、待機のウインクまでは 7 秒以上あるので、手を伸ばした絵のまま
    await expect(chan).toHaveAttribute("src", /thigh-reach\.webp$/);
    expect(errors).toEqual([]);
  });

  test("スクリプトが動き出したときヒーローが画面に無ければ、あとで見えても手を振らず、すてぶるちゃんの絵もそのまま", async ({
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
    expect(evs.filter((e) => e.k === "src" && e.chan === "hero"), "登場のポーズ送りをしない").toEqual([]);
    await expect(page.locator(".hero-cast-chan")).toHaveAttribute("src", /thigh-reach-wink\.webp$/);
  });
});

// ─── すてぶるくんの目・すてぶるちゃんのウインク ──────────────────────────────

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

test("待機のウインク：立ち絵のすてぶるちゃんが 7〜11 秒おきに thigh-reach-wink を 380ms だけ出す（reduce でも出る）", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installRecorder(page);
  await page.goto("/");
  const chan = page.locator('#videos .cast-chan[data-chan="wink"]');
  await expect(chan).toHaveAttribute("src", /thigh-reach\.webp$/);
  await scrollCenter(page.locator("#videos .cast"));
  await waitFor(
    page,
    "thigh-reach-wink が出る",
    (e) => e.k === "src" && e.chan === "wink" && e.file === "thigh-reach-wink.webp",
    25_000
  );
  const evs = await events(page);
  const wink = evs.find((e) => e.k === "src" && e.chan === "wink" && e.file === "thigh-reach-wink.webp");
  await expect
    .poll(async () => (await events(page)).some((e) => e.k === "src" && e.id === wink.id && e.t > wink.t))
    .toBe(true);
  const back = (await events(page)).find((e) => e.k === "src" && e.id === wink.id && e.t > wink.t);
  expect(back.file).toBe("thigh-reach.webp");
  expect(back.t - wink.t, "ウインクは 380ms ほど").toBeGreaterThan(250);
  expect(back.t - wink.t, "ウインクは 380ms ほど").toBeLessThan(1500);
});

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

      // 顔の絵と data-face は設計書 §2-4 の表のとおり。行の話し手と合う
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

      // ヒーロー・立ち絵の組み立て（設計書 §2-1〜2-3）
      const shape = await page.evaluate(() => {
        const names = (rig) => Array.prototype.map.call(rig.querySelectorAll("img"), (i) => i.getAttribute("src").split("/").pop());
        const attr = (el, name) => (el ? el.getAttribute(name) : null);
        const file = (el) => (el ? el.getAttribute("src").split("/").pop() : null);
        return {
          heroRig: names(document.querySelector('.hero-cast .kun-rig[data-kun="hero"]')),
          heroMouth: file(document.querySelector('.hero-cast .kun-mouth')),
          heroChan: { src: file(document.querySelector('.hero-cast img[data-chan="hero"]')), w: attr(document.querySelector('.hero-cast img[data-chan="hero"]'), "width"), h: attr(document.querySelector('.hero-cast img[data-chan="hero"]'), "height") },
          videos: {
            chan: file(document.querySelector("#videos .cast img[data-chan]")),
            mode: attr(document.querySelector("#videos .cast img[data-chan]"), "data-chan"),
            mouth: file(document.querySelector("#videos .cast .kun-mouth")),
            kun: attr(document.querySelector("#videos .cast .kun-rig"), "data-kun"),
          },
          guest: {
            chan: file(document.querySelector("#early-access .cast img[data-chan]")),
            mode: attr(document.querySelector("#early-access .cast img[data-chan]"), "data-chan"),
            mouth: file(document.querySelector("#early-access .cast .kun-mouth")),
            kun: attr(document.querySelector("#early-access .cast .kun-rig"), "data-kun"),
          },
          castRig: names(document.querySelector("#videos .cast .kun-rig")),
          parts: Array.prototype.map.call(document.querySelectorAll(".kun-rig img, [data-chan]"), (i) => [i.getAttribute("alt"), i.closest("[aria-hidden='true']") ? "hidden" : "exposed"]),
        };
      });
      const rigParts = ["foot-l", "foot-r", "arm-l", "arm-r", "body", "cheeks", "eyes-open", "mouth-rest"].map((n) => `${n}.webp`);
      expect(shape.heroRig).toEqual(rigParts);
      expect(shape.heroMouth).toBe("mouth-rest.webp");
      expect(shape.heroChan).toEqual({ src: "thigh-reach-wink.webp", w: "340", h: "480" });
      expect(shape.videos).toEqual({ chan: "thigh-reach.webp", mode: "wink", mouth: "mouth-o.webp", kun: "cast" });
      expect(shape.guest).toEqual({ chan: "thigh-stand.webp", mode: "greet", mouth: "mouth-rest.webp", kun: "cast" });
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

      // ヒーローが動き、動画欄・相談欄の会話が再生される（立ち絵とも連動する）
      await expect(page.locator(HERO_RIG)).toHaveClass(IS_LIVE, { timeout: 10_000 });
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
  test("assets/characters.js：左右反転・色の加工・HTML の組み立て・インラインの style・新しすぎる書き方を使わない", () => {
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
    ];
    for (const [re, label] of banned) {
      expect(code, `assets/characters.js に ${label} がある`).not.toMatch(re);
    }
  });

  test("assets/lp.css：左右反転・負の scale を使わず、キャラの規則に filter・hue-rotate・使わない CSS が無い", () => {
    const css = readText("assets/lp.css");
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // 設計書 §5-10 は lp.css 全体に hue-rotate が無いことを求めるが、ヒーローのロゴ（.hero-logo）が元から使っている。
    // そのため hue-rotate と filter は、キャラの規則に限って見る（左右反転と負の scale は全体で見る）
    expect(withoutComments, "scaleX(-1)").not.toMatch(/scaleX\(\s*-/);
    expect(withoutComments, "innerHTML・.style.").not.toMatch(/innerHTML|\.style\./);
    expect(withoutComments, "負の scale").not.toMatch(/scale\(\s*-|scale\([^)]*,\s*-|scaleY\(\s*-/);
    expect(withoutComments, "@property").not.toContain("@property");
    expect(withoutComments, "offset-path").not.toContain("offset-path");

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

    // 動きの @keyframes がそろっている
    for (const name of ["kun-breathe", "kun-arm-l-sway", "kun-arm-r-sway", "kun-wave", "chan-breathe"]) {
      expect(rules.some((r) => r.selector === `@keyframes ${name}`), `@keyframes ${name}`).toBe(true);
    }
  });
});
