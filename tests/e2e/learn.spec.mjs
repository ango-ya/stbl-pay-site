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
  // 他社の JPYC 決済の料金（各社の PR TIMES の発表。2026年11月10日に本文で確認。自社の料率ではない）。
  // jpyc-payments は本文・FAQ・JSON-LD の 3 か所、stablecoin-payments は h2#fees と FAQ の手数料の答え（JSON-LD も同じ）に同じ文
  // ネットスターズ（2026年7月13日、stablecoin-payments の出典 [14]）
  { pages: ["/learn/jpyc-payments/", "/learn/stablecoin-payments/"], prefix: "ネットスターズは、Stablecoin Pay の決済手数料を ", value: "0.98%" },
  // uniple（2026年7月21日、2026年7月時点・税込。stablecoin-payments の出典 [15]）
  { pages: ["/learn/jpyc-payments/", "/learn/stablecoin-payments/"], prefix: "uniple は、uniple checkout のシステム利用料を、2026年7月時点で受取金額の ", value: "1.0%" },
  // Stripe の日本の標準料金（https://stripe.com/jp/pricing を 2026年11月10日に確認。出典 [7]）。#cost と FAQ 費用の答え（JSON-LD も同文）
  { pages: ["/learn/accept-credit-cards/"], prefix: "料率の例として、Stripe の日本の標準料金は、カード決済 1 件ごとに ", value: "3.6%" },
  // payment-fees の公表料金の表（各社の公式の料金ページを 2026年11月10日に確認）。Square はオンライン決済、STORES は「から」の値
  { pages: ["/learn/payment-fees/"], prefix: "Square（オンライン決済） オンライン決済は、決済ごとに ", value: "3.6%" },
  { pages: ["/learn/payment-fees/"], prefix: "BASE（スタンダードプラン） 1 注文ごとに、決済手数料 ", value: "3.6%" },
  { pages: ["/learn/payment-fees/"], prefix: "BASE（スタンダードプラン） 1 注文ごとに、決済手数料 3.6% ＋ 40 円と、サービス手数料 ", value: "3%" },
  { pages: ["/learn/payment-fees/"], prefix: "BASE（グロースプラン） 1 注文ごとに、決済手数料 ", value: "2.9%" },
  { pages: ["/learn/payment-fees/"], prefix: "STORES（フリープラン） 決済手数料は ", value: "5.5%" },
  { pages: ["/learn/payment-fees/"], prefix: "STORES（スタンダードプラン） 決済手数料は ", value: "3.6%" },
];
const allowFor = (path) => ALLOW_PCT.filter((a) => a.pages.includes(path));

