import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── つかいかた動画 ──────────────────────────────────────────────────────────

// このファイルが保証する範囲
// - YouTube（youtube-nocookie.com・youtube.com・ytimg.com・googlevideo.com）と計測タグ（Google）への HTTP は、
//   context.route で受けて外に出さない。YouTube には iframe の中身として空の 200 を返す（動画そのものは読み込まれない）
// - YouTube の動画 ID は、ID を入れるまで HTML では空。「ID が全部入っている」の 1 本だけは HTML をそのまま見るので、ID を入れるまで落ちる（落ちるのが正しい）。
//   ほかのテストは、index.html / en/index.html の応答を書き換えて、偽の ID（test0000001 など）を入れて動かす。ID が空でも通る
// - preconnect による DNS・TCP・TLS の接続は、ブラウザが試みうる（route は HTTP の要求しか受けない）。
//   ただし、テストが見るのは link 要素の有無なので、接続の成否は結果に影響しない
// - 確かめるのは DOM と属性（href・src・title・referrerpolicy・preconnect の有無）、送られた要求の URL、_headers の CSP まで。
//   実際の再生、YouTube 側のエラー（埋め込み不可など）は、公開前の手動確認（プレビューと iPhone の Safari）で見る
// - 本番ヘッダ（CSP・Referrer-Policy）はローカルの静的サーバーが付けないので、「本番ヘッダ」の 2 本だけ、_headers の値を応答に付け直して動かす

// 第1〜8回と番外編のパスキーのはなし（how-pk）
const EPISODES = ["how-01", "how-02", "how-03", "how-04", "how-05", "how-06", "how-07", "how-08", "how-pk"];
const ENGLISH_EPISODE = "how-08en";

const YT_ORIGIN = "https://www.youtube-nocookie.com";
const WATCH = "https://www.youtube.com/watch?v=";
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// テスト用の偽の ID（11 文字）。how-01 → test0000001、how-08 → test0000008、how-pk → test000000k、how-08en → test00008en
const FAKE_ID = {
  ...Object.fromEntries(EPISODES.map((id) => [id, `test000000${id.slice(-1)}`])),
  [ENGLISH_EPISODE]: "test00008en",
};

// YouTube と Google のタグ（計測）への HTTP は、ここで受けて外に出さない（保証範囲はファイル冒頭）
const YOUTUBE = /^https?:\/\/([a-z0-9-]+\.)*(youtube-nocookie\.com|youtube\.com|ytimg\.com|googlevideo\.com)(?=[/:?#]|$)/;
const ANALYTICS = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;
const routeOutside = async (context) => {
  await context.route(YOUTUBE, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "" })
  );
  await context.route(ANALYTICS, (route) => route.abort());
};

// _headers の CSP の 1 行（本番ヘッダをかけるテストと、CSP の確認で使う）
const headersFile = () => readFileSync(join(process.cwd(), "_headers"), "utf8");
const cspPolicy = () => {
  const line = headersFile()
    .split("\n")
    .find((l) => /^\s*Content-Security-Policy:/.test(l));
  expect(line, "_headers に Content-Security-Policy の行がある").toBeTruthy();
  return line.replace(/^\s*Content-Security-Policy:\s*/, "").trim();
};

// a[data-video="how-NN"] の data-youtube と href を書き換える。
// 回の指定（data-video）があるリンクだけが対象（一覧の各回と、ポスターのリンク）
const rewriteIds = (html, mode) =>
  html.replace(/<a\b[^>]*\sdata-video="(how-[0-9a-z]+)"[^>]*>/g, (tag, id) => {
    const ytId = mode === "empty" ? "" : FAKE_ID[id];
    if (ytId === undefined) {
      return tag;
    }
    const bare = tag.replace(/\sdata-youtube="[^"]*"/, "").replace(/\shref="[^"]*"/, "");
    return bare.replace(/^<a\b/, `<a data-youtube="${ytId}" href="${WATCH}${ytId}"`);
  });

const PAGE_PATHS = new Set(["/", "/index.html", "/en/", "/en/index.html"]);
const routePages = async (context, { youtubeIds, prodHeaders }) => {
  if (youtubeIds === "as-is" && !prodHeaders) {
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
      let body = await response.text();
      if (youtubeIds !== "as-is") {
        body = rewriteIds(body, youtubeIds);
      }
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      if (prodHeaders) {
        headers["content-security-policy"] = cspPolicy();
        headers["referrer-policy"] = "no-referrer";
      }
      return route.fulfill({ response, body, headers });
    }
  );
};

// youtubeIds: "fake"（既定。偽の ID を入れる）／"empty"（ID が空の回）／"as-is"（HTML をそのまま見る）
// prodHeaders: true なら、_headers の CSP と Referrer-Policy: no-referrer を HTML の応答に付ける
const test = base.extend({
  youtubeIds: ["fake", { option: true }],
  prodHeaders: [false, { option: true }],
  context: async ({ context, youtubeIds, prodHeaders }, use) => {
    await routeOutside(context);
    await routePages(context, { youtubeIds, prodHeaders });
    await use(context);
  },
});

