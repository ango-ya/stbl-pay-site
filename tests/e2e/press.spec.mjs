// プレスキット（/press/ と /en/press/）が、検索と AI に読まれる形を保ち、配る素材がそのまま使え、書いてはいけないことを書いていないこと。
// 本番ヘッダ（CSP）はローカルの静的サーバーが付けないので、_headers の値を付け直して見る（learn.spec.mjs と同じ）。
import { test, expect } from "@playwright/test";
import { BANNED, BANNED_EN, TEXTS, rateViolations, launchDateClaims, CSP } from "./text-rules.mjs";

const ORIGIN = "https://stbl-pay.com";
const PAGES = [
  { path: "/press/", lang: "ja", title: /プレスキット.*すてぶるペイ/ },
  { path: "/en/press/", lang: "en", title: /Press Kit.*STBLpay/ },
];
const ALTERNATES = [["ja", "/press/"], ["en", "/en/press/"], ["x-default", "/press/"]];
const TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".css": "text/css", ".zip": "application/zip" };
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

for (const { path, lang, title } of PAGES) {
  test(`${path}：head・構造化データ・本文の決まり・CSP・スマホ幅`, async ({ page, request }) => {
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
    await page.waitForLoadState("load");

    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page).toHaveTitle(title);
    expect((await page.locator('meta[name="description"]').getAttribute("content")).length).toBeGreaterThan(50);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}${path}`);
    await expect(page.locator("h1")).toHaveCount(1);

    // hreflang は日英と x-default の 3 本で、相手のページも同じ 3 本を持つ（相互参照）
    const alts = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((ls) => ls.map((l) => [l.hreflang, l.href]));
    expect(alts).toEqual(ALTERNATES.map(([l, p]) => [l, `${ORIGIN}${p}`]));

    // 構造化データ：解析でき、型がそろい、サービス（#service）の logo の PNG が配信されている
    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((t) => JSON.parse(t))
      .flatMap((d) => d["@graph"] ?? [d]);
    expect(nodes.map((n) => n["@type"]).sort()).toEqual(["AboutPage", "BreadcrumbList", "Service"]);
    const local = (u) => new URL(u).pathname;
    const org = nodes.find((n) => n["@type"] === "Service");
    const logos = [org.logo].flat();
    expect(logos.some((l) => l["@type"] === "ImageObject" && l.url.endsWith(".png")), "Service.logo に PNG").toBe(true);
    for (const l of logos) {
      expect(l.url.startsWith(`${ORIGIN}/assets/brand/`), l.url).toBe(true);
      expect((await request.get(local(l.url))).status(), l.url).toBe(200);
    }
    const about = nodes.find((n) => n["@type"] === "AboutPage");
    expect(about.url).toBe(`${ORIGIN}${path}`);
    expect(about.inLanguage).toBe(lang);
    for (const it of nodes.find((n) => n["@type"] === "BreadcrumbList").itemListElement) {
      expect((await request.get(local(it.item))).status(), it.item).toBe(200);
    }

    // 使わない語（表示の文字と、head を含む HTML ソースの両方）
    const bodyText = await page.evaluate(() => document.body.textContent);
    for (const text of [bodyText, source]) {
      for (const term of BANNED) expect(text, `「${term}」がある`).not.toContain(term);
      expect(text).not.toMatch(BANNED_EN);
    }
    // 自社の料率と提供開始日を書かない。プレスキットには他社の % も載せないので、許可リストは空
    const texts = await page.evaluate(TEXTS);
    expect(rateViolations(texts, []), "% を書いている").toEqual([]);
    expect(launchDateClaims(texts), "自社名と開始の語が同じ文にある（提供開始日は書かない）").toEqual([]);

    // ページ内の参照は、行き先がある
    const fragments = await page.locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href").slice(1)));
    for (const id of fragments) expect(await page.locator(`[id="${id}"]`).count(), `#${id}`).toBe(1);

    // 画像はすべて読み込めている（ロゴ・キャラクター・動画のサムネイル）
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.loading = "eager", i.decode().catch(() => {})))));
    expect(await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src))).toEqual([]);

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

test("ダウンロードの素材は、すべて正しい Content-Type で配信され、SVG は viewBox のある XML", async ({ page, request }) => {
  const hrefs = new Set();
  for (const { path } of PAGES) {
    await page.goto(path);
    for (const h of await page.locator("a[download]").evaluateAll((as) => as.map((a) => a.getAttribute("href")))) hrefs.add(h);
  }
  // ロゴは日英 × 黒白 × SVG・PNG の 8 本、加盟店向けはボタンの CSS とマーク（日英 × 2 色 × SVG・PNG）がそろう
  expect([...hrefs].filter((h) => h.startsWith("/assets/brand/")).sort()).toEqual(
    [
      ...["en", "ja"].flatMap((l) => ["black", "white"].flatMap((c) => ["png", "svg"].map((x) => `/assets/brand/stblpay-logo-${l}-${c}.${x}`))),
      ...["en", "ja"].flatMap((l) => ["blue", "blueline"].flatMap((c) => ["png", "svg"].map((x) => `/assets/brand/kit/stblpay-badge-${l}-${c}.${x}`))),
      "/assets/brand/kit/stblpay-button.css",
    ].sort()
  );
  await page.goto("about:blank"); // プレスキットの CSP（Trusted Types）の外で SVG を解析する
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()["content-type"], href).toContain(TYPES[href.slice(href.lastIndexOf("."))]);
    if (!href.endsWith(".svg")) continue;
    const svg = await res.text();
    // 素材を直接開くと本番の CSP がかかるので、インラインの style と script を持たない
    expect(svg, href).not.toMatch(/\sstyle\s*=|<style|<script|\son[a-z]+\s*=/i);
    const parsed = await page.evaluate((s) => {
      const doc = new DOMParser().parseFromString(s, "image/svg+xml");
      return { error: !!doc.querySelector("parsererror"), root: doc.documentElement.localName, viewBox: doc.documentElement.getAttribute("viewBox") };
    }, svg);
    expect(parsed, href).toEqual({ error: false, root: "svg", viewBox: expect.stringMatching(/^[\d.]+ [\d.]+ [\d.]+ [\d.]+$/) });
  }
});

test("プレスキットのサイト内リンクは、すべて 200 を返し、sitemap.xml に日英がある", async ({ request }) => {
  const hrefs = new Set();
  for (const { path } of PAGES) {
    const html = await (await request.get(path)).text();
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)/g)) hrefs.add(href);
  }
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const { path } of PAGES) expect(xml).toContain(`<loc>${ORIGIN}${path}</loc>`);
});
