// 解説ページ（/learn/ と /en/learn/）が、検索と AI に読まれる形を保ち、書いてはいけないことを書いていないこと。
// 書くときの決まりは marketing/seo-strategy.md。本番ヘッダ（CSP）はローカルの静的サーバーが付けないので、_headers の値を付け直して見る。
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

const ORIGIN = "https://stbl-pay.com";
const PAGES = [
  { path: "/learn/", main: "CollectionPage" },
  { path: "/learn/stablecoin-payments/", main: "Article" },
  { path: "/learn/jpyc-payments/", main: "Article" },
  { path: "/learn/card-merchant-screening/", main: "Article" },
  { path: "/learn/payment-fees/", main: "Article" },
  { path: "/learn/chargeback/", main: "Article" },
  { path: "/learn/glossary/", main: "DefinedTermSet" },
  { path: "/en/learn/stablecoin-payments-japan/", main: "Article" },
];

// LP と同じ使わない語に、解説で断定を避ける語を足す。英語は大文字小文字を問わない
const BANNED = [
  "先行導入", "2026年8月", "2026.08", "SDK", "経由せず", "経由しない", "銀行振込するだけ", "同額を銀行振込",
  "JPYC建て", "誰でも受け取れる", "導入費用0円", "安全", "元本保証", "必ず", "誰でも",
];
const BANNED_EN = /\bSDK\b|early access|top[ -]?up|recharge|just make a bank transfer/i;

// 全ページ共通の CSP（_headers の最初の Content-Security-Policy の行。/* に掛かる）
const CSP = readFileSync(new URL("../../_headers", import.meta.url), "utf8")
  .split("\n")
  .find((l) => /^\s*Content-Security-Policy:/.test(l))
  .replace(/^\s*Content-Security-Policy:\s*/, "")
  .trim();
const ANALYTICS = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;

test.beforeEach(async ({ context }) => {
  await context.route(ANALYTICS, (route) => route.abort());
  await context.route(
    (url) => url.hostname === "127.0.0.1" && PAGES.some((p) => p.path === url.pathname),
    async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const headers = { ...response.headers(), "content-security-policy": CSP };
      delete headers["content-length"];
      delete headers["content-encoding"];
      return route.fulfill({ response, body: await response.text(), headers });
    }
  );
});

for (const { path, main } of PAGES) {
  test(`${path}：検索向けの head・構造化データ・本文の決まり・CSP・スマホ幅`, async ({ page }) => {
    const csp = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Trusted Type/i.test(m.text())) csp.push(m.text());
    });
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-security-policy"]).toContain("require-trusted-types-for 'script'");
    const source = await response.text();

    await expect(page).toHaveTitle(/すてぶるペイ|STBLpay/);
    expect((await page.locator('meta[name="description"]').getAttribute("content")).length).toBeGreaterThan(50);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}${path}`);
    await expect(page.locator("h1")).toHaveCount(1);

    // 構造化データ：解析でき、期待する型がある。FAQ があれば、FAQPage の質問は本文の質問と同じ
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((t) => JSON.parse(t))
      .flatMap((d) => d["@graph"] ?? [d]);
    const types = nodes.map((n) => n["@type"]);
    expect(types).toContain(main);
    expect(types).toContain("BreadcrumbList");
    const questions = (await page.locator(".faq-list details summary").allTextContents()).map((s) => s.trim());
    const faq = nodes.find((n) => n["@type"] === "FAQPage");
    if (questions.length) expect(faq.mainEntity.map((q) => q.name)).toEqual(questions);
    else expect(faq).toBeUndefined();

    // 使わない語（表示の文字と、head を含む HTML ソースの両方）
    const bodyText = await page.evaluate(() => document.body.textContent);
    for (const text of [bodyText, source]) {
      for (const term of BANNED) expect(text, `「${term}」がある`).not.toContain(term);
      expect(text).not.toMatch(BANNED_EN);
    }
    // 自社の料率を書かない：すてぶるペイ / STBLpay と「数字 %」が同じ文に無い
    const sentences = source.replace(/<[^>]+>/g, " ").split(/[。\n]|\.\s/);
    const ownRate = sentences.filter((s) => /すてぶるペイ|STBLpay/.test(s) && /\d\s*[%％]/.test(s));
    expect(ownRate).toEqual([]);

    // ページ内の参照（出典の [n] など）は、行き先がある
    const fragments = await page.locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href").slice(1)));
    for (const id of fragments) expect(await page.locator(`[id="${id}"]`).count(), `#${id}`).toBe(1);

    // スマホ幅で横スクロールしない
    const { scrollWidth, clientWidth } = await page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return { scrollWidth, clientWidth };
    });
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    expect(await page.evaluate(() => window.__csp)).toEqual([]);
    expect(csp).toEqual([]);
  });
}

test("解説ページの内部リンクは、すべて 200 を返す", async ({ request }) => {
  const hrefs = new Set();
  for (const { path } of PAGES) {
    const html = await (await request.get(path)).text();
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)/g)) hrefs.add(href);
  }
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test("解説ページはすべて sitemap.xml にあり、marketing/ は配信しない", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const { path } of PAGES) expect(xml).toContain(`<loc>${ORIGIN}${path}</loc>`);
  expect(existsSync(new URL("../../dist/marketing", import.meta.url))).toBe(false);
  expect((await request.get("/marketing/seo-strategy.md")).status()).toBe(404);
});
