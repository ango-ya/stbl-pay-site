// 検索エンジンと AI の検索・回答が読む部分（canonical・構造化データ・サイトマップ・robots・llms.txt）が崩れていないこと。
// 本番の応答（ヘッダー・404・クローラーごとの状態）は scripts/seo-live-check.sh で見る。
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const LPS = [
  { path: "/", url: "https://stbl-pay.com/", lang: "ja", og: "og-stblpay-generative-1200x630.png" },
  { path: "/en/", url: "https://stbl-pay.com/en/", lang: "en", og: "og-stblpay-generative-en-1200x630.png" },
];

for (const lp of LPS) {
  test(`LP（${lp.lang}）の canonical と構造化データ`, async ({ page }) => {
    await page.goto(lp.path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", lp.url);
    // OGP 画像は言語ごと（SNS 用のタグも構造化データも同じ画像）。画像そのものが配信されていること
    for (const sel of ['meta[property="og:image"]', 'meta[property="og:image:secure_url"]', 'meta[name="twitter:image"]']) {
      const og = await page.locator(sel).getAttribute("content");
      expect(og, sel).toContain(`/assets/${lp.og}`);
      expect((await page.request.get(new URL(og).pathname)).status(), sel).toBe(200);
    }

    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())["@graph"];
    const byType = Object.fromEntries(graph.map((n) => [n["@type"], n]));
    for (const type of ["Organization", "WebSite", "WebPage", "Service", "FAQPage"]) {
      expect(byType[type], type).toBeTruthy();
    }
    expect(byType.WebPage.url).toBe(lp.url);
    expect(byType.WebPage.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(byType.WebPage.primaryImageOfPage).toContain(`/assets/${lp.og}`);
    expect(byType.Service.image).toContain(`/assets/${lp.og}`);
    expect((await page.request.get(new URL(byType.Service.logo).pathname)).status()).toBe(200);
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
  // LP の日英と解説（/learn/ と /en/learn/）。解説の中身は learn.spec.mjs で見る
  const top = await locsOf("/sitemap.xml");
  expect(top.slice(0, 2)).toEqual(LPS.map((lp) => lp.url));
  for (const loc of top.slice(2)) expect(loc).toMatch(/^https:\/\/stbl-pay\.com\/(en\/)?learn\/([a-z-]+\/)?$/);

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

test("llms.txt が docs と解説の主なページと現在の状況を案内する", async ({ request }) => {
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toMatch(/提供状況: .*\d{4}年\d{1,2}月時点/);
  for (const [, href] of llms.matchAll(/\]\((\/(?:docs|learn|en\/learn)\/[^)]*)\)/g)) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

for (const [path, og] of [
  ["/docs/getting-started/quickstart/", /og-stblpay-generative-1200x630\.png/],
  ["/docs/en/getting-started/quickstart/", /og-stblpay-generative-en-1200x630\.png/],
]) {
  test(`docs のページは canonical と言語に合う OGP 画像を持つ（${path}）`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://stbl-pay.com${path}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", og);
  });
}

test("IndexNow の鍵ファイルが、スクリプトの鍵と同じ中身で配信される", async ({ request }) => {
  const key = readFileSync(new URL("../../scripts/indexnow.mjs", import.meta.url), "utf8").match(/const KEY = "([0-9a-f]+)"/)[1];
  const res = await request.get(`/${key}.txt`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe(key);
});

test("IndexNow は変わったページだけを送る（dist/ のサイトマップから）", () => {
  const run = (...args) =>
    execFileSync("node", ["scripts/indexnow.mjs", "--dry-run", ...args], { encoding: "utf8" }).trim().split("\n");
  expect(run("index.html", "README.md")).toEqual(["https://stbl-pay.com/"]);
  expect(run("en/index.html")).toEqual(["https://stbl-pay.com/en/"]);
  expect(run("README.md")).toEqual(["IndexNow: 送る URL なし"]);
  expect(run("learn/chargeback/index.html", "en/learn/stablecoin-payments-japan/index.html")).toEqual([
    "https://stbl-pay.com/learn/chargeback/",
    "https://stbl-pay.com/en/learn/stablecoin-payments-japan/",
  ]);
  const docs = run("docs-site/docs/intro.md");
  expect(docs.length).toBeGreaterThan(20);
  expect(docs.every((u) => u.startsWith("https://stbl-pay.com/docs/"))).toBe(true);
  const top = readFileSync(new URL("../../dist/sitemap.xml", import.meta.url), "utf8").match(/<loc>/g).length;
  expect(run("--all").length).toBe(docs.length + top);
});
