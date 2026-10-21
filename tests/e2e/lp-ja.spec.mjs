import { test, expect } from "@playwright/test";

// ─── コアコンテンツ・アセット ───────────────────────────────────────────────

test.describe("日本語LP コアコンテンツ", () => {
  test("タイトル・ヒーロー文言・ロゴ・主要リンクが表示される", async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/");

    await expect(page).toHaveTitle(/すてぶるペイ|STBLpay/);
    await expect(page.locator("h1")).toContainText("円を使って、ステーブルで払う。");
    await expect(page.locator(".hero-sub")).toContainText("決済事業者に縛られない");

    const heroLogo = page.locator(".hero-logo");
    await expect(heroLogo).toBeVisible();
    await expect(heroLogo).toHaveAttribute(
      "src",
      /logo-wordmark-suteburu-black\.png/
    );

    const box = await heroLogo.boundingBox();
    expect(box.width).toBeGreaterThan(160);

    await expect(
      page.getByRole("link", { name: "導入を相談する" }).first()
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "デモを見る" })).toHaveAttribute(
      "href",
      "/demo"
    );
    await expect(
      page.getByRole("link", { name: "自分の業種で使えるか、気軽に相談する →" })
    ).toBeVisible();
    await expect(page.locator("#flow")).toContainText("残高で足りるとき");
    await expect(page.locator("#merchants")).toContainText(
      "カード審査・規約で決済導入が難しい業種"
    );
    await expect(page.locator("#integration")).toContainText("OpenAPI");
    await expect(page.locator("#faq")).toContainText("よくある質問");

    expect(consoleErrors).toEqual([]);
  });
});

// ─── OGP ────────────────────────────────────────────────────────────────────

test.describe("日本語LP OGP画像", () => {
  test("ジェネレーティブOGP画像がソーシャルプレビューに使われる", async ({
    page,
  }) => {
    await page.goto("/");

    const imageUrl =
      "https://stbl-pay.com/assets/og-stblpay-generative-1200x630.png";
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://stbl-pay.com/"
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      imageUrl
    );
    await expect(
      page.locator('meta[property="og:image:type"]')
    ).toHaveAttribute("content", "image/png");
    await expect(
      page.locator('meta[property="og:image:width"]')
    ).toHaveAttribute("content", "1200");
    await expect(
      page.locator('meta[property="og:image:height"]')
    ).toHaveAttribute("content", "630");
    await expect(
      page.locator('meta[property="og:image:alt"]')
    ).toHaveAttribute("content", /すてぶるペイ/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      imageUrl
    );
    await expect(
      page.locator('meta[name="twitter:image:alt"]')
    ).toHaveAttribute("content", /すてぶるペイ/);
  });
});

// ─── Google Analytics ────────────────────────────────────────────────────────

test.describe("日本語LP Google Analytics", () => {
  test("設定済み測定IDに対してGAローダーフックが含まれる", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator('meta[name="google-analytics-id"]')
    ).toHaveAttribute("content", "G-QEPQ7VY0Z2");
    await expect(
      page.locator('script[src="assets/analytics.js"]')
    ).toHaveCount(1);
    const hasGtag = await page.evaluate(() => typeof window.gtag === "function");
    expect(hasGtag).toBe(true);
  });
});

// ─── 手数料文言ガード ────────────────────────────────────────────────────────