// YouTube への要求を集める（route で受けた要求も、request イベントには出る）
const watchYoutube = (page) => {
  const requests = [];
  page.on("request", (req) => {
    if (YOUTUBE.test(req.url())) {
      requests.push({ url: req.url(), referer: req.headers()["referer"] });
    }
  });
  return requests;
};

// 計測イベント（lp.js が document に投げる stblpay:analytics）を window.__stbl に溜める。goto の前に呼ぶ
const recordEvents = (page) =>
  page.addInitScript(() => {
    window.__stbl = [];
    document.addEventListener("stblpay:analytics", (event) => window.__stbl.push(event.detail));
  });
const eventsOf = (page, name) =>
  page.evaluate((n) => (window.__stbl || []).filter((e) => e.name === n).map((e) => e.params.video_id), name);

const PLAYER = "iframe[data-video-player]";
const embedPattern = (ytId) => new RegExp(`^${YT_ORIGIN.replace(/\./g, "\\.")}/embed/${ytId}\\?`);

// iframe の src が、youtube-nocookie の embed で、再生に必要なパラメータを持つ
const expectEmbed = async (iframe, ytId, lang) => {
  await expect(iframe).toHaveAttribute("src", embedPattern(ytId));
  const params = new URL(await iframe.getAttribute("src")).searchParams;
  expect(params.get("autoplay"), "autoplay").toBe("1");
  expect(params.get("rel"), "rel").toBe("0");
  expect(params.get("playsinline"), "playsinline").toBe("1");
  expect(params.get("hl"), "hl").toBe(lang);
};

// ページに今ある preconnect（オリジンだけ）
const preconnects = (page) =>
  page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('link[rel="preconnect"]'), (l) => new URL(l.href).origin)
  );

