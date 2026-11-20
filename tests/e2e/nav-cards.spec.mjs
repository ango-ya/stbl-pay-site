// ヘッダーのモバイルのメニュー、記事のカード（LP の「決済を学ぶ」・記事の「関連する解説」）、末尾の箱のカード、運営会社のリンクのカード。
// 形は assets/lp.css の「モバイルのメニュー」「リンクのカード」「解説のカード」。
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../../", import.meta.url);
const read = (file) => readFileSync(new URL(file, ROOT), "utf8");
const PAGES = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n");
const MOBILE = { width: 390, height: 800 };
const loaded = (img) => img.evaluate((i) => i.complete && i.naturalWidth > 0);

test("ヘッダーのナビがあるページは、モバイルのメニューに同じリンクを同じ並びで持つ", () => {
  const links = (html, cls) => {
    const nav = html.match(new RegExp(`<nav class="${cls}"[^>]*>([\\s\\S]*?)</nav>`));
    return nav && [...nav[1].matchAll(/<a [^>]*>.*?<\/a>/g)].map((a) => a[0]);
  };
  const withNav = PAGES.filter((file) => read(file).includes('class="site-nav"'));
  expect(withNav.length).toBeGreaterThan(20);
  for (const file of withNav) expect(links(read(file), "nav-menu-panel"), file).toEqual(links(read(file), "site-nav"));
});

for (const [path, learn] of [["/", "/learn/"], ["/en/", "/en/learn/"]]) {
  test(`${path}：スマートフォンの幅ではメニューから解説へ行け、ページ内リンク・Esc・外側のクリックで閉じる`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(".nav-menu"), "広い幅ではメニューのボタンを出さない").toBeHidden();
    await expect(page.locator(".site-nav")).toBeVisible();

    await page.setViewportSize(MOBILE);
    const menu = page.locator(".nav-menu");
    const toLearn = menu.locator(`a[href="${learn}"]`);
    const isOpen = () => menu.evaluate((d) => d.open);
    await expect(page.locator(".site-nav")).toBeHidden();
    await expect(toLearn).toBeHidden();
    await menu.locator("summary").click();
    await expect(toLearn).toBeVisible();
    await expect(page.locator(".header-cta"), "相談のボタンは開いても残る").toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "横にはみ出さない").toBe(true);

    await menu.locator('a[href="#faq"]').click();
    expect(await isOpen(), "ページ内リンクで飛んだら閉じる").toBe(false);
    await expect(page.locator("#faq")).toBeInViewport();

    await menu.locator("summary").click();
    await page.keyboard.press("Escape");
    expect(await isOpen(), "Esc で閉じる").toBe(false);
    await menu.locator("summary").click();
    await page.mouse.click(4, 700); // メニューより下の、左の余白
    expect(await isOpen(), "外側を押すと閉じる").toBe(false);
  });

  test(`${path}：「決済を学ぶ」は相談の欄のあとにあり、サムネイルつきのカード 4 枚と一覧への導線を持つ`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(path);
    expect(await page.evaluate(() => !!(document.querySelector("#early-access").compareDocumentPosition(document.querySelector("#learn")) & Node.DOCUMENT_POSITION_FOLLOWING)), "相談の欄より後ろ").toBe(true);
    const cards = page.locator("#learn .learn-cards a");
    await expect(cards).toHaveCount(4);
    for (const a of await cards.all()) {
      const href = await a.getAttribute("href");
      expect(href.startsWith(learn), href).toBe(true);
      await expect(a.locator("h3")).not.toBeEmpty();
      const img = a.locator("img.learn-card-thumb");
      await expect(img).toHaveAttribute("src", new RegExp(`assets/learn/${href.split("/").filter(Boolean).pop()}/thumb(-en)?\\.webp$`));
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => loaded(img)).toBe(true);
    }
    // スマートフォンの幅でも 2 列（1 列で縦に長くしない）
    const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    await expect(page.locator(`#learn .learn-more a[href="${learn}"]`)).toBeVisible();
  });
}