test.describe("日本語LP 手数料文言ガード（料率は検討中）", () => {
  test("確定料率・導入費用0円ではなく「検討中」と表示される", async ({
    page,
  }) => {
    await page.goto("/");

    // 手数料は「検討中（全加盟店一律の固定料率を予定）」— 確定料率・導入費用0円は表示しない
    await expect(page.locator(".hero-note")).toContainText("検討中");
    // 提供開始時期は出さず、開発中のサービスであることを示す
    await expect(page.locator(".hero-note")).toContainText("開発中");
    await expect(page.locator(".hero-note")).not.toContainText("先行導入");
    // 「ご意見を料率設計に反映します」は撤去済み
    await expect(page.locator("body")).not.toContainText("料率設計に反映");
    // 手数料比較表は「従来の決済との違い」表に置換
    await expect(page.locator("#comparison h2")).toContainText(
      "従来の決済との違い"
    );
    await expect(page.locator("#comparison")).toContainText("検討中");
    await expect(page.locator("#comparison")).toContainText("全加盟店一律");
    await expect(page.locator("#faq")).toContainText("全加盟店一律の固定料率");

    // 自社の確定料率・導入費用0円は表示しない（未定のため）
    await expect(page.locator("#comparison")).not.toContainText("1.5%");
    await expect(page.locator(".hero")).not.toContainText("1.5%");
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("導入費用0円");
  });

  test("手数料の料率（5% など）を、表示・HTML ソース・llms.txt のどこにも出さない", async ({
    page,
    request,
  }) => {
    // 料率は検討中（2026-10-16 ユーザー決定：5% は出さない）。「手数料」の近くに数字の % が来たら落とす。
    // 「数%〜」（03 の従来側）や 55%以上・84.5% は数字と「手数料」が離れているので当たらない
    // 改行やタグをまたいでも見逃さないよう、タグを空白に変え、空白・改行を 1 つにまとめてから調べる
    const norm = (text) => text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const feeRate = /手数料[^。]{0,30}[0-9０-９][0-9０-９.]*\s*[%％]|[0-9０-９][0-9０-９.]*\s*[%％][^。]{0,15}手数料|料率[^。]{0,15}[0-9０-９][0-9０-９.]*\s*[%％]/;
    await page.goto("/");
    // 閉じた FAQ の答えも含めるため innerText ではなく textContent
    const body = await page.locator("body").textContent();
    expect(feeRate.test(norm(body)), "表示に手数料の料率がある").toBe(false);
    // 比較表の手数料の行（すてぶるペイ側）には、数字の % を置かない
    const selfFee = await page.locator("#comparison tr", { has: page.locator('th:text-is("手数料")') }).locator("td.col-self").textContent();
    expect(/[0-9０-９][0-9０-９.]*\s*[%％]/.test(selfFee), "比較表の手数料（すてぶるペイ側）に料率がある").toBe(false);
    const html = await (await request.get("/")).text();
    expect(feeRate.test(norm(html)), "HTML ソース（meta・JSON-LD・AI_DISCOVERY_BLOCK）に手数料の料率がある").toBe(false);
    const llms = await (await request.get("/llms.txt")).text();
    expect(feeRate.test(norm(llms)), "llms.txt に手数料の料率がある").toBe(false);
    // 検査が効くこと（料率を足した文は、改行やタグで分かれていても当たる）
    expect(feeRate.test(norm("決済手数料は5%です"))).toBe(true);
    expect(feeRate.test(norm("料率 1.5%"))).toBe(true);
    expect(feeRate.test(norm("手数料\n検討中（予定5%）"))).toBe(true);
    expect(feeRate.test(norm("<th>手数料</th>\n<td>５％</td>"))).toBe(true);
  });
});

// ─── マーケット統計 ──────────────────────────────────────────────────────────

test.describe("日本語LP マーケット統計", () => {
  test("セールスデッキのマーケット統計が表示される", async ({ page }) => {
    await page.goto("/");

    const stats = page.locator(".stats");
    await expect(stats).toContainText("55%以上");
    await expect(stats).toContainText("約92");
    await expect(stats).toContainText("約4人に1人");
    await expect(stats).toContainText("15〜22");
  });
});

// ─── AI導入プロンプト ────────────────────────────────────────────────────────