// 図とサムネイルを入れたページ（移行済み）。slug → 期待する図の名前（ページの上からの順。scripts/figures/<slug>/<name>.js）。
// 新しく移行したページは、ここに足すだけで、OGP が記事の og.png であること・図の並びと形式・motion ごとの絵・停止ボタンが検査される
const MIGRATED = {
  "stablecoin-payments": ["law", "flow", "compare"],
  "what-is-stablecoin": ["backing", "vs-crypto"],
  "jpyc-payments": ["ways", "after"],
  "glossary": ["relations", "card-words"],
  "payment-gateway": ["windows", "flow"],
  "accept-credit-cards": ["methods", "steps"],
  "card-merchant-screening": ["scope", "retry"],
  "no-screening-payments": ["why", "options", "stblpay"],
  "chargeback": ["flow", "compare"],
  "card-expression-restrictions": ["layers", "chain", "spread"],
  "online-payment-methods": ["combine", "window"],
  "payment-fees": ["total", "payout"],
  "policy-expression": ["line"],
};
// 表現に関する方針は /policy/expression/ にある（slug は policy-expression）。それ以外は /learn/<slug>/
const pathOf = (slug) => (slug === "policy-expression" ? "/policy/expression/" : `/learn/${slug}/`);
const slugOf = (path) => (path === "/policy/expression/" ? "policy-expression" : path.startsWith("/learn/") ? path.split("/").filter(Boolean).pop() : undefined);
const migratedOf = (path) => MIGRATED[slugOf(path)];
// 記事ごとのサムネイル（scripts/learn-thumbs/make.mjs が書き出す）を持つページ。図を持つ MIGRATED とは別に判定する。
// 日本語は一覧と MIGRATED（og.png・thumb.webp）、英語はここに並べたページ（og-en.png・thumb-en.webp）。一覧はどちらも assets/learn/hub/
const EN_THUMBS = [
  "/en/learn/", "/en/learn/stablecoin-payments-japan/", "/en/learn/japan-payment-methods/", "/en/learn/konbini-payment/",
  "/en/learn/jpy-stablecoin/", "/en/learn/accept-stablecoin-payments/", "/en/learn/high-risk-merchant-account/",
];
const isHubPath = (path) => path === "/learn/" || path === "/en/learn/";
const thumbOf = (path) => {
  const en = path.startsWith("/en/");
  if (!(en ? EN_THUMBS.includes(path) : path === "/learn/" || migratedOf(path))) return undefined;
  const dir = isHubPath(path) ? "hub" : en ? path.split("/").filter(Boolean).pop() : slugOf(path);
  const s = en ? "-en" : "";
  return { og: `/assets/learn/${dir}/og${s}.png`, thumb: `/assets/learn/${dir}/thumb${s}.webp` };
};

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
    const local = (u) => { const x = new URL(u); return x.pathname + x.search; };
    // OGP の画像は、サムネイルを持つページ（thumbOf）なら記事ごとのサムネイル（og.png、英語は og-en.png）、
    // それ以外は言語に合う共通の画像（サムネイルを持つページが共通の画像に戻ったら落とす）
    const figNames = migratedOf(path);
    const thumb = thumbOf(path);
    const own = thumb && `${ORIGIN}${thumb.og}`;
    const ogImage = own || `${ORIGIN}/assets/og-stblpay-generative${isEn ? "-en" : ""}-1200x630.png`;
    const sameImage = (u) => u.split("?")[0] === ogImage;
    for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(sameImage(await page.locator(sel).getAttribute("content")), `${sel} は記事のサムネイルか、言語に合う共通の画像`).toBe(true);
    }
    if (ogImage === own) {
      // 記事ごとの画像：200 で返り、PNG の実寸（IHDR）が 1200×630 で、meta の寸法とも合う
      const res = await request.get(local(own));
      expect(res.status(), own).toBe(200);
      const png = await res.body();
      expect(png.subarray(1, 4).toString(), "PNG である").toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], "1200×630").toEqual([1200, 630]);
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
      await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
      await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/png");
      const alt = await page.locator('meta[property="og:image:alt"]').getAttribute("content");
      await expect(page.locator('meta[name="twitter:image:alt"]'), "twitter:image:alt は og:image:alt と同じ").toHaveAttribute("content", alt);
    }
    await expect(page.locator("figure.learn-fig"), "図の数は MIGRATED のとおり").toHaveCount(figNames ? figNames.length : 0);
    // 冒頭のサムネイルは、サムネイルを持つ記事だけ（一覧はカードに出すので冒頭には置かない）
    const hasHero = thumb && !isHubPath(path);
    await expect(page.locator("img.learn-hero"), "冒頭のサムネイルは、サムネイルを持つ記事だけ").toHaveCount(hasHero ? 1 : 0);
    if (hasHero) await expect(page.locator("img.learn-hero")).toHaveAttribute("src", thumb.thumb);

    // 図（scripts/figures/ が書き出す GIF・WebP）：文字の代わりの alt と figcaption、場所を先に取る width/height、遅延読み込み。各形式が 200
    for (const fig of await page.locator("figure.learn-fig").all()) {
      const img = fig.locator("img");
      expect((await img.getAttribute("alt"))?.length ?? 0, "図の alt は図の内容を文で").toBeGreaterThan(30);
      expect([await img.getAttribute("width"), await img.getAttribute("height")]).toEqual(["720", "405"]);
      expect(await img.getAttribute("loading")).toBe("lazy");
      expect((await fig.locator("figcaption").textContent()).trim().length, "figcaption がある").toBeGreaterThan(10);
      const srcs = [await img.getAttribute("src"), ...(await fig.locator("source").evaluateAll((ss) => ss.map((s) => s.getAttribute("srcset"))))];
      for (const src of srcs) expect((await request.get(src)).status(), src).toBe(200);
    }
    // 冒頭のサムネイル：最初に見える絵なので遅延読み込みにしない
    for (const hero of await page.locator("img.learn-hero").all()) {
      expect(await hero.getAttribute("loading")).toBeNull();
      expect(await hero.getAttribute("fetchpriority")).toBe("high");
      expect([await hero.getAttribute("width"), await hero.getAttribute("height")]).toEqual(["1200", "630"]);
      expect((await hero.getAttribute("alt"))?.length ?? 0).toBeGreaterThan(10);
      expect((await request.get(await hero.getAttribute("src"))).status()).toBe(200);
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
    if (thumb) {
      // サムネイルを持つページは、主な JSON-LD（Article・DefinedTermSet・WebPage・CollectionPage）の image も記事の og.png（Article 以外で image が消えても気づく）
      const m = nodes.find((n) => n["@type"] === main);
      const mi = typeof m.image === "string" ? m.image : m.image?.url ?? m.image?.[0];
      expect(mi, `${main}.image は記事の og.png`).toBeTruthy();
      expect(sameImage(mi), `${main}.image は記事の og.png`).toBe(true);
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

test("移行済みのページ（MIGRATED）は、すべて検査の対象（PAGES）にある", () => {
  for (const slug of Object.keys(MIGRATED)) expect(PAGES.map((p) => p.path)).toContain(pathOf(slug));
});

test("サムネイルを持つ英語のページ（EN_THUMBS）は、すべて検査の対象（PAGES）にある", () => {
  for (const path of EN_THUMBS) expect(PAGES.map((p) => p.path)).toContain(path);
});

for (const [hub, ext] of [["/learn/", "thumb.webp"], ["/en/learn/", "thumb-en.webp"]]) {
  test(`${hub} の一覧：どのカードも、リンク先の記事のサムネイル（${ext}）を頭に出し、絵が読める`, async ({ page }) => {
    await page.goto(hub);
    const cards = page.locator(".learn-cards a");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const a of await cards.all()) {
      const href = await a.getAttribute("href");
      const thumb = thumbOf(href);
      expect(thumb, `${href} はサムネイルを持つ`).toBeTruthy();
      const img = a.locator("img.learn-card-thumb");
      await expect(img).toHaveAttribute("src", thumb.thumb);
      await expect(img).toHaveAttribute("alt", ""); // 題名は h3 にある
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    }
  });
}

// 図の picture：source の順（アニメ WebP（no-preference）→ 完成図 WebP → GIF の img）、motion ごとに選ばれる絵、デコード、
// 通常の表示で GIF を取りに行かないこと、「動きを止める／動かす」ボタン（assets/learn-fig.js）で絵とボタンの名前が替わること
for (const [slug, names] of Object.entries(MIGRATED)) {
  for (const motion of ["no-preference", "reduce"]) {
    test(`${pathOf(slug)}：図の絵の選び方と停止ボタン（prefers-reduced-motion: ${motion}）`, async ({ page }) => {
      const gifs = [];
      page.on("request", (r) => { if (/\.gif(\?|$)/i.test(r.url())) gifs.push(r.url()); });
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto(pathOf(slug));
      const base = `/assets/learn/${slug}/`;
      const figs = page.locator("figure.learn-fig");
      await expect(figs).toHaveCount(names.length);
      expect(names.length).toBeGreaterThan(0);
      const shown = (img) => img.evaluate((i) => (i.currentSrc ? new URL(i.currentSrc).pathname : "")); // 差し替えの途中は空
      const decoded = (img) => img.evaluate((i) => i.complete && i.naturalWidth > 0);
      for (const [i, name] of names.entries()) {
        const fig = figs.nth(i);
        const kids = await fig.locator("picture > *").evaluateAll((es) =>
          es.map((e) => [e.tagName, e.getAttribute("type"), e.getAttribute("media"), e.getAttribute("srcset") ?? e.getAttribute("src")]));
        expect(kids, `${name} の picture の中身と順序`).toEqual([
          ["SOURCE", "image/webp", "(prefers-reduced-motion: no-preference)", `${base}${name}.webp`],
          ["SOURCE", "image/webp", null, `${base}${name}-still.webp`],
          ["IMG", null, null, `${base}${name}.gif`],
        ]);
        const img = fig.locator("img");
        await img.scrollIntoViewIfNeeded();
        const first = `${base}${name}${motion === "reduce" ? "-still" : ""}.webp`;
        const other = `${base}${name}${motion === "reduce" ? "" : "-still"}.webp`;
        await expect.poll(() => decoded(img), `${name} がデコードできる`).toBe(true);
        expect(await shown(img)).toBe(first);
        // reduce の人は初めから止まっている（押すと動く）。状態はボタンの名前で表す（aria-pressed は使わない）
        const stopName = "動きを止める", playName = "動かす";
        const button = fig.locator("button.learn-fig-toggle");
        await expect(button).not.toHaveAttribute("aria-pressed", /.*/);
        await expect(button).toHaveAccessibleName(motion === "reduce" ? playName : stopName);
        await button.click();
        await expect(button).toHaveAccessibleName(motion === "reduce" ? stopName : playName);
        await expect.poll(() => shown(img), `${name}：押すと絵が替わる`).toBe(other);
        await expect.poll(() => decoded(img)).toBe(true);
        await button.click();
        await expect(button).toHaveAccessibleName(motion === "reduce" ? playName : stopName);
        await expect.poll(() => shown(img), `${name}：もう一度押すと戻る`).toBe(first);
      }
      const hero = page.locator("img.learn-hero");
      await expect(hero).toHaveAttribute("src", `${base}thumb.webp`);
      await expect.poll(() => decoded(hero)).toBe(true);
      expect(gifs, "WebP を表示できるブラウザは GIF を取りに行かない").toEqual([]);
    });
  }
  test(`${pathOf(slug)}：見ている途中で motion の設定が変わったら、その設定の初期状態（絵とボタンの名前）に戻る`, async ({ page }) => {
    const base = `/assets/learn/${slug}/`;
    const figs = page.locator("figure.learn-fig");
    const shown = (img) => img.evaluate((i) => (i.currentSrc ? new URL(i.currentSrc).pathname : ""));
    const expectAll = async (still, name) => {
      for (const [i, n] of names.entries()) {
        const fig = figs.nth(i);
        await expect(fig.locator("button.learn-fig-toggle"), `${n} のボタン`).toHaveAccessibleName(name);
        await expect.poll(() => shown(fig.locator("img")), `${n} の絵`).toBe(`${base}${n}${still ? "-still" : ""}.webp`);
      }
    };
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(pathOf(slug));
    for (let i = 0; i < names.length; i++) await figs.nth(i).locator("img").scrollIntoViewIfNeeded();
    await expectAll(false, "動きを止める");
    await figs.nth(0).locator("button.learn-fig-toggle").click(); // 1 つだけ止めてから設定を変える
    await expect(figs.nth(0).locator("button.learn-fig-toggle")).toHaveAccessibleName("動かす");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectAll(true, "動かす");
    await figs.nth(0).locator("button.learn-fig-toggle").click(); // reduce で 1 つだけ動かしてから戻す
    await expect.poll(() => shown(figs.nth(0).locator("img"))).toBe(`${base}${names[0]}.webp`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expectAll(false, "動きを止める");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectAll(true, "動かす");
  });
  test(`${pathOf(slug)}：JS が無いときは停止ボタンを出さない`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(pathOf(slug));
    await expect(page.locator("figure.learn-fig")).toHaveCount(names.length);
    await expect(page.locator(".learn-fig-toggle")).toHaveCount(0);
    await context.close();
  });
}

// 計測（assets/analytics.js）：本番のホスト・自動操作でないブラウザのときだけ、解説の記事の選び方・図の停止・AI の回答からの来訪を送る
test("計測：AI の回答から来た閲覧、一覧のカード・関連欄から選んだ記事、図の停止ボタンを GA4 のイベントに積む", async ({ page, baseURL }) => {
  const GA = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;
  await page.route(GA, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://stbl-pay.com/**", async (route) => {
    const u = new URL(route.request().url());
    const r = await page.request.get(`${baseURL}${u.pathname}${u.search}`);
    route.fulfill({ status: r.status(), headers: r.headers(), body: await r.body() });
  });
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  const events = () => page.evaluate(() => (window.dataLayer || []).filter((a) => a[0] === "event").map((a) => [a[1], a[2]]));
  // リンクで移ると dataLayer が消えるので、押したあとの移動は止める
  const clickStay = (sel) => page.evaluate((s) => { const a = document.querySelector(s); a.addEventListener("click", (e) => e.preventDefault()); a.click(); }, sel);

  await page.goto("https://stbl-pay.com/learn/", { referer: "https://chatgpt.com/" });
  expect(await events()).toContainEqual(["ai_referral", expect.objectContaining({ ai_source: "chatgpt", landing_page: "/learn/" })]);
  await clickStay(".learn-cards a[href='/learn/chargeback/']");
  expect(await events()).toContainEqual(["select_content", expect.objectContaining({ content_type: "learn_hub", item_id: "/learn/chargeback/" })]);

  await page.goto("https://stbl-pay.com/learn/chargeback/");
  expect((await events()).some(([n]) => n === "ai_referral"), "AI 以外から来たときは送らない").toBe(false);
  await clickStay(".learn-related a");
  expect(await events()).toContainEqual(["select_content", expect.objectContaining({ content_type: "learn_related" })]);
  await page.locator("button.learn-fig-toggle").first().click();
  expect(await events()).toContainEqual(["figure_toggle", expect.objectContaining({ stopped: true })]);
});
