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


// --- 自社の料率と提供開始日の検査（HTML 文字列を受ける純関数。下のユニット test で、わざと違反を入れて確かめる） ---
// 対象は、表示テキスト（title を含む）・すべての meta の content・JSON-LD のすべての文字列値。ブロック要素の境目は改行にする
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const BLOCK = /<\/?(?:p|li|ul|ol|h[1-6]|tr|table|div|section|article|header|footer|nav|main|details|summary|dt|dd|dl|blockquote|figcaption|title|br|hr)\b[^>]*>/gi;
const jsonStrings = (v) => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(jsonStrings) : [];
function pageText(html) {
  const ld = [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => jsonStrings(JSON.parse(m[1])));
  const metas = [...html.matchAll(/<meta\b[^>]*\scontent=(?:"([^"]*)"|'([^']*)')/gi)].map((m) => decode(m[1] ?? m[2]));
  const shown = decode(html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/\s+/g, " ").replace(BLOCK, "\n").replace(/<[^>]+>/g, " "));
  return [shown, ...metas, ...ld].join("\n").replace(/[ \t\u00a0\u3000]+/g, " ");
}

// 料率：数字の % はすべて、ページごとの許可リストのどれかに一致したときだけ許す（帰属の推測はしない）。
// 一致は「% の前後 CONTEXT 文字の中で、パターンの一致がその % を含む」こと
const CONTEXT = 50;
const PCT = /[0-9０-９][0-9０-９,.．]*\s*(?:[%％]|パーセント|percent\b)/gi;
const ALLOW_PCT = [
  // JPYC の発行体が示す保全の割合（JPYC 株式会社の公表。自社の料率ではない）
  { pages: ["/learn/stablecoin-payments/", "/learn/jpyc-payments/", "/learn/glossary/"], pattern: /発行残高の\s*100%\s*以上を預貯金と国債で保全/ },
  { pages: ["/en/learn/stablecoin-payments-japan/"], pattern: /reserves of at least 100% of the outstanding/ },
  // Stripe の日本の標準料金（Stripe 公式の料金ページを出典に付けている）
  { pages: ["/learn/stablecoin-payments/", "/learn/jpyc-payments/", "/learn/payment-fees/"], pattern: /Stripe[^。]{0,40}3\.6%/ },
  { pages: ["/en/learn/stablecoin-payments-japan/"], pattern: /Stripe's standard rate in Japan is 3\.6%/ },
  // Stripe の通貨換算の加算（直前の Stripe 3.6% の続き）
  { pages: ["/learn/stablecoin-payments/", "/learn/jpyc-payments/"], pattern: /3\.6%\s*です（通貨の換算が要る場合は\s*2%\s*を加算）/ },
  { pages: ["/learn/payment-fees/"], pattern: /3\.6%\s*です。通貨の換算が要る場合は、\s*2%\s*が加わります/ },
  { pages: ["/en/learn/stablecoin-payments-japan/"], pattern: /3\.6% per domestic card payment, with an extra 2%/ },
  // 料率が目立つことの例示（下の段落で出典付きで示す Stripe の値と同じ。自社の料率ではない）
  { pages: ["/learn/payment-fees/"], pattern: /「3\.6%」のような料率が目立ちますが/ },
];
function rateViolations(html, allow) {
  const text = pageText(html);
  return [...text.matchAll(PCT)].flatMap((m) => {
    const from = Math.max(0, m.index - CONTEXT);
    const ctx = text.slice(from, m.index + m[0].length + CONTEXT);
    const at = m.index - from;
    const ok = allow.some((re) => [...ctx.matchAll(new RegExp(re.source, re.flags.replace("g", "") + "g"))].some((a) => a.index <= at && at < a.index + a[0].length));
    return ok ? [] : [`「${m[0]}」… ${ctx.replace(/\n/g, " ")}`];
  });
}
const allowFor = (path) => ALLOW_PCT.filter((a) => a.pages.includes(path)).map((a) => a.pattern);

// 提供開始日：自社名・開始の語・日付が同じ文にあれば違反。同じ文に「未定」などがあれば許す。主語が他社だけの文は自社名が無いので対象外
const OWN = /すてぶるペイ|STBLpay|当サービス|本サービス|当社/i;
const LAUNCH_WORD = /提供|開始|リリース|ローンチ|公開|launch|available|release|go(?:es)? live|roll(?:s|ing)? ?out/i;
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|march|mar|april|apr|june|jun|july|jul|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE = new RegExp([
  "[0-9０-９]{4}\\s*年", "[0-9０-９]{1,2}\\s*月\\s*(?:[0-9０-９]{1,2}\\s*日|上旬|中旬|下旬|中|末)", "\\d{4}\\s*[/.\\-]\\s*\\d{1,2}", "令和",
  `\\b${MONTH}\\b\\.?`, "\\bmay\\s+(?:\\d{1,2},?\\s+)?\\d{4}", "\\bQ[1-4]\\b", "\\b[1-4]Q\\b", "第\\s*[1-4一二三四]\\s*四半期",
  "\\b(?:early|mid|late|spring|summer|fall|autumn|winter)[\\s-]+(?:of\\s+)?\\d{4}", "\\b(?:this|next)\\s+(?:year|quarter|month|spring|summer|fall|autumn|winter)",
  "上半期|下半期|上期|下期|年内|年度内|今年|来年|(?:今|来)(?:春|夏|秋|冬|期)",
].join("|"), "i");
const UNDECIDED = /未定|決まっていません|決まっていない|not yet (?:set|decided)|not been (?:set|decided)|\bTBD\b/i;
const launchDateClaims = (html) => pageText(html).split(/[。．.!?！？\n]/)
  .filter((s) => OWN.test(s) && LAUNCH_WORD.test(s) && DATE.test(s) && !UNDECIDED.test(s))
  .map((s) => s.trim());

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
    // 自社の料率と提供開始日を書かない（表示・meta・JSON-LD のすべて。検査の中身は上の関数）
    expect(rateViolations(source, allowFor(path)), "許可リストに無い %。自社の料率は書かない。他社の出典付きの値なら ALLOW_PCT に理由付きで足す").toEqual([]);
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

test("検査関数：料率は許可リストに無い % を落とす", () => {
  const stripe = [/Stripe[^。]{0,40}3\.6%/];
  const bad = [
    "<p>すてぶるペイの手数料について。料率は1%です[1]。</p>",
    '<head><meta name="description" content="すてぶるペイの手数料は1%です。"></head><p>手数料は検討中です。</p>',
    '<script type="application/ld+json">{"@type":"Article","description":"STBLpay の手数料は 1.5％"}</script>',
    "<p>Stripe は 3.6% です。すてぶるペイは 1.0% です。</p>",
    "<p>STBLpay charges 2 percent.</p>",
    "<p>手数料は 1&#37; です。</p>",
  ];
  for (const h of bad) expect(rateViolations(h, stripe), h).not.toEqual([]);
  // 許可リストが空なら、他社の値でも落とす
  expect(rateViolations("<p>Stripe は 3.6% です。</p>", [])).not.toEqual([]);
  const ok = [
    "<table><tr><td>Stripe：3.6%／すてぶるペイ：未定</td></tr></table>",
    "<p>Stripe の日本の標準料金は 3.6% です。すてぶるペイは開発中です。</p>",
    "<p>手数料は検討中です。</p>",
  ];
  for (const h of ok) expect(rateViolations(h, stripe), h).toEqual([]);
});

test("検査関数：提供開始日の断定を落とし、未定や他社の日付は通す", () => {
  const bad = [
    "<p>すてぶるペイは2027年1月に正式に提供開始します。</p>",
    '<script type="application/ld+json">{"@type":"Article","description":"すてぶるペイは2027年3月にサービス開始予定です。"}</script>',
    '<meta name="description" content="STBLpay は 2027 年春に提供を始めます。">',
    "<p>STBLpay will launch in March 2027.</p>",
    "<p>STBLpay will be available in Q2 2027.</p>",
    "<p>当サービスは<strong>2027年上半期</strong>にリリース予定です。</p>",
    "<p>STBLpay launches early 2027!</p>",
  ];
  for (const h of bad) expect(launchDateClaims(h), h).not.toEqual([]);
  const ok = [
    "<p>JPYC は2025年10月27日にサービス開始しました。</p>",
    "<p>すてぶるペイの提供開始日は未定です（2026年11月時点）。</p>",
    "<p>提供開始日は未定です（2026年11月時点）。</p>",
    "<p>STBLpay is under development; the launch date is not yet set.</p>",
    "<p>STBLpay is under development, and the launch date has not been set (as of November 2026).</p>",
    "<p>The Block「Circle to launch USDC stablecoin in Japan through SBI VC Trade」（2025年3月25日）。</p>",
  ];
  for (const h of ok) expect(launchDateClaims(h), h).toEqual([]);
});