test.describe("日本語LP AI導入プロンプト", () => {
  test("AIプロンプトは公開済みではなく準備予定として告知される", async ({
    page,
  }) => {
    await page.goto("/");

    // 仕様未確定のため「準備予定」の告知のみ。プロンプト本文・コピー機能は載せない
    await expect(page.locator("#integration")).toContainText("ご用意予定");
    await expect(page.locator(".prompt-details")).toHaveCount(0);
    await expect(page.locator("[data-copy-prompt]")).toHaveCount(0);
  });
});

// ─── 先行案内フォーム ────────────────────────────────────────────────────────

test.describe("日本語LP 先行案内フォーム", () => {
  test("デフォルトエンドポイントにPOSTしhoneypotが存在する", async ({
    page,
  }) => {
    let captured = null;
    await page.route("**/api/early-access", async (route) => {
      captured = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/");

    // honeypot フィールド（website）はオフスクリーンで存在する（ボット対策）
    await expect(
      page.locator('[data-early-form] input[name="website"]')
    ).toHaveCount(1);
    // 会社名は可視の実フィールド
    await expect(
      page.locator('[data-early-form] input[name="company"]')
    ).toBeVisible();

    await page.fill('[data-early-form] input[name="company"]', "株式会社テスト");
    await page.fill('[data-early-form] input[name="contact"]', "山田太郎");
    await page.fill('[data-early-form] input[name="email"]', "merchant@example.com");
    await page.fill(
      '[data-early-form] textarea[name="message"]',
      "導入を検討しています"
    );
    await page
      .locator("[data-early-form]")
      .getByRole("button", { name: "お問い合わせする" })
      .click();

    await expect(page.locator("[data-early-state]")).toContainText("受け付けました");
    expect(captured).toMatchObject({
      email: "merchant@example.com",
      company: "株式会社テスト",
      contact: "山田太郎",
      message: "導入を検討しています",
      website: "",
      source: "lp-early-access",
    });
  });

  test("設定済みエンドポイントにPOSTして成功を表示する", async ({ page }) => {
    const stubbedEndpoint = "https://lead-capture.example/api/early-access";

    let capturedBody = null;
    await page.route(stubbedEndpoint, async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/");

    // テスト用に data-endpoint を注入
    await page.locator("[data-early-form]").evaluate((form, url) => {
      form.setAttribute("data-endpoint", url);
    }, stubbedEndpoint);

    await page.fill('[data-early-form] input[name="company"]', "株式会社テスト");
    await page.fill('[data-early-form] input[name="contact"]', "山田太郎");
    await page.fill('[data-early-form] input[name="email"]', "merchant@example.com");
    await page.fill(
      '[data-early-form] textarea[name="message"]',
      "導入を検討しています"
    );
    await page
      .locator("[data-early-form]")
      .getByRole("button", { name: "お問い合わせする" })
      .click();

    await expect(page.locator("[data-early-state]")).toContainText("受け付けました");
    expect(capturedBody).toMatchObject({
      email: "merchant@example.com",
      message: "導入を検討しています",
      source: "lp-early-access",
    });
    await expect(
      page.locator('[data-early-form] input[name="email"]')
    ).toHaveValue("");
  });

  test("POSTに失敗するとエラーを表示して再送信可能になる", async ({ page }) => {
    const stubbedEndpoint = "https://lead-capture.example/api/early-access";

    await page.route(stubbedEndpoint, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.goto("/");
    await page.locator("[data-early-form]").evaluate((form, url) => {
      form.setAttribute("data-endpoint", url);
    }, stubbedEndpoint);

    await page.fill('[data-early-form] input[name="company"]', "株式会社テスト");
    await page.fill('[data-early-form] input[name="contact"]', "山田太郎");
    await page.fill('[data-early-form] input[name="email"]', "merchant@example.com");
    await page.fill(
      '[data-early-form] textarea[name="message"]',
      "導入を検討しています"
    );
    const button = page
      .locator("[data-early-form]")
      .getByRole("button", { name: "お問い合わせする" });
    await button.click();

    await expect(page.locator("[data-early-state]")).toContainText("失敗");
    await expect(button).toBeEnabled();
  });

  test("エンドポイントが空の場合はフォールバックメッセージを表示する", async ({
    page,
  }) => {
    await page.goto("/");

    const form = page.locator("[data-early-form]");
    await expect(form).toBeVisible();

    // 既定の送信先は同一オリジンの Pages Functions（Slack通知）
    await expect(form).toHaveAttribute("data-endpoint", "/api/early-access");

    // 会社名・担当者名を入れ、メール未入力 → メールの検証メッセージ
    await page.fill('[data-early-form] input[name="company"]', "株式会社テスト");
    await page.fill('[data-early-form] input[name="contact"]', "山田太郎");
    await form.getByRole("button", { name: "お問い合わせする" }).click();
    await expect(page.locator("[data-early-state]")).toContainText("メールアドレス");

    // data-endpoint を空に設定した場合のフォールバック（非退行確認）
    await form.evaluate((f) => f.setAttribute("data-endpoint", ""));
    let postedToLeadEndpoint = false;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/api/early-access")
      ) {
        postedToLeadEndpoint = true;
      }
    });
    await page.fill('[data-early-form] input[name="email"]', "merchant@example.com");
    await page.fill(
      '[data-early-form] textarea[name="message"]',
      "導入を検討しています"
    );
    await form.getByRole("button", { name: "お問い合わせする" }).click();
    await expect(page.locator("[data-early-state]")).toContainText("www.ango-ya.org");
    expect(postedToLeadEndpoint).toBe(false);
  });
});

// ─── レスポンシブ横スクロール ────────────────────────────────────────────────

test.describe("日本語LP レスポンシブ横スクロール", () => {
  for (const viewport of [
    { width: 375, height: 900 },
    { width: 768, height: 1000 },
    { width: 1440, height: 1100 },
  ]) {
    test(`${viewport.width}px で横スクロールが発生しない`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth + 1
      );
    });
  }
});

