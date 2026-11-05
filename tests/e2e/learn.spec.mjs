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


// --- 本文の決まりの検査（HTML 文字列を受ける純関数。下のユニット test で、わざと違反を入れて確かめる） ---
const OWN = /すてぶるペイ|STBLpay|当社/;
const PCT = /\d\s*[%％]/;
const textOf = (h) => h.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// shortcut: 出典 [n] 付きの文は他社・外部の事実として除く。自社名を含む文は除かない。偽の [n] を付けた違反は見逃す
const hasOwnPct = (text) => {
  const kept = text.split(/(?<=。|\.\s)/).filter((sent) => OWN.test(sent) || !/\[\d+\]/.test(sent)).join("");
  return OWN.test(kept) && PCT.test(kept);
};
// 段落・箇条・details、表（自社名が出る表は全体）の単位で、自社名と数字の % が同居する要素を返す
function ownRateViolations(html) {
  const h = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ");
  const units = [...h.matchAll(/<(p|li|ul|ol|details|table)\b[\s\S]*?<\/\1>/g)].map((m) => textOf(m[0]));
  return units.filter(hasOwnPct);
}
const MONTH = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";
const DATE_JA = "(?:\\d{4}\\s*年|\\d{1,2}\\s*月)";
const LAUNCH = [
  new RegExp(`(?:提供開始|サービス開始|ローンチ|リリース)(?:予定)?(?:日|時期)?\\s*(?:は|：|:)?\\s*${DATE_JA}`),
  new RegExp(`${DATE_JA}[\\d年月日\\s]*(?:から|に|より)?\\s*(?:提供(?!開始日)|サービス開始|リリース|ローンチ|開始予定|公開予定)`),
  new RegExp(`\\b(?:launch(?:es|ed|ing)?|go(?:es)? live|available|releas(?:e|es|ed))\\s+(?:on|in|from)\\s+(?:${MONTH}|\\d{4})`, "i"),
];
const launchDateClaims = (html) => LAUNCH.map((re) => textOf(html).match(re)?.[0]).filter(Boolean);

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
  test(`${path}：検索向けの head・構造化データ・本文の決まり・CSP・スマホ幅`, async ({ page, request }) => {
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
    const isEn = path.startsWith("/en/");
    const ogImage = `${ORIGIN}/assets/og-stblpay-generative${isEn ? "-en" : ""}-1200x630.png`;
    const local = (u) => { const x = new URL(u); return x.pathname + x.search; };
    const sameImage = (u) => u.split("?")[0] === ogImage;
    for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(sameImage(await page.locator(sel).getAttribute("content")), `${sel} は言語に合う画像`).toBe(true);
    }
    for (const n of nodes.filter((n) => n["@type"] === "BreadcrumbList")) {
      for (const it of n.itemListElement) expect((await request.get(local(it.item))).status(), it.item).toBe(200);
    }
    if (main === "Article") {
      const a = nodes.find((n) => n["@type"] === "Article");
      for (const k of ["headline", "description", "datePublished", "dateModified", "author", "publisher", "mainEntityOfPage", "image", "inLanguage"]) {
        expect(a[k], `Article.${k}`).toBeTruthy();
      }
      const img = typeof a.image === "string" ? a.image : a.image.url ?? a.image[0];
      expect(sameImage(img), "Article.image は言語に合う画像").toBe(true);
      expect((await request.get(local(img))).status()).toBe(200);
      expect(a.inLanguage).toBe(isEn ? "en" : "ja");
    }
    if (main === "DefinedTermSet") {
      expect(nodes.find((n) => n["@type"] === "DefinedTermSet").inLanguage).toBeTruthy();
      for (const t of nodes.filter((n) => n["@type"] === "DefinedTerm")) expect(t, "DefinedTerm は inLanguage を持たない").not.toHaveProperty("inLanguage");
    }

    // FAQ：質問と、答えの本文（空白を正規化）が表示と一致する
    const norm = (t) => t.replace(/\s+/g, " ").trim();
    const shown = await page.locator(".faq-list details").evaluateAll((ds) =>
      ds.map((d) => ({ q: d.querySelector("summary").textContent, a: [...d.children].filter((c) => c.tagName !== "SUMMARY").map((c) => c.textContent).join(" ") }))
    );
    const faq = nodes.find((n) => n["@type"] === "FAQPage");
    if (shown.length) {
      expect(faq.mainEntity.map((q) => q.name)).toEqual(shown.map((d) => norm(d.q)));
      expect(faq.mainEntity.map((q) => norm(q.acceptedAnswer.text))).toEqual(shown.map((d) => norm(d.a)));
    } else expect(faq).toBeUndefined();

    // 使わない語（表示の文字と、head を含む HTML ソースの両方）
    const bodyText = await page.evaluate(() => document.body.textContent);
    for (const text of [bodyText, source]) {
      for (const term of BANNED) expect(text, `「${term}」がある`).not.toContain(term);
      expect(text).not.toMatch(BANNED_EN);
    }
    // 自社の料率と提供開始日を書かない（段落・表・details の単位。検査の中身は上の関数）
    expect(ownRateViolations(source), "自社の料率").toEqual([]);
    expect(launchDateClaims(source), "提供開始日の断定").toEqual([]);

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

test("hreflang は相互に参照し合い、対は日英のステーブルコイン決済の解説だけ", async ({ request }) => {
  const PAIR = ["/learn/stablecoin-payments/", "/en/learn/stablecoin-payments-japan/"];
  const alts = async (path) => {
    const html = await (await request.get(path)).text();
    return [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(([, l, h]) => [l, h.replace(ORIGIN, "")]);
  };
  for (const { path } of PAGES) {
    const list = await alts(path);
    const hasEn = list.some(([l]) => l === "en");
    expect(hasEn, `${path} の en hreflang`).toBe(PAIR.includes(path));
    for (const [, href] of list) {
      if (href === path) continue;
      expect((await alts(href)).map(([, h]) => h), `${href} は ${path} を指す`).toContain(path);
    }
  }
});

test("検査関数：違反の断片を見つけ、正当な断片は通す", () => {
  const bad = [
    "<p>すてぶるペイの手数料は 1.5% です。</p>",
    "<p>すてぶるペイは開発中です。手数料は 1.5% です。</p>",
    "<ul><li>STBLpay の手数料</li><li>1.5%</li></ul>",
    "<table><tr><th>サービス</th><th>料率</th></tr><tr><td>Stripe</td><td>3.6%</td></tr><tr><td>すてぶるペイ</td><td>1.0％</td></tr></table>",
    "<table><tr><td>当社</td></tr><tr><td>2 %</td></tr></table>",
    "<details><summary>手数料は？</summary><p>当社は</p><p>2.9 % です</p></details>",
    "<p>すてぶるペイはお得。<br>1% 未満です。</p>",
  ];
  for (const h of bad) expect(ownRateViolations(h), h).not.toEqual([]);
  const ok = [
    "<table><tr><th>サービス</th><th>料率</th></tr><tr><td>Stripe</td><td>3.6%</td></tr></table><p>すてぶるペイは開発中です。</p>",
    "<p>すてぶるペイは、この JPYC で受け取る決済です。</p><p>Stripe は 3.6% です。</p>",
    "<p>JPYC は 100% 以上を預貯金で保全するとしています[3]。すてぶるペイは、この JPYC で売上を受け取る決済です。</p>",
    "<script type=\"application/ld+json\">{\"x\":\"すてぶるペイ 5%\"}</script><p>手数料は検討中です。</p>",
  ];
  for (const h of ok) expect(ownRateViolations(h), h).toEqual([]);

  const badLaunch = [
    "<p>提供開始は2027年1月です。</p>", "<p>2027年から提供します。</p>", "<p>リリース予定日：2027年3月</p>",
    "<p>2027年3月に提供開始します。</p>", "<p>STBLpay launches in March 2027.</p>", "<p>It will launch on January 5.</p>",
  ];
  for (const h of badLaunch) expect(launchDateClaims(h), h).not.toEqual([]);
  const okLaunch = [
    "<p>提供開始日は未定です（2026年11月時点）。</p>", "<p>開発中で、提供開始日は未定です。</p>",
    "<p>The Block「Circle to launch USDC stablecoin in Japan through SBI VC Trade」（2025年3月25日）。</p>",
    "<p>2025年10月27日に発行が始まりました。</p>", "<p>The launch date is not set.</p>",
  ];
  for (const h of okLaunch) expect(launchDateClaims(h), h).toEqual([]);
});