test.describe("つかいかた動画（日本語LP）", () => {
  test("一覧に第1〜8回と番外編のパスキーのはなしが並び（予告・まるごと解説は出さない）、mp4 は使わず、ポスター・サムネイルはサイトから配信される", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const items = page.locator("#videos .video-item[data-video]");
    await expect(items).toHaveCount(EPISODES.length);
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute("data-video")))).toEqual(EPISODES);

    // 動画は YouTube から出す。mp4 のリンクも video 要素も、R2 のドメインも残さない
    await expect(page.locator('a[href*=".mp4"], [src*=".mp4"]')).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    for (const file of ["index.html", "en/index.html", "_headers", "assets/lp.js"]) {
      expect(readFileSync(join(process.cwd(), file), "utf8"), `${file} に R2 のドメインが残っている`).not.toContain(
        "media.stbl-pay.com"
      );
    }

    // ポスター・サムネイルは YouTube のものではなく、サイト側から配信される
    for (const id of EPISODES) {
      for (const img of [`${id}.webp`, `${id}-640.webp`, `${id}-thumb.webp`]) {
        const res = await request.head(`/assets/video/${img}`);
        expect(res.status(), img).toBe(200);
      }
    }
    await expect(page.locator("[data-video-poster] img")).toHaveAttribute("src", "assets/video/how-01.webp");
    await expect(page.locator("#videos .video-item img")).toHaveCount(EPISODES.length);
    const thumbs = await page
      .locator("#videos .video-item img")
      .evaluateAll((els) => els.map((el) => el.getAttribute("src")));
    expect(thumbs).toEqual(EPISODES.map((id) => `assets/video/${id}-thumb.webp`));

    // 番外編のまるごと解説（手数料 5% が LP の「検討中」と食い違う）は LP に出さない。予告も YouTube に上げていないので出さない
    await expect(page.locator('#videos [href*="how-sp"], #videos [data-video="how-sp"], #videos [href*="EXfpLc6FXzw"]')).toHaveCount(0);
    await expect(page.locator('#video-how-00, #videos [data-video="how-00"], #videos [src*="how-00"]')).toHaveCount(0);
  });

  test("読み込み時は iframe も YouTube への通信もなく、ポスターだけがある", async ({ page }) => {
    const youtube = watchYoutube(page);
    await page.goto("/");
    await page.locator("#videos").scrollIntoViewIfNeeded();
    await page.locator("[data-video-frame]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    const poster = page.locator("[data-video-poster]");
    await expect(poster).toHaveAttribute("href", `${WATCH}${FAKE_ID["how-01"]}`);
    await expect(poster.locator("img")).toHaveAttribute("loading", "lazy");
    expect(youtube.map((r) => r.url)).toEqual([]);
  });

  test("ポスターを押すと、その場で iframe ができ、youtube-nocookie の embed を指す（YouTube への要求はその 1 つだけ）", async ({
    page,
  }) => {
    const youtube = watchYoutube(page);
    await page.goto("/");
    await page.locator("[data-video-poster]").click();
    const player = page.locator(`#video-stage ${PLAYER}`);
    await expect(player).toHaveCount(1);
    await expectEmbed(player, FAKE_ID["how-01"], "ja");

    // 埋め込みの属性
    await expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await expect(player).toHaveAttribute("allow", /\bautoplay\b/);
    await expect(player).toHaveAttribute("allow", /\bfullscreen\b/);
    await expect(player).toHaveAttribute("allow", /\bencrypted-media\b/);
    await expect(player).toHaveAttribute("allow", /\bpicture-in-picture\b/);
    expect(await player.evaluate((el) => el.hasAttribute("allowfullscreen")), "allowfullscreen").toBe(true);
    await expect(player).toHaveAttribute("title", /第1回.*すてぶるペイって、なに？/);
    await expect(player).toHaveAttribute("width", "1920");
    await expect(player).toHaveAttribute("height", "1080");
    // 読み込みの遅延は付けない（押したときに読ませる）
    expect(await player.evaluate((el) => el.hasAttribute("loading")), "loading").toBe(false);

    // video 要素は使わない。ポスターは iframe に置き換わり、押した iframe にフォーカスが移る
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator("[data-video-poster]")).toBeHidden();
    await expect(player).toBeFocused();

    // YouTube への要求は embed の 1 つだけ。IFrame Player API の JS（iframe_api）も、サムネイル（ytimg）も読まない
    await expect.poll(() => youtube.length).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(youtube).toHaveLength(1);
    expect(youtube[0].url).toMatch(embedPattern(FAKE_ID["how-01"]));
    await expect(page.locator('script[src*="youtube"], script[src*="ytimg"]')).toHaveCount(0);
  });

  test("iframe は枠に収まり（枠線なし）、狭い画面でも YouTube の最小寸法 200×200 を満たし、横スクロールが出ない", async ({ page }) => {
    // iframe は width=1920 height=1080 の属性で作るので、CSS（.video-frame iframe）が無いと枠からはみ出す
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 375, height: 800 },
      { width: 320, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.locator("[data-video-poster]").click();
      await expect(page.locator(`#video-stage ${PLAYER}`)).toHaveCount(1);
      const m = await page.evaluate(() => {
        const frame = document.querySelector("[data-video-frame]").getBoundingClientRect();
        const iframe = document.querySelector("iframe[data-video-player]");
        const box = iframe.getBoundingClientRect();
        return {
          frameWidth: frame.width,
          width: box.width,
          height: box.height,
          border: getComputedStyle(iframe).borderTopWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });
      const where = `${viewport.width}px`;
      expect(m.width, `${where}: iframe の幅が枠に収まる`).toBeLessThanOrEqual(m.frameWidth);
      if (viewport.width >= 1280) {
        expect(m.width / m.height, `${where}: iframe は 16:9`).toBeCloseTo(16 / 9, 1);
      }
      // YouTube の埋め込みの最小寸法（200×200px）
      // （レイアウトの計算で 199.99997 のような端数が出るので、丸めて比べる）
      expect(Math.round(m.width), `${where}: iframe の幅は 200px 以上`).toBeGreaterThanOrEqual(200);
      expect(Math.round(m.height), `${where}: iframe の高さは 200px 以上`).toBeGreaterThanOrEqual(200);
      expect(m.border, `${where}: iframe に既定の枠線を付けない`).toBe("0px");
      expect(m.scrollWidth, `${where}: 横スクロールが出ない`).toBeLessThanOrEqual(m.clientWidth);
    }
  });

  test("押してから YouTube のプレーヤーを読み終わるまで、枠に読み込み中の印（is-loading・aria-busy）を出し、読み終わったら消す", async ({
    page,
  }) => {
    // embed の応答を、テストが返すまで止めておく
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(/youtube-nocookie\.com\/embed\//, async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "" });
    });
    await page.goto("/");
    const frame = page.locator("[data-video-frame]");
    await expect(frame).not.toHaveClass(/\bis-loading\b/);
    await page.locator("[data-video-poster]").click();
    await expect(frame).toHaveClass(/\bis-loading\b/);
    await expect(frame).toHaveAttribute("aria-busy", "true");
    // 印は再生ボタンと同じ大きさの四角で、押す邪魔をしない
    const mark = await frame.evaluate((el) => {
      const cs = getComputedStyle(el, "::before");
      return { content: cs.content, width: cs.width, events: cs.pointerEvents };
    });
    expect(mark).toEqual({ content: '""', width: "72px", events: "none" });
    expect(await frame.evaluate((el) => getComputedStyle(el, "::after").content), "読み込み中の文字").toBe('"読み込み中…"');
    await page.waitForTimeout(500);
    await expect(frame, "読み終わるまでは消さない").toHaveClass(/\bis-loading\b/);
    release();
    await expect(frame).not.toHaveClass(/\bis-loading\b/);
    await expect(frame).not.toHaveAttribute("aria-busy", /.*/);
  });

  test("一覧から回を選ぶと、iframe を作り直して新しい回にし、説明も替わる（履歴は増やさない）", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-video-poster]").click();
    const player = page.locator(`#video-stage ${PLAYER}`);
    await expectEmbed(player, FAKE_ID["how-01"], "ja");
    const firstTitle = await player.getAttribute("title");
    // 回を替えると iframe を作り直すことを見る（印を付けておく）。
    // 同じ iframe の src を差し替えると履歴が増え、「戻る」でページを離れられなくなるため
    await player.evaluate((el) => {
      el.__kept = true;
    });
    const historyBefore = await page.evaluate(() => history.length);

    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await expectEmbed(player, FAKE_ID["how-02"], "ja");
    await expect(player).toHaveAttribute("title", /第2回.*はじめてのネット払い/);
    expect(await player.getAttribute("title")).not.toBe(firstTitle);
    await expect(page.locator("iframe")).toHaveCount(1);
    expect(await page.locator(PLAYER).evaluate((el) => el.__kept === true), "iframe を作り直している").toBe(false);
    expect(await page.evaluate(() => history.length), "回を替えても履歴は増えない").toBe(historyBefore);
    await expect(player).toBeFocused();
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第2回");
    await expect(page.locator('[data-video-field="title"]')).toHaveText("はじめてのネット払い");
    await expect(page.locator('[data-video-field="dur"]')).toHaveText("3:02");
    await expect(page.locator('.video-item[aria-current="true"]')).toHaveAttribute("data-video", "how-02");
    await expect(page).toHaveURL(/#video-how-02$/);

    await page.locator("[data-video-next]").click();
    await expectEmbed(player, FAKE_ID["how-03"], "ja");
    await expect(player).toHaveAttribute("title", /第3回.*2回目からは、パスキーで/);
    await expect(page.locator("iframe")).toHaveCount(1);

    // 最後の回（番外編のパスキーのはなし）では「次の回へ」を出さない
    await page.locator('#videos .video-item[data-video="how-pk"]').click();
    await expectEmbed(player, FAKE_ID["how-pk"], "ja");
    await expect(player).toHaveAttribute("title", /番外編.*パスキーのはなし/);
    await expect(page.locator("[data-video-next]")).toBeHidden();
  });

  test("各セクションの「動画で見る」から、その回を選べる", async ({ page }) => {
    await page.goto("/");
    await page.locator('#merchants [data-video-link="how-06"]').click();
    await expectEmbed(page.locator(`#video-stage ${PLAYER}`), FAKE_ID["how-06"], "ja");
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第6回");
  });

  test("#video-how-NN で開くと、その回が選ばれている（再生はしないので iframe はできない）", async ({ page }) => {
    const youtube = watchYoutube(page);
    await page.goto("/#video-how-04");
    // 再生しないまま回だけ替わる。ポスターのリンク先・ラベル・画像が、その回になる
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", `${WATCH}${FAKE_ID["how-04"]}`);
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("aria-label", /第4回.*お店で QR で払う/);
    await expect(page.locator("[data-video-poster] img")).toHaveAttribute("src", "assets/video/how-04.webp");
    await expect(page.locator("[data-video-poster] img")).toHaveAttribute("srcset", /how-04-640\.webp 640w/);
    await expect(page.locator('.video-item[aria-current="true"]')).toHaveAttribute("data-video", "how-04");
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator('[data-video-field="title"]')).toHaveText("お店で QR で払う");
    await page.waitForTimeout(300);
    expect(youtube.map((r) => r.url)).toEqual([]);

    // そこでポスターを押すと、選ばれていた回（第4回）が再生される
    await page.locator("[data-video-poster]").click();
    await expectEmbed(page.locator(PLAYER), FAKE_ID["how-04"], "ja");
  });

  test("不正な % を含む #… で開いても、JS は止まらず動画を選べる", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/#%E0%A4%A");
    await page.locator('#videos a.video-item[data-video="how-03"]').click();
    await expect(page.locator('.video-item[aria-current="true"]')).toHaveAttribute("data-video", "how-03");
    await expectEmbed(page.locator(PLAYER), FAKE_ID["how-03"], "ja");
    expect(errors).toEqual([]);
  });

  test("video_play は、押して再生を始めたときに回ごとに 1 回だけ送り、video_complete は送らない", async ({
    page,
  }) => {
    await recordEvents(page);
    await page.goto("/");
    await page.waitForTimeout(300);
    expect(await eventsOf(page, "video_play"), "読み込んだだけでは送らない").toEqual([]);

    await page.locator("[data-video-poster]").click();
    await expect.poll(() => eventsOf(page, "video_play")).toEqual(["how-01"]);

    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await expect.poll(() => eventsOf(page, "video_play")).toEqual(["how-01", "how-02"]);

    // 同じ回をもう一度押しても、増えない
    await page.locator('#videos .video-item[data-video="how-01"]').click();
    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await page.waitForTimeout(300);
    expect(await eventsOf(page, "video_play")).toEqual(["how-01", "how-02"]);

    // 終わったことは取れない（IFrame Player API は読まない）ので、イベントごと送らない
    expect(await eventsOf(page, "video_complete")).toEqual([]);
    // （「送らない」と説明するコメントは許す。コメント行を除いたコードに名前が残っていないことを見る）
    const code = readFileSync(join(process.cwd(), "assets", "lp.js"), "utf8")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");
    expect(code, "lp.js のコードに video_complete が残っている").not.toContain("video_complete");
  });

  test("最後の回で「次の回へ」を押しても、フォーカスが iframe に残る", async ({ page }) => {
    await page.goto("/#video-how-08");
    const next = page.locator("[data-video-next]");
    await expect(next).toBeVisible();
    await next.focus();
    await page.keyboard.press("Enter");
    const player = page.locator(`#video-stage ${PLAYER}`);
    await expectEmbed(player, FAKE_ID["how-pk"], "ja");
    await expect(next).toBeHidden();
    await expect(player).toBeFocused();
  });
});