// ─── 加盟店セクション構成 ────────────────────────────────────────────────────

test.describe("日本語LP 加盟店セクション構成", () => {
  test("非依存価値が手数料の前に来て3価値ポイントが揃っている", async ({
    page,
  }) => {
    await page.goto("/");

    const merchants = page.locator("#merchants");
    await expect(merchants.locator("h2")).toContainText("加盟店にとって");
    // 加盟店の3ポイント（手数料は柱にしない）
    await expect(merchants.locator(".value-grid > li")).toHaveCount(3);
    await expect(merchants).toContainText("与信審査なしで導入できる");
    await expect(merchants).toContainText("決済と同時に着金");
    await expect(merchants).toContainText("チャージバックの負担なし");

    // 加盟店セクションは購入者(仕組み)の後・手数料の前
    const flowY = (await page.locator("#flow").boundingBox()).y;
    const merchantsY = (await merchants.boundingBox()).y;
    const feeY = (await page.locator("#comparison").boundingBox()).y;
    expect(merchantsY).toBeGreaterThan(flowY);
    expect(feeY).toBeGreaterThan(merchantsY);
  });

  test("ROI/カード手数料計算機セクションがない", async ({ page }) => {
    await page.goto("/");
    // 試算（対カード手数料の計算機）は非依存ポジショニングに合わせて撤去済み
    await expect(page.locator("#roi")).toHaveCount(0);
    await expect(page.locator("[data-roi-fee]")).toHaveCount(0);
  });
});

// ─── JSON-LD 構造化データ ────────────────────────────────────────────────────

