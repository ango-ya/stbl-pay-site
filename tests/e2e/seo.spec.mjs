// 検索エンジンと AI の検索・回答が読む部分（canonical・構造化データ・サイトマップ・robots・llms.txt）が崩れていないこと。
// 本番の応答（ヘッダー・404・クローラーごとの状態）は scripts/seo-live-check.sh で見る。
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const LPS = [
  { path: "/", url: "https://stbl-pay.com/", lang: "ja" },
  { path: "/en/", url: "https://stbl-pay.com/en/", lang: "en" },
];

for (const lp of LPS) {
  test(`LP（${lp.lang}）の canonical と構造化データ`, async ({ page }) => {
    await page.goto(lp.path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", lp.url);

    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())["@graph"];
    const byType = Object.fromEntries(graph.map((n) => [n["@type"], n]));
    for (const type of ["Organization", "WebSite", "WebPage", "Service", "FAQPage"]) {
      expect(byType[type], type).toBeTruthy();
    }
    expect(byType.WebPage.url).toBe(lp.url);
    expect(byType.WebPage.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 参照先の @id は同じグラフの中にある
    const ids = new Set(graph.map((n) => n["@id"]).filter(Boolean));
    expect(ids.has(byType.Service.provider["@id"])).toBe(true);
    expect(ids.has(byType.WebPage.about["@id"])).toBe(true);
    // FAQ の構造化データは、画面の FAQ と同じ数
    expect(byType.FAQPage.mainEntity.length).toBe(await page.locator("#faq details").count());
  });
}

test("sitemap.xml の URL は canonical と一致し、robots.txt から辿れる", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://stbl-pay.com/sitemap.xml");
  const locsOf = async (path) => {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const xml = await res.text();
    expect(xml, path).toContain("<urlset");
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  };
  expect(await locsOf("/sitemap.xml")).toEqual(LPS.map((lp) => lp.url));

  // docs は言語ごとに 1 本。URL は末尾にスラッシュ（配信先が付けて飛ばすので、飛ばした先を載せる）
  for (const [path, prefix] of [["/docs/sitemap.xml", "https://stbl-pay.com/docs/"], ["/docs/en/sitemap.xml", "https://stbl-pay.com/docs/en/"]]) {
    expect(robots).toContain(`Sitemap: https://stbl-pay.com${path}`);
    const locs = await locsOf(path);
    expect(locs.length, path).toBeGreaterThan(10);
    for (const loc of locs) {
      expect(loc.startsWith(prefix), loc).toBe(true);
      if (path === "/docs/sitemap.xml") expect(loc.startsWith("https://stbl-pay.com/docs/en/"), loc).toBe(false);
      expect(loc).toMatch(/\/$/);
    }
  }
});

test("デモ画面は noindex、404 ページがある", async ({ request }) => {
  const headers = readFileSync(new URL("../../_headers", import.meta.url), "utf8");
  for (const path of ["/demo", "/demo/*", "/pay", "/jpyc-ex"]) {
    expect(headers, path).toMatch(new RegExp(`^${path.replace("*", "\\*")}\\n  X-Robots-Tag: noindex$`, "m"));
  }
  const notFound = await (await request.get("/404.html")).text();
  expect(notFound).toContain('<meta name="robots" content="noindex" />');
});

test("llms.txt が docs の主なページと現在の状況を案内する", async ({ request }) => {
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toMatch(/提供状況: .*\d{4}年\d{1,2}月時点/);
  for (const [, href] of llms.matchAll(/\]\((\/docs\/[^)]*)\)/g)) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

test("docs のページは canonical と OGP 画像を持つ", async ({ page }) => {
  await page.goto("/docs/getting-started/quickstart/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://stbl-pay.com/docs/getting-started/quickstart/"
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-stblpay-generative-1200x630\.png/);
});