// ─── preconnect（再生する意思があるときだけ、Google に接続する） ─────────────

test.describe("preconnect", () => {
  test("読み込み直後も、動画の欄に近づいても、preconnect は無い", async ({ page }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      await page.waitForTimeout(300);
      expect(await preconnects(page), `${path} の読み込み直後`).toEqual([]);
      // 動画の欄までスクロールしても、足されない
      await page.locator("[data-video-frame]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      expect(await preconnects(page), `${path} の動画の欄に近づいたあと`).toEqual([]);
    }
  });

  test("ポスターにポインタが乗ると、youtube-nocookie への preconnect が 1 つだけ足される", async ({ page }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      await page.locator("[data-video-poster]").hover();
      await expect.poll(() => preconnects(page), { message: `${path} のポスターに乗ったあと` }).toEqual([YT_ORIGIN]);
      // 外れて、また乗っても増えない
      await page.mouse.move(0, 0);
      await page.locator("[data-video-poster]").hover();
      await page.waitForTimeout(300);
      expect(await preconnects(page), `${path} でもう一度乗ったあと`).toEqual([YT_ORIGIN]);
    }
  });

  test("一覧の回にポインタが乗ったときも足され、ポスターに乗っても増えない", async ({ page }) => {
    await page.goto("/");
    expect(await preconnects(page)).toEqual([]);
    await page.locator('#videos .video-item[data-video="how-03"]').hover();
    await expect.poll(() => preconnects(page)).toEqual([YT_ORIGIN]);
    await page.locator("[data-video-poster]").hover();
    await page.waitForTimeout(300);
    expect(await preconnects(page)).toEqual([YT_ORIGIN]);
  });

  test("ポスターや一覧の回にフォーカスが来たときも、1 つだけ足される", async ({ page }) => {
    for (const selector of ["[data-video-poster]", '#videos .video-item[data-video="how-05"]']) {
      await page.goto("/");
      expect(await preconnects(page), `${selector} の前`).toEqual([]);
      await page.locator(selector).focus();
      await expect.poll(() => preconnects(page), { message: `${selector} にフォーカスしたあと` }).toEqual([YT_ORIGIN]);
    }
    // 英語ページのポスター
    await page.goto("/en/");
    await page.locator("[data-video-poster]").focus();
    await expect.poll(() => preconnects(page)).toEqual([YT_ORIGIN]);
  });

  test("R2（media.stbl-pay.com）への preconnect はどこにも無い", async ({ page }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      await page.locator("[data-video-poster]").hover();
      await page.waitForTimeout(300);
      for (const origin of await preconnects(page)) {
        expect(origin, `${path} の preconnect`).not.toContain("stbl-pay.com");
      }
    }
  });
});