test("記事の「関連する解説」は、どのカードもリンク先の記事のサムネイルを持つ", async ({ page }) => {
  const articles = PAGES.filter((file) => read(file).includes('class="learn-related"'));
  expect(articles.length).toBeGreaterThan(20);
  for (const file of articles) {
    const related = read(file).match(/<section class="learn-related"[\s\S]*?<\/section>/)[0];
    const cards = [...related.matchAll(/<li><a href="\/((?:en\/)?)learn\/([a-z-]+)\/"[^>]*><img class="learn-card-thumb" src="([^"]+)"[^>]*alt="" [^>]*><h3>.+?<\/h3><\/a><\/li>/g)];
    expect(cards.length, file).toBe((related.match(/<li>/g) || []).length);
    expect(cards.length, file).toBeGreaterThan(0);
    for (const [, en, slug, src] of cards) {
      expect(src, file).toBe(`/assets/learn/${slug}/thumb${en ? "-en" : ""}.webp`);
      expect(existsSync(new URL(src.slice(1), ROOT)), src).toBe(true);
    }
  }
  await page.setViewportSize(MOBILE);
  await page.goto("/learn/chargeback/");
  const imgs = page.locator(".learn-related .learn-cards img.learn-card-thumb");
  await imgs.first().scrollIntoViewIfNeeded();
  for (const img of await imgs.all()) await expect.poll(() => loaded(img)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("末尾の箱（すてぶるペイについて・取材）のリンクは、どれもカードで、相談だけを主な行き先として示す", async ({ page }) => {
  // 一覧（/learn/・/en/learn/）の箱は、行き先ごとに絵があるので絵つきのカード（learn.spec.mjs が見る）。ここでは外す
  const boxes = PAGES.filter((file) => read(file).includes('class="learn-about"') && !/^(en\/)?learn\/index\.html$/.test(file));
  expect(boxes.length).toBeGreaterThan(20);
  for (const file of boxes) {
    const box = read(file).match(/<aside class="learn-about"[\s\S]*?<\/aside>/)[0];
    // 箱の最後はカードの一覧（文字だけのリンクの行を残さない）
    const list = box.match(/<ul class="about-cards">([\s\S]*?)<\/ul>\s*<\/aside>$/);
    expect(list, file).toBeTruthy();
    const cards = [...list[1].matchAll(/<li><a class="(about-card(?: is-primary)?)" href="([^"]+)"[^>]*><span class="about-card-title">[^<]+<\/span>/g)];
    expect(cards.length, file).toBeGreaterThan(0);
    expect(cards.length, file).toBe((list[1].match(/<li>/g) || []).length);
    for (const [, cls, href] of cards) expect(cls === "about-card is-primary", `${file} ${href}`).toBe(href.endsWith("#early-access"));
    // 記事では、箱を「関連する解説」より先に見せる（相談・LP への出口を、ほかの記事への出口より上に）。記事は、相談のカードを先頭に置く
    if (!read(file).includes('class="learn-related"')) continue;
    expect(read(file).indexOf('class="learn-about"'), file).toBeLessThan(read(file).indexOf('class="learn-related"'));
    expect(cards[0][2], file).toBe(file.startsWith("en/") ? "/en/#early-access" : "/#early-access");
  }
  // スマートフォンでは縦に積み、どのカードも指で押せる高さ。相談は白い字に青い地
  await page.setViewportSize(MOBILE);
  await page.goto("/learn/chargeback/");
  const cards = page.locator(".learn-about .about-card");
  await expect(cards).toHaveCount(3);
  const rects = await Promise.all((await cards.all()).map((card) => card.boundingBox()));
  for (const rect of rects) expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(rects[1].y).toBeGreaterThanOrEqual(rects[0].y + rects[0].height);
  expect(await cards.first().evaluate((a) => [getComputedStyle(a).color, getComputedStyle(a).backgroundColor])).toEqual(["rgb(255, 255, 255)", "rgb(39, 117, 202)"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

for (const [path, href, name, label] of [
  ["/", "https://www.ango-ya.org/", "合同会社暗号屋", "www.ango-ya.org"],
  ["/en/", "https://www.ango-ya.org/en/", "Ango-ya LLC", "www.ango-ya.org/en/"],
  ["/company/", "https://www.ango-ya.org/", "合同会社暗号屋", "www.ango-ya.org"],
]) {
  test(`${path}：運営会社のサイトを、OGP の絵つきのカードで示す（絵は欠けない）`, async ({ page }) => {
    await page.goto(path);
    const card = page.locator("a.link-card.is-compact");
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("href", href);
    await expect(card.locator(".link-card-title")).toHaveText(name);
    await expect(card.locator(".link-card-cta")).toHaveText(label);
    const img = card.locator("img");
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => loaded(img)).toBe(true);
    // 絵は 1200×630 のまま見せる（上下いっぱいに敷いても、切れるのはわずか）
    for (const viewport of [{ width: 1280, height: 720 }, MOBILE]) {
      await page.setViewportSize(viewport);
      const box = await img.boundingBox();
      expect(box.width / box.height, `${viewport.width}px`).toBeGreaterThan((1200 / 630) * 0.93);
    }
  });
}
