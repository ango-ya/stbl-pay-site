// 解説ページ（/learn/ と /en/learn/）と表現に関する方針（/policy/expression/）が、検索と AI に読まれる形を保ち、書いてはいけないことを書いていないこと。
// 書くときの決まりは marketing/seo-strategy.md。本番ヘッダ（CSP）はローカルの静的サーバーが付けないので、_headers の値を付け直して見る。
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { BANNED, BANNED_EN, TEXTS, rateViolations, launchDateClaims, CSP } from "./text-rules.mjs";

const ORIGIN = "https://stbl-pay.com";
const PAGES = [
  { path: "/learn/", main: "CollectionPage" },
  { path: "/learn/stablecoin-payments/", main: "Article" },
  { path: "/learn/jpyc-payments/", main: "Article" },
  { path: "/learn/card-merchant-screening/", main: "Article" },
  { path: "/learn/no-screening-payments/", main: "Article" },
  { path: "/learn/payment-fees/", main: "Article" },
  { path: "/learn/chargeback/", main: "Article" },
  { path: "/learn/glossary/", main: "DefinedTermSet" },
  { path: "/learn/what-is-stablecoin/", main: "Article" },
  { path: "/learn/payment-gateway/", main: "Article" },
  { path: "/learn/accept-credit-cards/", main: "Article" },
  { path: "/learn/online-payment-methods/", main: "Article" },
  { path: "/learn/card-expression-restrictions/", main: "Article" },
  { path: "/policy/expression/", main: "WebPage" },
  { path: "/en/learn/stablecoin-payments-japan/", main: "Article" },
  { path: "/en/learn/", main: "CollectionPage" },
  { path: "/en/learn/japan-payment-methods/", main: "Article" },
  { path: "/en/learn/konbini-payment/", main: "Article" },
  { path: "/en/learn/jpy-stablecoin/", main: "Article" },
  { path: "/en/learn/accept-stablecoin-payments/", main: "Article" },
  { path: "/en/learn/high-risk-merchant-account/", main: "Article" },
];

const ALLOW_PCT = [
  // JPYC の発行体が示す保全の割合（JPYC 株式会社の公表。出典付き。自社の料率ではない）
  { pages: ["/learn/stablecoin-payments/", "/learn/glossary/"], prefix: "日本円と 1：1 で交換でき、発行残高の ", value: "100%" },
  { pages: ["/learn/jpyc-payments/"], prefix: "2025年10月27日に発行が始まり、発行残高の ", value: "100%" },
  { pages: ["/en/learn/stablecoin-payments-japan/"], prefix: "states that reserves of at least ", value: "100%" },
  // Stripe の日本の標準料金と、通貨換算の加算（Stripe 公式の料金ページを出典に付けている。自社の料率ではない）
  { pages: ["/learn/stablecoin-payments/"], prefix: "Stripe の日本の標準料金は、成功したカード決済 1 件ごとに ", value: "3.6%" },
  { pages: ["/learn/stablecoin-payments/"], prefix: "成功したカード決済 1 件ごとに 3.6% です（通貨の換算が要る場合は ", value: "2%" },
  { pages: ["/learn/jpyc-payments/"], prefix: "Stripe の日本の標準の料金体系では、カードでの決済が成功するごとに ", value: "3.6%" },
  { pages: ["/learn/jpyc-payments/"], prefix: "カードでの決済が成功するごとに 3.6% です（通貨の換算が要る場合は ", value: "2%" },
  // payment-fees：meta・JSON-LD の要約と、「料率の例：Stripe の場合」の節（直前の文で Stripe の標準料金と明示し、出典 [1] を付けている）
  { pages: ["/learn/payment-fees/"], prefix: "Stripe の日本の標準料金は、カード決済 1 件ごとに ", value: "3.6%" },
  { pages: ["/learn/payment-fees/"], prefix: "カード決済は、成功した決済 1 件ごとに ", value: "3.6%" },
  { pages: ["/learn/payment-fees/"], prefix: "通貨の換算が要る場合は、", value: "2%" },
  { pages: ["/en/learn/stablecoin-payments-japan/"], prefix: "Stripe's standard rate in Japan is ", value: "3.6%" },
  { pages: ["/en/learn/stablecoin-payments-japan/"], prefix: "3.6% per domestic card payment, with an extra ", value: "2%" },
];
const allowFor = (path) => ALLOW_PCT.filter((a) => a.pages.includes(path));

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
    // 自社の料率と提供開始日を書かない（表示・meta・JSON-LD のすべて。検査の中身は上の関数）
    const texts = await page.evaluate(TEXTS);
    expect(rateViolations(texts, allowFor(path)), "自社名と同じ文の %、または許可リストに無い %。他社の出典付きの値なら、自社名と別の文にして ALLOW_PCT に理由付きで足す").toEqual([]);
    expect(launchDateClaims(texts), "自社名と開始の語が同じ文にある（提供開始日は書かない）").toEqual([]);

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

