import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diffSpecs } from "../../scripts/openapi-parity.mjs";

// 加盟店向けドキュメント（/docs/・docs-site のビルド結果）

const dist = fileURLToPath(new URL("../../dist/", import.meta.url));

test.describe("加盟店向けドキュメント", () => {
  test("LP のヘッダーとフッターから /docs/ へ行ける", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator(".site-nav").getByRole("link", { name: "ドキュメント" })
    ).toHaveAttribute("href", "/docs/");
    await expect(
      page.locator(".site-footer").getByRole("link", { name: "加盟店向けドキュメント" })
    ).toHaveAttribute("href", "/docs/");
  });

  test("概要ページが表示され、コンソールにエラーが出ない", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/docs/");

    await expect(page).toHaveTitle(/STBLpay ドキュメント/);
    await expect(page.locator("h1")).toContainText("STBLpay とは");
    // ヘッダーは LP と同じ項目。LP の節へのリンクは /docs/ を付けずに LP を指す
    await expect(page.locator(".navbar").getByRole("link", { name: "手数料", exact: true })).toHaveAttribute("href", "/#comparison");
    await expect(page.locator(".navbar").getByRole("link", { name: "導入を相談する" })).toHaveAttribute("href", "/#early-access");
    expect(consoleErrors).toEqual([]);
  });

  test("状態遷移のフローチャートが表示される", async ({ page }) => {
    await page.goto("/docs/lifecycle/transitions");
    await expect(page.locator("h1")).toContainText("状態遷移と期限");
    await expect(page.locator('svg[role="img"]:visible')).toHaveCount(1);
  });

  test("英語の LP のヘッダーとフッターから /docs/en/ へ行ける", async ({ page }) => {
    await page.goto("/en/");
    await expect(
      page.locator(".site-nav").getByRole("link", { name: "Docs" })
    ).toHaveAttribute("href", "/docs/en/");
    await expect(
      page.locator(".site-footer").getByRole("link", { name: "Merchant docs" })
    ).toHaveAttribute("href", "/docs/en/");
  });

  test("英語版の概要ページが表示され、コンソールにエラーが出ない", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/docs/en/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(/STBLpay Docs/);
    // ヘッダーの LP の節へのリンクは、英語版の LP を指す
    await expect(page.locator(".navbar").getByRole("link", { name: "Fees", exact: true })).toHaveAttribute("href", "/en/#comparison");
    expect(consoleErrors).toEqual([]);
  });

  test("ロゴから LP へ戻れる", async ({ page }) => {
    await page.goto("/docs/server/create-payment");
    await expect(page.locator(".navbar__brand")).toHaveAttribute("href", "/");
    await page.goto("/docs/en/server/create-payment");
    await expect(page.locator(".navbar__brand")).toHaveAttribute("href", "/en/");
  });

  test("言語の切り替えは LP と同じく、もう一方の言語の同じページへのリンク 1 つ", async ({ page }) => {
    const nav = page.locator(".navbar__inner");
    await page.goto("/docs/lifecycle/transitions");
    await expect(nav.getByRole("link", { name: "EN", exact: true })).toHaveAttribute("href", "/docs/en/lifecycle/transitions/");
    await expect(nav.getByRole("link", { name: "日本語", exact: true })).toHaveCount(0);
    await page.goto("/docs/en/lifecycle/transitions");
    await expect(nav.getByRole("link", { name: "日本語", exact: true })).toHaveAttribute("href", "/docs/lifecycle/transitions/");
    await expect(nav.getByRole("link", { name: "EN", exact: true })).toHaveCount(0);
  });

  test("決済フローのシーケンス図が日英とも描ける（Mermaid の構文エラーが出ない）", async ({ page }) => {
    for (const path of ["/docs/getting-started/payment-flow", "/docs/en/getting-started/payment-flow"]) {
      await page.goto(path);
      const diagram = page.locator(".docusaurus-mermaid-container svg");
      await expect(diagram, path).toHaveCount(1);
      await expect(diagram, path).not.toContainText(/Syntax error|Parse error/);
      await expect(diagram.locator("text.actor").first(), path).toBeVisible();
    }
  });

  test("英語版の状態遷移の図は英語で描かれる", async ({ page }) => {
    await page.goto("/docs/en/lifecycle/transitions");
    const chart = page.locator('svg[role="img"]:visible');
    await expect(chart).toHaveCount(1);
    await expect(chart).toHaveAttribute("aria-label", /^Flowchart of payment status transitions/);
    // 日本語が残っていない（訳し漏れがあると EN に無い文が日本語のまま出る）
    expect(await chart.textContent()).not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
  });

  test("英語版の本文に日本語が残っていない（画面の名前を添えた括弧の中は除く）", async ({ page }) => {
    // 画面は日本語だけなので、英語の後ろに画面の日本語を括弧で添える（例：Store & QR code (お店と QR コード)）。
    // それ以外の場所に日本語があれば訳し漏れ
    const root = fileURLToPath(new URL("../../docs-site/i18n/en/docusaurus-plugin-content-docs/current/", import.meta.url));
    const pages = readdirSync(root, { recursive: true })
      .filter((f) => /\.mdx?$/.test(f))
      .map((f) => `/docs/en/${f.replace(/\.mdx?$/, "").replace(/^overview$/, "")}`);
    expect(pages.length).toBeGreaterThan(30);
    test.setTimeout(pages.length * 5000);
    for (const path of pages) {
      await page.goto(path);
      const text = (await page.locator("article").textContent()).replace(/\((?:[^()]|\([^()]*\))*\)/g, "");
      expect(text, path).not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff「」]/);
    }
  });

  test("REST API リファレンスから OpenAPI の仕様書を取得できる（日英とも）", async ({ page, request }) => {
    for (const path of ["/docs/reference/rest", "/docs/en/reference/rest"]) {
      await page.goto(path);
      const href = await page.locator("article").getByRole("link", { name: "openapi.yaml" }).getAttribute("href");
      const response = await request.get(href);
      expect(response.ok(), `${path} → ${href}`).toBe(true);
      const spec = await response.text();
      expect(spec, `${path} → ${href}`).toMatch(/^openapi: 3\.1\.0$/m);
      // 英語版の docs からは英訳した仕様書を開く。日本語は、サーバーが返す文そのままの例と、国際化ドメイン名の例だけ
      if (path.startsWith("/docs/en/")) {
        expect(spec).toContain("summary: Create a payment");
        const rest = spec.replace(/message: 10 進の非負数|例え\.テスト/g, "");
        expect(rest).not.toMatch(/[\u3040-\u30ff\u4e00-\u9fff]/);
      } else {
        expect(spec).toContain("summary: 決済を作成する");
      }
    }
    // Redoc のページを JS なしで読んでも、本体の yaml へたどれる
    const viewer = await (await request.get("/docs/openapi/")).text();
    expect(viewer).toContain('<a href="../openapi.yaml">openapi.yaml</a>');
    expect(viewer).toContain('<link rel="alternate" type="application/yaml" href="../openapi.yaml">');
    // llms.txt が案内する場所
    expect((await request.get("/docs/openapi.yaml")).ok()).toBe(true);
    expect(await (await request.get("/llms.txt")).text()).toContain("(https://stbl-pay.com/docs/openapi.yaml)");
  });

  test("docs から開く OpenAPI の仕様書（Redoc）で、リンク先の節が表示される（日英とも）", async ({ page }) => {
    for (const [path, name] of [
      ["/docs/reference/rest", "ブラウザーで見る"],
      ["/docs/reference/webhook-events", "ブラウザーで見る"],
      ["/docs/en/reference/rest", "view in the browser"],
      ["/docs/en/reference/webhook-events", "view in the browser"],
    ]) {
      await page.goto(path);
      const hrefs = await page.locator("article a[href*='/openapi/#']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs.length, path).toBeGreaterThan(1);
      const viewer = path.startsWith("/docs/en/") ? "/docs/en/openapi/" : "/docs/openapi/";
      for (const href of hrefs) expect(href, path).toContain(viewer);
      expect(await page.locator("nav a", { hasText: /OpenAPI/ }).getAttribute("href"), path).toBe(viewer);
      // pathname:// のリンクは新しいタブで開くので、href を開く
      await page.goto(await page.locator("article").getByRole("link", { name }).getAttribute("href"));
      // 英語版のビルドでは pathname:/// に /docs/en/ が付くので、英語版の本文からは英語版のビューアーを開く
      expect(new URL(page.url()).pathname, path).toBe(viewer);
      await expect(page.locator("h1")).toContainText("STBLpay API");
      // 英語版のビューアーは英訳した仕様書を描く
      const summary = path.startsWith("/docs/en/") ? "Create a payment" : "決済を作成する";
      await expect(page.getByRole("heading", { name: `operation/createPaymentIntent ${summary}` })).toBeAttached();
      // JS を動かさずに読む AI 向けの案内は、Redoc が描画すると消える
      await expect(page.getByText("AI エージェントは")).toHaveCount(0);
      // 本文のリンクが指す節（operation の id）が、Redoc の画面にある
      for (const href of new Set(hrefs)) {
        await expect(page.locator(`[id="${decodeURIComponent(href.split("#")[1])}"]`).first(), `${path} → ${href}`).toBeAttached();
      }
    }
  });

  test("OpenAPI の英訳の構造検査は、訳してよい文だけを見逃し、例・既定値・const の中の差は止める", () => {
    const ja = {
      info: { contact: { name: "問い合わせ先", url: "https://stbl-pay.com/docs/support/x" } },
      tags: [{ name: "決済", description: "説明" }],
      paths: { "/p": { post: { tags: ["決済"], summary: "作る", responses: { default: { description: "失敗" }, 400: { content: { "application/json": {
        examples: {
          bad: { summary: "例", value: { details: { description: "サーバーの文" } } },
          "foo/bar": { summary: "例", value: { description: "値" } },
        },
      } } } } } } },
      security: [{ tags: ["read"] }],
      components: { links: { L: { operationId: "op", parameters: { payload: { title: "値" } }, requestBody: { description: "値" } } }, schemas: {
        S: { description: "説明", const: { description: "値" }, enum: [{ summary: "値" }], default: "既定", examples: [{ title: "値" }] },
        // プロパティやスキーマの名前が default・responses でも、名前として扱う
        P: { properties: { default: { description: "説明" } }, discriminator: { propertyName: "k", mapping: { description: "#/components/schemas/A" } } },
        responses: { default: { description: "既定", const: { title: "値" }, enum: [{ summary: "値" }] } },
      } },
    };
    const en = structuredClone(ja);
    Object.assign(en.info.contact, { name: "Contact", url: "https://stbl-pay.com/docs/en/support/x" });
    Object.assign(en.tags[0], { name: "Payments", description: "Description" });
    Object.assign(en.paths["/p"].post, { tags: ["Payments"], summary: "Create" });
    en.paths["/p"].post.responses.default.description = "Failure";
    en.paths["/p"].post.responses[400].content["application/json"].examples.bad.summary = "Example";
    en.components.schemas.S.description = "Description";
    en.paths["/p"].post.responses[400].content["application/json"].examples["foo/bar"].summary = "Example";
    en.components.schemas.P.properties.default.description = "Description";
    expect(diffSpecs(ja, en)).toEqual([]);

    for (const change of [
      (s) => { s.paths["/p"].post.responses[400].content["application/json"].examples.bad.value.details.description = "text"; },
      (s) => { s.components.schemas.S.const.description = "value"; },
      (s) => { s.components.schemas.S.default = "default"; },
      (s) => { s.components.schemas.S.enum[0].summary = "value"; },
      (s) => { s.components.links.L.parameters.payload.title = "value"; },
      (s) => { s.components.links.L.requestBody.description = "value"; },
      (s) => { s.security[0].tags = ["write"]; },
      (s) => { s.components.schemas.S.examples[0].title = "value"; },
      (s) => { s.paths["/p"].post.tags = ["Other"]; },
      (s) => { s.info.contact.url = "https://example.com/"; },
      (s) => { delete s.paths["/p"].post.summary; },
      (s) => { s.paths["/p"].post.responses[400].content["application/json"].examples["foo/bar"].value.description = "value"; },
      (s) => { s.components.schemas.P.discriminator.mapping.description = "#/components/schemas/B"; },
      (s) => { s.components.schemas.responses.default.description = "value"; },
      (s) => { s.components.schemas.responses.default.const.title = "value"; },
      (s) => { s.components.schemas.responses.default.enum[0].summary = "value"; },
    ]) {
      const broken = structuredClone(en);
      change(broken);
      expect(diffSpecs(ja, broken), change.toString()).not.toEqual([]);
    }
    // 拡張（x-）は、置いた場所にかかわらず扱わずに止める
    const withExtension = structuredClone(ja);
    withExtension.paths["x-config"] = { description: "値" };
    expect(diffSpecs(withExtension, structuredClone(withExtension))).not.toEqual([]);
  });

  test("_headers の docs 用 CSP に、インラインスクリプトのハッシュが入っている", () => {
    const headers = readFileSync(`${dist}_headers`, "utf8");
    expect(headers).not.toContain("__DOCS_SCRIPT_HASHES__");
    // OpenAPI の仕様書だけ検索結果に載せない
    expect(headers).toMatch(/^\/docs\/openapi\.yaml\n  X-Robots-Tag: noindex$/m);
    expect(headers).toMatch(/^\/docs\/en\/openapi\.yaml\n  X-Robots-Tag: noindex$/m);

    // 概要ページのテーマ切り替えのスクリプトが、CSP のハッシュで許可されている
    const html = readFileSync(`${dist}docs/index.html`, "utf8");
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, body]) => body);
    expect(inline.length).toBeGreaterThan(0);
    for (const body of inline) {
      const hash = createHash("sha256").update(body, "utf8").digest("base64");
      expect(headers).toContain(`'sha256-${hash}'`);
    }
  });
});