test.describe("日本語LP JSON-LD 構造化データ", () => {
  test("JSON-LDブロックが有効なschema.orgデータを持つ", async ({ page }) => {
    await page.goto("/");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const parsed = JSON.parse(block);
      expect(parsed["@context"]).toBe("https://schema.org");
    }
  });

  test("FAQPage JSON-LD mirrors the visible FAQ questions", async ({
    page,
  }) => {
    await page.goto("/");

    // 構造化データは可視コンテンツの鏡であること
    const visible = await page
      .locator("#faq details summary")
      .allTextContents();
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faqPage = blocks
      .map((block) => JSON.parse(block))
      .flatMap((parsed) => parsed["@graph"] ?? [parsed])
      .find((node) => node["@type"] === "FAQPage");

    expect(faqPage).toBeTruthy();
    const structured = faqPage.mainEntity.map((q) => q.name);
    expect(structured).toEqual(visible.map((s) => s.trim()));
  });

  test("FAQPage JSON-LD の答えは表示の答え（脚注の参照を除く）と同じで、16問そろっている", async ({
    page,
  }) => {
    await page.goto("/");

    // 表示側: 各 <details> の <p> から脚注の参照（<sup>）を除いた文
    const visible = await page.locator("#faq details > p").evaluateAll((ps) =>
      ps.map((p) => {
        const clone = p.cloneNode(true);
        clone.querySelectorAll("sup").forEach((sup) => sup.remove());
        return clone.textContent.replace(/\s+/g, " ").trim();
      })
    );
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faqPage = blocks
      .map((block) => JSON.parse(block))
      .flatMap((parsed) => parsed["@graph"] ?? [parsed])
      .find((node) => node["@type"] === "FAQPage");

    expect(faqPage).toBeTruthy();
    expect(faqPage.mainEntity).toHaveLength(16);
    expect(visible).toHaveLength(16);
    const structured = faqPage.mainEntity.map((q) =>
      q.acceptedAnswer.text.replace(/\s+/g, " ").trim()
    );
    expect(structured).toEqual(visible);
  });
});

// ─── 運営会社の実績（フッター） ──────────────────────────────────────────────

test.describe("日本語LP フッターの運営会社の実績", () => {
  test("会社名の下に実績が4行並ぶ", async ({ page }) => {
    await page.goto("/");

    const facts = page.locator(".site-footer .footer-facts li");
    await expect(facts).toHaveCount(4);
    await expect(facts.nth(0)).toHaveText("2019年2月設立。本社は福岡市です。");
    await expect(facts.nth(1)).toContainText("アステリア株式会社");
    await expect(facts.nth(2)).toContainText("株式会社QTnet");
    await expect(facts.nth(3)).toContainText("福岡市実証実験フルサポート事業");
  });
});

// ─── 決定の逆戻りを防ぐガード ────────────────────────────────────────────────

test.describe("日本語LP 決定の逆戻りガード", () => {
  // 表示の文字と、head（title・meta・JSON-LD・AI_DISCOVERY_BLOCK）を含む HTML ソースの両方に出さない語。
  // 「『事業者』による導入」は、実際の文面では鉤括弧（「事業者」）なので両方の書き方を見る
  const BANNED_IN_PAGE = [
    "先行導入",
    "2026年8月",
    "2026.08",
    "SDK",
    "経由せず",
    "経由しない",
    "銀行振込するだけ",
    "同額を銀行振込",
    "JPYC建て",
    "誰でも受け取れる",
    "『事業者』による導入",
    "「事業者」による導入",
  ];

  test("ページ全体（表示の文字と HTML ソース）に使わない語が無い", async ({
    page,
  }) => {
    const response = await page.goto("/");
    const source = await response.text();
    // 閉じた <details>（FAQ）の中身も含めるため innerText ではなく textContent を見る
    const bodyText = await page.evaluate(() => document.body.textContent);

    for (const term of BANNED_IN_PAGE) {
      expect(bodyText, `body に「${term}」が残っている`).not.toContain(term);
      expect(source, `HTML ソースに「${term}」が残っている`).not.toContain(
        term
      );
    }
  });

  test("llms.txt に使わない語が無い", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.ok()).toBe(true);
    const text = await response.text();

    for (const term of ["誰でも", "SDK", "2026年8月", "JPYC建て"]) {
      expect(text, `llms.txt に「${term}」が残っている`).not.toContain(term);
    }
  });
});
