import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── つかいかた動画 ──────────────────────────────────────────────────────────

// このファイルが保証する範囲
// - R2（media.stbl-pay.com）と計測タグ（Google）への HTTP は、context.route で受けて外に出さない。
//   R2 の mp4 は手元の assets/video/ から返し、手元に無ければ止める
// - preconnect による DNS・TCP・TLS の接続は、ブラウザが試みうる（route は HTTP の要求しか受けない）。
//   ただし、テストが見るのは link 要素の有無なので、接続の成否は結果に影響しない
// - 確かめるのは DOM と属性（href・src・poster・preconnect の有無・_headers の CSP）まで。
//   実際の再生とシークは、公開前の手動確認（プレビューと iPhone の Safari）で見る
// - 版の中身（mp4 のバイト列がハッシュと合うか）は見ない。route は版のディレクトリを読み飛ばして手元の mp4 を返す

const EPISODES = ["how-00", "how-01", "how-02", "how-03", "how-04", "how-05", "how-06", "how-07", "how-08"];

// mp4 は git に入れず、Cloudflare R2 の独自ドメインから出す。版は <YYYY-MM-DD>-<h8>（h8 は mp4 10 本の sha256 から決まる 8 桁）。
// 作り直すたびに変わるので、版は固定で書かない。日付だけの版は認めない
const MEDIA_ORIGIN = "https://media.stbl-pay.com";
const MEDIA_BASE = /^https:\/\/media\.stbl-pay\.com\/how\/\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\//;
const VIDEO_DIR = join(process.cwd(), "assets", "video");

// R2 と Google のタグ（計測）への HTTP は、ここで受けて外に出さない（保証範囲はファイル冒頭）。
// R2 への mp4 の取得は手元の assets/video/ で受ける（手元に無ければ止める）。
// 外の応答を待たずに、動画まわりの確認だけを速く回すため
const ANALYTICS = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;
const routeOutside = async (context) => {
  await context.route(`${MEDIA_ORIGIN}/**`, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    const file = join(VIDEO_DIR, name);
    if (/^how-[0-9a-z]+\.mp4$/.test(name) && existsSync(file)) {
      return route.fulfill({ path: file, contentType: "video/mp4" });
    }
    return route.abort();
  });
  await context.route(ANALYTICS, (route) => route.abort());
};

test.beforeEach(async ({ context }) => {
  await routeOutside(context);
});

// href が R2 の版付きパスなら、その版の URL（…/how/2026-10-16-1a2b3c4d/）を返す
const mediaBaseOf = (href) => {
  const match = MEDIA_BASE.exec(href || "");
  expect(match, `mp4 の href が R2 の版付きパス（日付-ハッシュ 8 桁）でない: ${href}`).not.toBeNull();
  return match[0];
};

// 一覧の最初の回から版を取る（他の mp4 がすべて同じ版かは、各テストで比べる）
const listBase = async (page) =>
  mediaBaseOf(await page.locator("#videos .video-item[data-video]").first().getAttribute("href"));

// video の poster は、mp4 の置き場に関係なく、サイト側の assets/video/ から出す
const expectSitePoster = async (page, player, file) => {
  const poster = await player.evaluate((el) => el.poster);
  expect(poster).toBe(new URL(`/assets/video/${file}.webp`, page.url()).href);
};