test('machine refund draft, signing examples and fixed vectors are available in both locales', async ({page, request}) => {
  for (const locale of ['', 'en/']) {
    await page.goto(`/docs/${locale}refunds/machine-api/`);
    await expect(page.locator('article')).toContainText(locale ? 'draft' : '公開準備中');
    await expect(page.locator('article')).toContainText('details.serverTime');
    await expect(page.locator('article')).toContainText(locale
      ? 'standalone wallet upgrades'
      : '単独のウォレット更新');
    await expect(page.locator('article')).toContainText(locale
      ? 'upgrade to the Registry-designated implementation together with the refund'
      : '返金と同時に Registry が指定した実装へ更新');
    await expect(page.locator('article')).toContainText(locale
      ? 'Approval itself only updates the delegation'
      : '承認操作そのものは委任状だけを更新');
    await page.goto(`/docs/${locale}refunds/signing/`);
    await expect(page.locator('article')).toContainText('PUBLIC TEST ONLY');
    const example = await request.get(`/docs/${locale}examples/refund-signer.mjs`);
    expect(example.ok()).toBeTruthy();
    expect(await example.text()).toContain('export function signRequest');
    const vectors = await request.get(`/docs/${locale}examples/refund-signing-vectors.json`);
    expect(vectors.ok()).toBeTruthy();
    expect((await vectors.json()).warning).toContain('PUBLIC TEST ONLY');
  }
});