// ユニット：HTML 文字列を page.setContent で読み込み、本番と同じ TEXTS で取り出して検査する
const textsOf = async (page, html) => { await page.setContent(html); return page.evaluate(TEXTS); };

test("検査関数：自社名と同じ文の % と、許可リストに無い % を落とす", async ({ page }) => {
  const stripe = [{ pages: [], prefix: "Stripe の日本の標準料金は、カードでの決済が成功するごと ", value: "3.6%" }];
  const bad = [
    "<p>Stripe と比較して、すてぶるペイは1%、Stripe は3.6%です。</p>",
    "<p>Stripe と同じく、すてぶるペイは3.6%です。</p>",
    "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと 3.6% で、すてぶるペイも同じです。</p>",
    '<head><meta name="description" content = "すてぶるペイの手数料は1%です。"></head><p>手数料は検討中です。</p>',
    "<p>本文の すてぶるペイの手数料は 1&percnt;</p>",
    "<p>すてぶるペイの手数料は<br>1&#37;</p>",
    '<script type="application/ld+json">{"@type":"Article","description":"STBLpay の手数料は 1.5％"}</script>',
    "<p>STBLpay charges 2 percent.</p>",
    // 許可リストに無い他社の %（値が違う・直前の文字列が違う・許可された値の隣の別の数値）
    "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと 3.5% です。</p>",
    "<p>PayPal の料率は 3.6% です。</p>",
    "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと 3.6% で、別の会社は 1% です。</p>",
  ];
  for (const h of bad) expect(rateViolations(await textsOf(page, h), stripe), h).not.toEqual([]);
  // 許可リストが空なら、許可リストどおりの文でも落とす
  expect(rateViolations(await textsOf(page, "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと 3.6% です。</p>"), [])).not.toEqual([]);
  const ok = [
    "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと 3.6% です。すてぶるペイは開発中です。</p>",
    "<p>Stripe の日本の標準料金は、カードでの決済が成功するごと\n  3.6&#37; です。</p>",
    "<p>手数料は検討中です。</p>",
  ];
  for (const h of ok) expect(rateViolations(await textsOf(page, h), stripe), h).toEqual([]);
});

test("検査関数：自社名と開始の語が同じ文にあれば落とし、決まった「未定」の言い回しと他社の開始は通す", async ({ page }) => {
  const bad = [
    "<p>すてぶるペイは1月に提供開始します。</p>",
    "<p>STBLpay launches in 2027.</p>",
    "<p>STBLpay launches on May 5.</p>",
    "<p>すてぶるペイは2027年1月に公開します。</p>",
    "<p>STBLpay rolls out in January 2027.</p>",
    "<p>すてぶるペイ<br>は2027年1月に提供開始</p>",
    "<p>すてぶるペイは2027年1月に提供開始、料金は未定です。</p>",
    '<script type="application/ld+json">{"@type":"Article","description":"すてぶるペイは2027年3月にサービス開始予定です。"}</script>',
    "<p>STBLpay will be available in Q2 2027.</p>",
    "<p>当サービスは<strong>2027年上半期</strong>にリリース予定です。</p>",
  ];
  for (const h of bad) expect(launchDateClaims(await textsOf(page, h)), h).not.toEqual([]);
  const ok = [
    "<p>JPYC は2025年10月27日にサービス開始</p>",
    "<p>すてぶるペイは開発中で、提供開始日は未定です（2026年11月時点）。</p>",
    "<p>STBLpay is under development, and the launch date has not been set (as of November 2026).</p>",
    "<p>STBLpay is under development; the launch date is not yet set.</p>",
    "<p>The Block「Circle to launch USDC stablecoin in Japan through SBI VC Trade」（2025年3月25日）。</p>",
  ];
  for (const h of ok) expect(launchDateClaims(await textsOf(page, h)), h).toEqual([]);
});

test("英語の使わない語に August 2026 が入っている（回帰）", () => {
  expect("Launching in August 2026.").toMatch(BANNED_EN);
  expect("launching in august 2026").toMatch(BANNED_EN);
});