// ─── YouTube の ID ───────────────────────────────────────────────────────────

test.describe("YouTube の ID", () => {
  // HTML をそのまま見る（偽の ID に書き換えない）
  test.use({ youtubeIds: "as-is" });

  test("data-youtube と href が、一覧もポスターも同じ ID の watch URL になっている（ID が空でも通る）", async ({
    page,
  }) => {
    const read = (locator) =>
      locator.evaluateAll((els) =>
        els.map((el) => ({
          video: el.getAttribute("data-video"),
          youtube: el.getAttribute("data-youtube"),
          href: el.getAttribute("href"),
        }))
      );

    await page.goto("/");
    const items = await read(page.locator("#videos a.video-item[data-video]"));
    expect(items.map((i) => i.video)).toEqual(EPISODES);
    for (const item of items) {
      expect(item.youtube, `${item.video} に data-youtube 属性がある（空でもよい）`).not.toBeNull();
      expect(item.href, `${item.video} の href`).toBe(`${WATCH}${item.youtube}`);
    }
    // ポスターのリンクは、初期表示の回（aria-current）と同じ回・同じ ID
    const current = await page.locator('#videos .video-item[aria-current="true"]').getAttribute("data-video");
    expect(current).toBe("how-01");
    const [poster] = await read(page.locator("[data-video-poster]"));
    expect(poster.video, "ポスターの data-video").toBe(current);
    expect(poster.youtube, "ポスターの data-youtube").not.toBeNull();
    expect(poster.href, "ポスターの href").toBe(`${WATCH}${poster.youtube}`);
    expect(poster.youtube).toBe(items.find((i) => i.video === current).youtube);

    await page.goto("/en/");
    const [enPoster] = await read(page.locator("[data-video-poster]"));
    expect(enPoster.video, "英語ページのポスターの data-video").toBe(ENGLISH_EPISODE);
    expect(enPoster.youtube, "英語ページのポスターの data-youtube").not.toBeNull();
    expect(enPoster.href, "英語ページのポスターの href").toBe(`${WATCH}${enPoster.youtube}`);
  });

  // ID を入れる前は、このテストだけが落ちる（test.fail などで隠さない）。scripts/set-youtube-ids.mjs で ID を入れると通る
  test("YouTube の ID が全部入っている（ID を入れるまで落ちる）", async ({ page }) => {
    await page.goto("/");
    const items = await page
      .locator("#videos a.video-item[data-video]")
      .evaluateAll((els) =>
        els.map((el) => ({ video: el.getAttribute("data-video"), youtube: el.getAttribute("data-youtube"), href: el.getAttribute("href") }))
      );
    expect(items.map((i) => i.video)).toEqual(EPISODES);
    for (const item of items) {
      expect(item.youtube, `${item.video} の data-youtube は 11 文字の ID`).toMatch(ID_PATTERN);
      expect(item.href, `${item.video} の href`).toBe(`${WATCH}${item.youtube}`);
    }
    // どの回もそれぞれ別の動画（貼り間違いで同じ ID が重ならない）
    expect(new Set(items.map((i) => i.youtube)).size, "一覧の ID が重なっている").toBe(EPISODES.length);

    const poster = await page.locator("[data-video-poster]").evaluate((el) => ({
      video: el.getAttribute("data-video"),
      youtube: el.getAttribute("data-youtube"),
      href: el.getAttribute("href"),
    }));
    const current = await page.locator('#videos .video-item[aria-current="true"]').getAttribute("data-video");
    expect(poster.video, "ポスターの data-video が、初期表示の回と合う").toBe(current);
    expect(poster.youtube, "ポスターの data-youtube は 11 文字の ID").toMatch(ID_PATTERN);
    expect(poster.href, "ポスターの href").toBe(`${WATCH}${poster.youtube}`);
    expect(poster.youtube, "ポスターの ID が、一覧の同じ回と合う").toBe(items.find((i) => i.video === current).youtube);

    await page.goto("/en/");
    const enPoster = await page.locator("[data-video-poster]").evaluate((el) => ({
      video: el.getAttribute("data-video"),
      youtube: el.getAttribute("data-youtube"),
      href: el.getAttribute("href"),
    }));
    expect(enPoster.video, "英語ページのポスターの data-video").toBe(ENGLISH_EPISODE);
    expect(enPoster.youtube, "英語ページのポスターの data-youtube は 11 文字の ID").toMatch(ID_PATTERN);
    expect(enPoster.href, "英語ページのポスターの href").toBe(`${WATCH}${enPoster.youtube}`);
  });
});