test.describe("つかいかた動画（日本語LP）", () => {
  test("一覧に予告と第1〜8回が並び、mp4 は R2 の同じ版を指し、ポスター・サムネイルはサイトから配信される", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const items = page.locator("#videos .video-item[data-video]");
    await expect(items).toHaveCount(EPISODES.length);
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute("data-video")))).toEqual(EPISODES);

    // mp4 は git に入れない（scripts/encode-videos.sh で作って R2 に置く）。サイトは R2 の版付きパスを指す
    const hrefs = await items.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    const base = mediaBaseOf(hrefs[0]);
    EPISODES.forEach((id, i) => expect(hrefs[i], `${id} の href`).toBe(`${base}${id}.mp4`));

    // ページ内の mp4 のリンクは、一覧 9 件とポスター 1 件。すべて同じ版で、ファイル名は how-00〜08
    const all = await page.locator('a[href*=".mp4"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(all).toHaveLength(EPISODES.length + 1);
    for (const href of all) {
      expect(href.startsWith(base), `${href} は ${base} の下にない`).toBe(true);
      expect(href.slice(base.length)).toMatch(/^how-0[0-8]\.mp4$/);
    }

    // ポスター・サムネイルはサイト側から配信される
    for (const id of EPISODES) {
      for (const img of [`${id}.webp`, `${id}-640.webp`, `${id}-thumb.webp`]) {
        const res = await request.head(`/assets/video/${img}`);
        expect(res.status(), img).toBe(200);
      }
    }
    // 番外編（手数料の数字などを含む営業向け）は LP に出さない
    await expect(page.locator('#videos [href*="how-sp"], #videos [href*="how-pk"]')).toHaveCount(0);
  });

  test("読み込み時は video 要素も mp4 も読まない（ポスターだけ）", async ({ page }) => {
    const mp4 = [];
    page.on("request", (req) => {
      if (/\.mp4(\?|$)/.test(req.url())) mp4.push(req.url());
    });
    await page.goto("/");
    await page.locator("#videos").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.locator("#videos video")).toHaveCount(0);
    const poster = page.locator("[data-video-poster]");
    await expect(poster).toHaveAttribute("href", `${await listBase(page)}how-01.mp4`);
    await expect(poster.locator("img")).toHaveAttribute("loading", "lazy");
    expect(mp4).toEqual([]);
  });

  test("動画の欄に近づくまで preconnect は無く、近づくと R2 への preconnect が 1 つ足される", async ({ page }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      const preconnect = page.locator(`head link[rel="preconnect"][href="${MEDIA_ORIGIN}"]`);
      // 読み込み直後には無い
      await page.waitForTimeout(300);
      await expect(preconnect, `${path} の読み込み直後`).toHaveCount(0);
      // 動画の欄までスクロールすると足される
      await page.locator("[data-video-frame]").scrollIntoViewIfNeeded();
      await expect(preconnect, `${path} の動画の欄に近づいたあと`).toHaveCount(1);
      // 戻って、また近づいても増えない
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator("[data-video-frame]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await expect(preconnect, `${path} で動画の欄に戻ったあと`).toHaveCount(1);
    }
  });

  test("ポスターを押すと、その場で video 要素ができ、src が R2 の mp4 になる", async ({ page }) => {
    await page.goto("/");
    const base = await listBase(page);
    await page.locator("[data-video-poster]").click();
    const player = page.locator("#video-stage video[data-video-player]");
    await expect(player).toHaveAttribute("src", `${base}how-01.mp4`);
    await expectSitePoster(page, player, "how-01");
    await expect(page.locator("[data-video-poster]")).toHaveCount(0);
    // crossorigin は付けない（mp4 の読み込みに CORS はいらない）
    await expect(player).not.toHaveAttribute("crossorigin", /.*/);
  });

  test("一覧から回を選ぶとプレイヤーと説明が差し替わる", async ({ page }) => {
    await page.goto("/");
    const base = await listBase(page);
    const player = page.locator("#video-stage video[data-video-player]");

    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await expect(player).toHaveAttribute("src", `${base}how-02.mp4`);
    await expectSitePoster(page, player, "how-02");
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第2回");
    await expect(page.locator('[data-video-field="title"]')).toHaveText("はじめてのネット払い");
    await expect(page.locator('[data-video-field="dur"]')).toHaveText("3:02");
    await expect(page.locator('.video-item[aria-current="true"]')).toHaveAttribute("data-video", "how-02");
    await expect(page).toHaveURL(/#video-how-02$/);

    await page.locator("[data-video-next]").click();
    await expect(player).toHaveAttribute("src", `${base}how-03.mp4`);
    await expectSitePoster(page, player, "how-03");

    // 最後の回では「次の回へ」を出さない
    await page.locator('#videos .video-item[data-video="how-08"]').click();
    await expect(page.locator("[data-video-next]")).toBeHidden();
  });

  test("各セクションの「動画で見る」から、その回を選べる", async ({ page }) => {
    await page.goto("/");
    const base = await listBase(page);
    await page.locator('#merchants [data-video-link="how-06"]').click();
    await expect(page.locator("#video-stage video[data-video-player]")).toHaveAttribute("src", `${base}how-06.mp4`);
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第6回");
  });

  test("#video-how-NN で開くと、その回が選ばれている（再生はしない）", async ({ page }) => {
    await page.goto("/#video-how-04");
    const base = await listBase(page);
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", `${base}how-04.mp4`);
    // ポスター画像はサイト側のまま
    await expect(page.locator("[data-video-poster] img")).toHaveAttribute("src", "assets/video/how-04.webp");
    await expect(page.locator("#videos video")).toHaveCount(0);
    await expect(page.locator('[data-video-field="title"]')).toHaveText("お店で QR で払う");
  });

  test("JS なしでも、一覧とポスターのリンクが R2 の mp4 を指す", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await routeOutside(context);
    const page = await context.newPage();
    await page.goto("/");
    const base = await listBase(page);
    await expect(page.locator('#videos .video-item[data-video="how-05"]')).toHaveAttribute(
      "href",
      `${base}how-05.mp4`
    );
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", `${base}how-01.mp4`);
    await context.close();
  });
});

