import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ─── つかいかた動画 ──────────────────────────────────────────────────────────

const EPISODES = ["how-00", "how-01", "how-02", "how-03", "how-04", "how-05", "how-06", "how-07", "how-08"];

test.describe("つかいかた動画（日本語LP）", () => {
  test("一覧に予告と第1〜8回が並び、mp4・ポスター・サムネイルが配信される", async ({ page, request }) => {
    await page.goto("/");
    const items = page.locator("#videos .video-item[data-video]");
    await expect(items).toHaveCount(EPISODES.length);
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute("data-video")))).toEqual(EPISODES);

    // mp4 は git に入れない（scripts/encode-videos.sh で作る）。手元にあるときだけ確かめる
    const hasMp4 = existsSync(join(process.cwd(), "assets", "video", "how-01.mp4"));
    for (const id of EPISODES) {
      if (hasMp4) {
        const mp4 = await request.head(`/assets/video/${id}.mp4`);
        expect(mp4.status(), `${id}.mp4`).toBe(200);
      }
      for (const img of [`${id}.webp`, `${id}-640.webp`, `${id}-thumb.webp`]) {
        const res = await request.head(`/assets/video/${img}`);
        expect(res.status(), img).toBe(200);
      }
    }
    // 番外編（手数料の数字などを含む営業向け）は LP に出さない
    await expect(page.locator('#videos [href*="how-sp"], #videos [href*="how-pk"]')).toHaveCount(0);
  });

  test("Cloudflare Pages の 1 ファイル 25MiB 上限に収まっている", () => {
    const dir = join(process.cwd(), "assets", "video");
    for (const name of readdirSync(dir)) {
      const size = statSync(join(dir, name)).size;
      expect(size, name).toBeLessThan(25 * 1024 * 1024);
    }
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
    await expect(poster).toHaveAttribute("href", "assets/video/how-01.mp4");
    await expect(poster.locator("img")).toHaveAttribute("loading", "lazy");
    expect(mp4).toEqual([]);
  });

  test("ポスターを押すと、その場で video を作って再生する", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-video-poster]").click();
    const player = page.locator("#video-stage video[data-video-player]");
    await expect(player).toHaveAttribute("src", "assets/video/how-01.mp4");
    await expect(player).toHaveAttribute("poster", "assets/video/how-01.webp");
    await expect(page.locator("[data-video-poster]")).toHaveCount(0);
  });

  test("一覧から回を選ぶとプレイヤーと説明が差し替わる", async ({ page }) => {
    await page.goto("/");
    const player = page.locator("#video-stage video[data-video-player]");

    await page.locator('#videos .video-item[data-video="how-02"]').click();
    await expect(player).toHaveAttribute("src", "assets/video/how-02.mp4");
    await expect(player).toHaveAttribute("poster", "assets/video/how-02.webp");
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第2回");
    await expect(page.locator('[data-video-field="title"]')).toHaveText("はじめてのネット払い");
    await expect(page.locator('[data-video-field="dur"]')).toHaveText("3:02");
    await expect(page.locator('.video-item[aria-current="true"]')).toHaveAttribute("data-video", "how-02");
    await expect(page).toHaveURL(/#video-how-02$/);

    await page.locator("[data-video-next]").click();
    await expect(player).toHaveAttribute("src", "assets/video/how-03.mp4");

    // 最後の回では「次の回へ」を出さない
    await page.locator('#videos .video-item[data-video="how-08"]').click();
    await expect(page.locator("[data-video-next]")).toBeHidden();
  });

  test("各セクションの「動画で見る」から、その回を選べる", async ({ page }) => {
    await page.goto("/");
    await page.locator('#merchants [data-video-link="how-06"]').click();
    await expect(page.locator("#video-stage video[data-video-player]")).toHaveAttribute("src", "assets/video/how-06.mp4");
    await expect(page.locator('[data-video-field="no"]')).toHaveText("第6回");
  });

  test("#video-how-NN で開くと、その回が選ばれている（再生はしない）", async ({ page }) => {
    await page.goto("/#video-how-04");
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", "assets/video/how-04.mp4");
    await expect(page.locator("[data-video-poster] img")).toHaveAttribute("src", "assets/video/how-04.webp");
    await expect(page.locator("#videos video")).toHaveCount(0);
    await expect(page.locator('[data-video-field="title"]')).toHaveText("お店で QR で払う");
  });

  test("JS なしでも一覧のリンクから mp4 を開ける", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator('#videos .video-item[data-video="how-05"]')).toHaveAttribute(
      "href",
      "assets/video/how-05.mp4"
    );
    await expect(page.locator("[data-video-poster]")).toHaveAttribute("href", "assets/video/how-01.mp4");
    await context.close();
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
    await expect(page.locator("#videos [data-video-poster]")).toHaveAttribute(
      "href",
      "/assets/video/how-08en.mp4"
    );
    await page.locator("#videos [data-video-poster]").click();
    await expect(page.locator("#videos video[data-video-player]")).toHaveAttribute(
      "src",
      "/assets/video/how-08en.mp4"
    );
    const names = await page.locator(".talk-name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(["Suteburu-kun", "Suteburu-chan"]).toContain(n.trim());
    }
  });

  test("最後の回で「次の回へ」を押しても、フォーカスがプレイヤーに残る", async ({ page }) => {
    await page.goto("/#video-how-07");
    const next = page.locator("[data-video-next]");
    await expect(next).toBeVisible();
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#video-stage video[data-video-player]")).toHaveAttribute("src", "assets/video/how-08.mp4");
    await expect(next).toBeHidden();
    await expect(page.locator("#video-stage video[data-video-player]")).toBeFocused();
  });
});