test.describe("ID が空の回", () => {
  test.use({ youtubeIds: "empty" });

  test("ポスターや一覧を押しても、iframe を作らず、YouTube にも飛ばない", async ({ page, context }) => {
    const youtube = watchYoutube(page);
    const opened = [];
    context.on("page", (p) => opened.push(p.url()));
    await recordEvents(page);
    await page.goto("/");
    const origin = new URL(page.url()).origin;

    await page.locator("[data-video-poster]").click();
    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await page.locator('#merchants [data-video-link="how-06"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator("iframe")).toHaveCount(0);
    expect(new URL(page.url()).origin, "ページから移っていない").toBe(origin);
    expect(youtube.map((r) => r.url), "YouTube への通信がない").toEqual([]);
    expect(opened, "新しいタブが開かない").toEqual([]);
    expect(await eventsOf(page, "video_play"), "再生を始めていないので video_play を送らない").toEqual([]);
  });

  test("ID が空のうちは、ポスターや一覧を中クリックしても空の watch URL を開かない", async ({ page, context }) => {
    const opened = [];
    context.on("page", (p) => opened.push(p.url()));
    await page.goto("/");
    // auxclick の既定の動き（新しいタブで開く）が止められているかを見る
    const prevented = await page.evaluate(() => {
      const fire = (el) => {
        const ev = new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      };
      return {
        poster: fire(document.querySelector("[data-video-poster]")),
        item: fire(document.querySelector('#videos .video-item[data-video="how-02"]')),
      };
    });
    expect(prevented.poster, "ポスターの中クリックを止める").toBe(true);
    expect(prevented.item, "一覧の中クリックを止める").toBe(true);
    await page.locator('#videos .video-item[data-video="how-03"]').click({ button: "middle" });
    await page.waitForTimeout(600);
    expect(opened, "新しいタブが開かない").toEqual([]);
  });
});

// ─── 英語ページ・JS なし ─────────────────────────────────────────────────────

test.describe("英語LP の動画とキャラクター", () => {
  test("第8回の英語字幕版のポスターを押すと、hl=en の iframe ができ、名前は英語の表記で出る", async ({ page }) => {
    const youtube = watchYoutube(page);
    await page.goto("/en/");
    await expect(page.locator("iframe")).toHaveCount(0);
    // 英語ページの動画は 1 本だけ（how-08en）。ポスターのリンクは watch URL
    await expect(page.locator("#videos [data-video-poster]")).toHaveAttribute("data-video", ENGLISH_EPISODE);
    await expect(page.locator("#videos [data-video-poster]")).toHaveAttribute("href", `${WATCH}${FAKE_ID[ENGLISH_EPISODE]}`);
    await expect(page.locator('a[href*=".mp4"], video')).toHaveCount(0);
    expect(youtube.map((r) => r.url)).toEqual([]);

    await page.locator("#videos [data-video-poster]").click();
    const player = page.locator(`#videos ${PLAYER}`);
    await expectEmbed(player, FAKE_ID[ENGLISH_EPISODE], "en");
    await expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await expect(player).toHaveAttribute("title", /Episode 8/);
    await expect(player).toBeFocused();
    expect(await player.evaluate((el) => el.hasAttribute("allowfullscreen"))).toBe(true);
    await expect(page.locator("#videos [data-video-poster]")).toBeHidden();
    await expect.poll(() => youtube.length).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(youtube).toHaveLength(1);
    expect(youtube[0].url).toMatch(embedPattern(FAKE_ID[ENGLISH_EPISODE]));

    const names = await page.locator(".talk-name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(["Suteburu-kun", "Suteburu-chan"]).toContain(n.trim());
    }
  });
});

test.describe("JS なし", () => {
  test.use({ javaScriptEnabled: false });

  test("一覧とポスターのリンクが、YouTube の watch URL を指す", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('#videos .video-item[data-video="how-05"]')).toHaveAttribute(
      "href",
      `${WATCH}${FAKE_ID["how-05"]}`
    );
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", `${WATCH}${FAKE_ID["how-01"]}`);
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.goto("/en/");
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", `${WATCH}${FAKE_ID[ENGLISH_EPISODE]}`);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});

// ─── 本番ヘッダ（CSP） ───────────────────────────────────────────────────────

// _headers は Cloudflare Pages が本番で付ける。ローカルの静的サーバーでは効かないので、ファイルを読んで確かめる
const cspDirectives = (name) =>
  cspPolicy()
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .filter((tokens) => tokens[0] === name);
const cspDirective = (name) => {
  const found = cspDirectives(name);
  expect(found, `CSP の ${name} は 1 つだけ`).toHaveLength(1);
  return found[0].slice(1);
};
const headerValue = (name) => {
  const line = headersFile()
    .split("\n")
    .find((l) => new RegExp(`^\\s*${name}:`, "i").test(l));
  expect(line, `_headers に ${name} の行がある`).toBeTruthy();
  return line.replace(new RegExp(`^\\s*${name}:\\s*`, "i"), "").trim();
};

test.describe("本番ヘッダ（CSP）", () => {
  test("frame-src は youtube-nocookie だけで、'none' ではない。media-src は無い", () => {
    expect(cspDirective("frame-src")).toEqual([YT_ORIGIN]);
    // mp4 は使わないので media-src は足さない（default-src の 'self' に任せる）
    expect(cspDirectives("media-src"), "media-src は書かない").toEqual([]);
    expect(cspDirective("default-src")).toEqual(["'self'"]);
  });

  test("YouTube のために広げたのは frame-src だけ（script・img・connect・サイト自身のフレーム制限は変えない）", () => {
    for (const name of ["script-src", "img-src", "connect-src", "style-src", "font-src"]) {
      const sources = cspDirective(name).join(" ");
      expect(sources, `${name} に YouTube が入っている`).not.toMatch(/youtube|ytimg|googlevideo/);
    }
    expect(cspDirective("frame-ancestors")).toEqual(["'none'"]);
    expect(cspDirective("object-src")).toEqual(["'none'"]);
    expect(cspDirective("require-trusted-types-for")).toEqual(["'script'"]);
    expect(cspPolicy()).not.toContain("media.stbl-pay.com");
  });

  test("Referrer-Policy は no-referrer のまま（iframe 側の referrerpolicy で上書きする前提）", () => {
    expect(headerValue("Referrer-Policy")).toBe("no-referrer");
    expect(headerValue("X-Frame-Options")).toBe("DENY");
  });
});

// 本番では、ページに _headers の CSP と Referrer-Policy: no-referrer が付く。
// その状態で、iframe が CSP に止められずに作れて、YouTube への要求にだけ Referer（オリジン）が付くことを見る。
// （ページが no-referrer のままだと YouTube は埋め込みを断る＝エラー 153。iframe の referrerpolicy で上書きしている）
test.describe("本番ヘッダをかけたページ", () => {
  test.use({ prodHeaders: true });

  for (const [path, lang, videoId] of [
    ["/", "ja", "how-01"],
    ["/en/", "en", ENGLISH_EPISODE],
  ]) {
    test(`${path}：CSP に止められず iframe ができ、YouTube への要求だけに Referer が付く`, async ({ page }) => {
      const youtube = watchYoutube(page);
      const own = [];
      page.on("request", (req) => {
        if (req.url().endsWith("/assets/lp.js")) own.push(req.headers()["referer"]);
      });
      // CSP 違反を溜める
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          window.__csp.push(e.effectiveDirective + " " + e.blockedURI)
        );
      });
      const response = await page.goto(path);
      // 本番ヘッダが応答に付いている（この確認が通らなければ、以降の確認は意味がない）
      expect(response.headers()["content-security-policy"]).toContain(`frame-src ${YT_ORIGIN};`);
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      // ページ自身の読み込みには Referer が付かない（no-referrer が効いている）
      await expect.poll(() => own.length).toBeGreaterThan(0);
      expect(own[0], "ページの lp.js の要求に Referer が付かない").toBeUndefined();

      await page.locator("[data-video-poster]").click();
      const player = page.locator(PLAYER);
      await expectEmbed(player, FAKE_ID[videoId], lang);
      await expect.poll(() => youtube.length).toBeGreaterThan(0);
      await page.waitForTimeout(300);
      expect(youtube).toHaveLength(1);
      // iframe の referrerpolicy が効いて、オリジンだけが送られる（パスは送らない）
      expect(youtube[0].referer, "YouTube への要求の Referer").toBe(`${new URL(page.url()).origin}/`);

      // CSP の違反は、frame-src と Trusted Types について 1 つも無い
      const violations = await page.evaluate(() => window.__csp);
      const mine = violations.filter((v) => /^(frame-src|child-src|require-trusted-types-for|trusted-types)/.test(v));
      expect(mine, "iframe まわりの CSP 違反").toEqual([]);

      // 対照：許していない先のフレームは、この環境でも CSP が止める（CSP が本当にかかっている）
      await page.evaluate(() => {
        const control = document.createElement("iframe");
        control.setAttribute("src", "https://not-allowed.invalid/");
        document.body.appendChild(control);
      });
      await expect
        .poll(() => page.evaluate(() => window.__csp.some((v) => v.startsWith("frame-src") && v.includes("not-allowed"))))
        .toBe(true);
    });
  }
});

