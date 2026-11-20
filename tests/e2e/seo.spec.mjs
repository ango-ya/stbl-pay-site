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
  // LP の日英と解説（/learn/ と /en/learn/）とプレスキット（/press/ と /en/press/）と表現に関する方針（/policy/expression/）、プライバシーポリシーと開示等の請求の手続。中身は learn.spec.mjs と press.spec.mjs で見る
  const top = await locsOf("/sitemap.xml");
  expect(top.slice(0, 2)).toEqual(LPS.map((lp) => lp.url));
  expect(top).toEqual(expect.arrayContaining(["https://stbl-pay.com/privacy/", "https://stbl-pay.com/privacy/requests/", "https://stbl-pay.com/terms/", "https://stbl-pay.com/terms/users/", "https://stbl-pay.com/terms/merchants/", "https://stbl-pay.com/company/", "https://stbl-pay.com/fees/"]));
  for (const loc of top.slice(2)) expect(loc).toMatch(/^https:\/\/stbl-pay\.com\/((en\/)?(learn\/([a-z-]+\/)?|press\/|policy\/expression\/)|privacy\/(requests\/)?|terms\/((users|merchants)\/)?|company\/|fees\/)$/);
  for (const loc of top) expect((await request.get(new URL(loc).pathname)).status(), loc).toBe(200);
  // lastmod は、そのページの JSON-LD の dateModified と同じ（dateModified の無いページは見ない）
  const xml = await (await request.get("/sitemap.xml")).text();
  const dated = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
  expect(dated.map((m) => m[1]), "どの URL にも lastmod がある").toEqual(top);
  for (const [, loc, lastmod] of dated) {
    const html = await (await request.get(new URL(loc).pathname)).text();
    const mods = [...html.matchAll(/"dateModified":\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const d of new Set(mods)) expect(d, `${loc} の lastmod と dateModified`).toBe(lastmod);
  }

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

test("LP のフッターからプライバシーポリシーへ、その第11条から開示等の請求のページへ辿れ、どちらも canonical を持つ", async ({ page }) => {
  await page.goto("/");
  await page.locator(".site-footer").getByRole("link", { name: "プライバシーポリシー" }).click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://stbl-pay.com/privacy/");
  await expect(page.locator("h1")).toHaveText("プライバシーポリシー");
  await page.locator("#art-11 + p").getByRole("link", { name: "当社ウェブサイト上に掲載するところ" }).click();
  await expect(page).toHaveURL(/\/privacy\/requests\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://stbl-pay.com/privacy/requests/");
  await expect(page.locator("h1")).toHaveText("個人情報の開示等のご請求");
  await expect(page.locator('main a[href^="mailto:support.stbl-pay@ango-ya.org"]').first()).toBeVisible();
});

test("LP のフッターから利用規約の入口へ、そこから 2 つの規約へ辿れ、運営会社のページに規約第43条第2項の表示事項がある", async ({ page }) => {
  await page.goto("/");
  await page.locator(".site-footer").getByRole("link", { name: "利用規約" }).click();
  await expect(page).toHaveURL(/\/terms\/$/);
  for (const [name, path] of [["個人ユーザー向け利用規約", "/terms/users/"], ["加盟店向け利用規約", "/terms/merchants/"]]) {
    await page.goto("/terms/");
    await page.locator("main").getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://stbl-pay.com${path}`);
    await expect(page.locator("h1")).toHaveText(name);
  }
  await page.locator(".site-footer").getByRole("link", { name: "合同会社暗号屋" }).click();
  await expect(page).toHaveURL(/\/company\/$/);
  for (const term of ["名称", "所在地", "代表者", "お問い合わせの窓口", "受付時間"]) await expect(page.locator("main dt", { hasText: term })).toHaveCount(1);
  await expect(page.locator("main dt", { hasText: "所在地" }).locator("+ dd")).toHaveText("〒810-0041 福岡県福岡市中央区大名1-3-41 プリオ大名ビル2F");
  await expect(page.locator('main dd a[href="mailto:support.stbl-pay@ango-ya.org"]')).toHaveCount(1);
});

test("/fees/ は canonical・h1・3 つの節・出典 4 件を持ち、利用規約の入口と解説の一覧からリンクされている", async ({ page }) => {
  await page.goto("/fees/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://stbl-pay.com/fees/");
  await expect(page.locator("h1")).toHaveText("すてぶるペイの手数料");
  const guide = page.locator("a.fees-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toHaveAttribute("href", "/learn/payment-fees/");
  await expect(guide.locator("img")).toHaveAttribute("src", "/assets/learn/payment-fees/thumb.webp");
  for (const [id, heading] of [["rate", "決済手数料"], ["gas", "ガス代の負担の条件と上限"], ["why", "5%の考え方"]]) {
    await expect(page.locator(`h2[id="${id}"]`), id).toHaveText(heading);
  }
  // 自社の料率を書く場所（料率の欄と description）の % は 5% だけ。他社の料率は「5%の考え方」の節にだけ出典つきで書く
  const pcts = (t) => [...t.matchAll(/[0-9０-９][0-9０-９.]*\s*[%％]/g)].map((m) => m[0]);
  for (const own of [pcts(await page.locator("h2#rate + dl").textContent()), pcts(await page.locator('meta[name="description"]').getAttribute("content"))]) {
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((p) => p === "5%"), `自社の料率に 5% 以外がある: ${own}`).toBe(true);
  }
  const sources = page.locator("li[id^='src-'] a[href^='https://']");
  await expect(sources).toHaveCount(4);
  for (const href of await sources.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/^https:\/\/[^/]+\//);
  for (const path of ["/terms/", "/learn/"]) {
    await page.goto(path);
    await expect(page.locator('a[href="/fees/"]').first(), `${path} から /fees/ へのリンク`).toBeVisible();
  }
  // LP の「まるごと解説」は、動画の比較の数字の時点と Square の改定を、選んだときの説明と一覧の下の注記で示し、/fees/ へつなぐ
  await page.goto("/");
  await expect(page.locator('#videos [data-video="how-sp"]')).toHaveAttribute("data-desc", /2026年9月時点.*2026年12月17日から1\.95%/);
  await expect(page.locator('#videos .video-foot a[href="/fees/"]')).toBeVisible();
});

test("開示等の請求のページからポリシーの条へのリンクは実在の見出しを指し、法務のページはどれもスマートフォンの幅で横にはみ出さない", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.goto("/privacy/requests/");
  expect(await fits(), "/privacy/requests/ の横幅").toBe(true);
  const ids = await page.locator('main a[href^="/privacy/#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href").split("#")[1]));
  expect(ids).toEqual(expect.arrayContaining(["art-11", "art-3-2", "art-16"]));
  await page.goto("/privacy/");
  expect(await fits(), "/privacy/ の横幅（特則第2条の表と長い URL）").toBe(true);
  for (const id of ids) await expect(page.locator(`[id="${id}"]`), id).toHaveCount(1);
  for (const path of ["/terms/", "/terms/users/", "/terms/merchants/", "/company/", "/fees/"]) {
    await page.goto(path);
    expect(await fits(), `${path} の横幅`).toBe(true);
  }
});

// Cloudflare のメール難読化は、ページの CSP（Trusted Types）で復号の script が動かず「[email protected]」と出る。メールは email_off で囲む
test("ページのメールアドレスは email_off で囲み、Cloudflare に書き換えさせない", () => {
  const files = execFileSync("git", ["ls-files", "*.html"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !/^(docs-site|marketing|tests)\//.test(f));
  expect(files).toContain("privacy/requests/index.html");
  for (const f of files) {
    const rest = readFileSync(f, "utf8")
      .replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, "")
      .replace(/\splaceholder="[^"]*"/g, "");
    expect(rest.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g), f).toBeNull();
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

test("llms.txt が docs と解説とプレスキットの主なページと現在の状況を案内する", async ({ request }) => {
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toMatch(/提供状況: .*\d{4}年\d{1,2}月時点/);
  // リンクは絶対 URL（https://stbl-pay.com/…）で書く。相対で書いたものも拾う
  const hrefs = [...llms.matchAll(/\]\((?:https:\/\/stbl-pay\.com)?(\/(?:docs|learn|en\/learn|press|en\/press|policy)\/[^)]*)\)/g)].map((m) => m[1]);
  expect(hrefs.length, "llms.txt から拾えたリンクの数").toBeGreaterThan(30);
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

for (const [path, og] of [
  ["/docs/getting-started/quickstart/", /og-stblpay-docs-1200x630\.png/],
  ["/docs/en/getting-started/quickstart/", /og-stblpay-docs-en-1200x630\.png/],
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
  expect(run("privacy/index.html", "privacy/requests/index.html", "terms/users/index.html", "company/index.html", "fees/index.html")).toEqual(["https://stbl-pay.com/privacy/", "https://stbl-pay.com/privacy/requests/", "https://stbl-pay.com/terms/users/", "https://stbl-pay.com/company/", "https://stbl-pay.com/fees/"]);
  expect(run("README.md")).toEqual(["IndexNow: 送る URL なし"]);
  expect(run("learn/chargeback/index.html", "en/learn/stablecoin-payments-japan/index.html")).toEqual([
    "https://stbl-pay.com/learn/chargeback/",
    "https://stbl-pay.com/en/learn/stablecoin-payments-japan/",
  ]);
  expect(run("policy/expression/index.html")).toEqual(["https://stbl-pay.com/policy/expression/"]);
  expect(run("press/index.html", "en/press/index.html", "assets/press.css")).toEqual([
    "https://stbl-pay.com/press/",
    "https://stbl-pay.com/en/press/",
  ]);
  const docs = run("docs-site/docs/intro.md");
  expect(docs.length).toBeGreaterThan(20);
  expect(docs.every((u) => u.startsWith("https://stbl-pay.com/docs/"))).toBe(true);
  const top = readFileSync(new URL("../../dist/sitemap.xml", import.meta.url), "utf8").match(/<loc>/g).length;
  expect(run("--all").length).toBe(docs.length + top);
});