// ─── 本番ヘッダ（CSP） ───────────────────────────────────────────────────────

// _headers は Cloudflare Pages が本番で付ける。ローカルの静的サーバーでは効かないので、ファイルを読んで確かめる
const cspDirective = (name) => {
  const line = readFileSync(join(process.cwd(), "_headers"), "utf8")
    .split("\n")
    .find((l) => /^\s*Content-Security-Policy:/.test(l));
  expect(line, "_headers に Content-Security-Policy の行がある").toBeTruthy();
  const policy = line.replace(/^\s*Content-Security-Policy:\s*/, "");
  const found = policy
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .filter((tokens) => tokens[0] === name);
  expect(found, `CSP の ${name} は 1 つだけ`).toHaveLength(1);
  return found[0].slice(1);
};

test.describe("本番ヘッダ（CSP）", () => {
  test("media-src に、サイト自身と mp4 の置き場（R2 の独自ドメイン）が入っている", () => {
    expect(cspDirective("media-src")).toEqual(["'self'", MEDIA_ORIGIN]);
    // default-src は広げない（mp4 のためだけに media-src を足す）
    expect(cspDirective("default-src")).toEqual(["'self'"]);
  });

  test("両方のページの mp4 のオリジンが、すべて media-src に含まれる", async ({ page }) => {
    const sources = cspDirective("media-src");
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      const origins = await page
        .locator('a[href*=".mp4"]')
        .evaluateAll((els) => [...new Set(els.map((el) => new URL(el.href).origin))]);
      expect(origins.length, `${path} に mp4 のリンクがある`).toBeGreaterThan(0);
      for (const origin of origins) {
        const allowed = sources.includes(origin) || (sources.includes("'self'") && origin === new URL(page.url()).origin);
        expect(allowed, `${path} の mp4 のオリジン ${origin} が media-src に無い`).toBe(true);
      }
    }
  });
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

test.describe("英語LP の動画とキャラクター", () => {
  test("第8回の英語字幕版が置かれ、名前は英語の表記で出る", async ({ page }) => {
    await page.goto("/en/");
    // 英語ページの mp4 は how-08en.mp4 の 1 本だけ。R2 の版付きパスを指す
    const href = await page.locator("#videos [data-video-poster]").getAttribute("href");
    expect(href).toMatch(MEDIA_BASE);
    expect(href.slice(mediaBaseOf(href).length)).toBe("how-08en.mp4");
    const mp4Links = await page.locator('a[href*=".mp4"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(mp4Links).toEqual([href]);
    await page.locator("#videos [data-video-poster]").click();
    const player = page.locator("#videos video[data-video-player]");
    await expect(player).toHaveAttribute("src", href);
    await expectSitePoster(page, player, "how-08en");
    const names = await page.locator(".talk-name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(["Suteburu-kun", "Suteburu-chan"]).toContain(n.trim());
    }
  });

  test("日本語ページと英語ページの mp4 は、R2 の同じ版を指す", async ({ page }) => {
    // 版は mp4 10 本（日本語 9 本と英語字幕版 1 本）の中身から 1 つ決まる。2 つのページで違えば、どちらかが古い
    await page.goto("/");
    const jaBase = await listBase(page);
    await page.goto("/en/");
    const enHref = await page.locator("#videos [data-video-poster]").getAttribute("href");
    expect(mediaBaseOf(enHref)).toBe(jaBase);
  });

  test("最後の回で「次の回へ」を押しても、フォーカスがプレイヤーに残る", async ({ page }) => {
    await page.goto("/#video-how-07");
    const next = page.locator("[data-video-next]");
    await expect(next).toBeVisible();
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#video-stage video[data-video-player]")).toHaveAttribute(
      "src",
      `${await listBase(page)}how-08.mp4`
    );
    await expect(next).toBeHidden();
    await expect(page.locator("#video-stage video[data-video-player]")).toBeFocused();
  });
});