// ─── すてぶるくん・すてぶるちゃん ────────────────────────────────────────────

// 設定資料 §12.4 の禁止語（宣伝を含む場面ではキャラのセリフでも避ける）。
// 動画まわりの文（セリフ・回の題と説明・動画欄のリード・「動画で見る」）が対象
const BANNED = [
  "代理", "代行", "管理", "預かり", "自動", "必ず", "手間ゼロ", "登録不要", "審査している",
  "BAN", "凍結回避", "審査なし", "即日", "だれでも", "すぐ", "手数料",
];
const COPY_SELECTORS = [
  ".talk-text",
  "#videos .sec-lead",
  "#videos .video-item-title",
  "#videos .video-now-desc",
  ".video-link",
];
const collectCopy = async (page) => {
  const parts = [];
  for (const sel of COPY_SELECTORS) {
    parts.push(...(await page.locator(sel).allTextContents()));
  }
  parts.push(
    ...(await page
      .locator(".video-item[data-desc]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-desc"))))
  );
  return parts.join("\n");
};

test.describe("キャラクター（日本語LP）", () => {
  test("会話の名前は必ずフルネームで、セリフに禁止語がない", async ({ page }) => {
    await page.goto("/");
    const names = await page.locator(".talk-name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(["すてぶるくん", "すてぶるちゃん"]).toContain(n.trim());
    }
    const copy = await collectCopy(page);
    for (const word of BANNED) {
      expect(copy, `動画・会話の文に「${word}」`).not.toContain(word);
    }
  });

  test("キャラクターの絵が読み込まれ、装飾として読み上げ対象から外れている", async ({ page }) => {
    await page.goto("/");
    const imgs = page.locator(".talk-face, .cast img, .faq-nap img, .hero-cast img");
    const count = await imgs.count();
    expect(count).toBeGreaterThan(10);
    for (let i = 0; i < count; i++) {
      const img = imgs.nth(i);
      await expect(img).toHaveAttribute("alt", "");
      // 幅によって出さない絵（display:none）は読み込まれないので対象外
      if (!(await img.isVisible())) continue;
      // loading="lazy" を読ませる（浮いている絵は動き続けるので、安定待ちのない scrollIntoView を使う）
      await img.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 5000 })
        .toBe(true);
    }
    for (const sel of [".cast", ".faq-nap", ".hero-cast"]) {
      const els = page.locator(sel);
      for (let i = 0; i < (await els.count()); i++) {
        await expect(els.nth(i)).toHaveAttribute("aria-hidden", "true");
      }
    }
  });
});
