import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { diffSpecs } from "../../scripts/openapi-parity.mjs";

// 加盟店向けドキュメント（/docs/・docs-site のビルド結果）

// Playwright の変換器に docs-site の tsconfig を解決させず、同サイトの YAML parser を使う。
function readOpenApiSpec(path) {
  const script = `
    import {createRequire} from "node:module";
    import {readFileSync} from "node:fs";
    const yaml = createRequire(new URL("./docs-site/package.json", \`file://\${process.cwd()}/\`))("js-yaml");
    console.log(JSON.stringify(yaml.load(readFileSync(process.argv[1], "utf8"))));
  `;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script, fileURLToPath(new URL(path, import.meta.url))], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    encoding: "utf8",
  }));
}
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
    await expect(page.locator(".navbar").getByRole("link", { name: "決済を学ぶ", exact: true })).toHaveAttribute("href", "/learn/");
    expect(consoleErrors).toEqual([]);
  });

  test("スマホのメニューが画面の高さで開き、決済を学ぶ へ進める", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/docs/");
    await page.locator(".navbar__toggle").click();
    // docs のページでは docs の目次から開く。ヘッダーの項目は「メインメニューに戻る」の先
    const back = page.locator(".navbar-sidebar__back");
    await expect(back).toBeVisible();
    await back.click();
    // ヘッダーの backdrop-filter に閉じ込められると、メニューの高さがヘッダーと同じ（60px ほど）になる
    expect((await page.locator(".navbar-sidebar").boundingBox()).height).toBeGreaterThan(400);
    await page.locator(".navbar-sidebar").getByRole("link", { name: "決済を学ぶ", exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/$/);
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
    await expect(page.locator(".navbar").getByRole("link", { name: "Guides", exact: true })).toHaveAttribute("href", "/en/learn/");
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
        const rest = spec.replace(/^\s*(?:message|failureReason):.*$/gm, "").replace(/例え\.テスト/g, "");
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
    withExtension.paths["/p"].post["x-config"] = { description: "値" };
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

for (const locale of ['', 'en/']) {
 test(`authenticated payment lookup renders (${locale || 'ja'})`, async ({page}) => {
  await page.goto(`/docs/${locale}server/retrieve-payment/`);
  await expect(page.locator('article')).toContainText('/payments/');
  await expect(page.locator('article')).toContainText('x-stbl-api-key');
  await page.goto(`/docs/${locale}reference/webhook-events/`);
  await expect(page.locator('article')).toContainText('payer_address');
  await expect(page.locator('article')).toContainText('net_amount_destination');
 });

 // GET /payments（backend#228）は 2026-11-21 に dev で 200 を確かめ、Sandbox でも存在しない経路が
 // 404 common/not_found のところ /payments は 401 auth/api_key_invalid（経路が登録済み）だった。
 // 配備前の注記と、代わりに認証なしの照会を使う案内を、照会のページから消す。
 // Webhook の 2 キーの注記は、通知の中身をまだ確かめていないので残す。
 test(`payment lookup pages no longer say GET /payments is undeployed (${locale || 'ja'})`, async ({page}) => {
  const notice = locale ? 'not yet deployed to Sandbox' : 'Sandbox への配備前';
  await page.goto(`/docs/${locale}server/retrieve-payment/`);
  await expect(page.locator('article')).not.toContainText(notice);
  // スキーマ名（PaymentLookupResponse）を本文の探し先にせず、OpenAPI の 200 応答へ案内する
  await expect(page.locator('article')).not.toContainText('PaymentLookupResponse');
  await page.goto(`/docs/${locale}getting-started/quickstart/`);
  await expect(page.locator('article')).not.toContainText(notice);
  await expect(page.locator('article')).not.toContainText('/payment_status/');
  await page.goto(`/docs/${locale}reference/rest/`);
  await expect(page.locator('article')).not.toContainText(notice);
  // 照会の行と「状態照会」の節は getPayment を指す
  await expect(page.locator('a[href$="#operation/getPayment"]')).toHaveCount(2);
  // 状態の値の一覧と failedReason の分類コードの表は getPaymentStatus の応答（PaymentStatusView）にだけあるので、
  // その 2 つのリンクは getPaymentStatus を指したままにする（getPayment の応答には表が無い）
  await expect(page.locator('a[href$="#operation/getPaymentStatus"]')).toHaveCount(2);
  await page.goto(`/docs/${locale}reference/webhook-events/`);
  await expect(page.locator('article')).toContainText(notice);
 });

 // 加盟店サーバーの照会先が GET /payments に替わったあとも、認証なしの旧い API を前提にした
 // 記述が 4 ページに残っていた（stbl-pay#699）。文言の全文ではなく、旧記述が無いことと、
 // 新しい照会先・エラーコードが出ていることだけを確かめる。
 test(`merchant-server lookup guidance points at GET /payments (${locale || 'ja'})`, async ({page}) => {
  await page.goto(`/docs/${locale}getting-started/payment-flow/`);
  // シーケンス図（Mermaid の SVG）の中の文字列も article に含まれる。
  await expect(page.locator('article')).toContainText('GET /payments/{paymentIntentId}');
  // 図の中にも図の下にも、旧い照会先を描かない（GET /payments は Sandbox に配備済み）
  await expect(page.locator('article svg').first()).not.toContainText('payment_status');
  await expect(page.locator('article')).not.toContainText(locale ? 'not yet deployed to Sandbox' : 'Sandbox への配備前');
  await expect(page.locator('article')).not.toContainText('/payment_status/');

  await page.goto(`/docs/${locale}lifecycle/completion/`);
  await expect(page.locator('article')).toContainText('GET /payments/');
  await expect(page.locator('article')).not.toContainText(locale ? 'the status API' : 'ステータス確認 API');
  await expect(page.locator('article')).not.toContainText(locale ? 'has no amounts' : '金額がない');

  await page.goto(`/docs/${locale}support/faq/`);
  await expect(page.locator('article')).toContainText('GET /payments/');
  await expect(page.locator('article')).not.toContainText(locale
   ? 'does not return the amount'
   : '金額・手数料を返しません');

  await page.goto(`/docs/${locale}testing/scenarios/`);
  const scenarios = page.locator('article');
  await expect(scenarios).toContainText('GET /payments/');
  await expect(scenarios).toContainText('auth/api_key_invalid');
  await expect(scenarios).toContainText('common/not_found');
  await expect(scenarios).not.toContainText(locale ? 'without an authentication header' : '認証ヘッダなし');
  // GET /payments は Sandbox に配備済みなので、この節の項目を未検証として記録させる注記は出さない
  await expect(scenarios).not.toContainText(locale ? 'not yet deployed to Sandbox' : 'Sandbox への配備前');
 });
}

for (const locale of ["ja", "en"]) {
  const prefix = locale === "ja" ? "/docs" : "/docs/en";
  const specPath = locale === "ja" ? "../../docs-site/static/openapi.yaml" : "../../docs-site/i18n/en/openapi.yaml";
  test(`${locale}: 決済と返金のoperationがタグ配下で順に表示される`, async ({page}) => {
    const spec = readOpenApiSpec(specPath);
    const operations = Object.values(spec.paths).flatMap(Object.values);
    test.setTimeout(90000);
    const ids = ["getMachineRefundable", "prepareMachineRefund", "submitMachineRefund", "getMachineRefund", "listMachinePaymentRefunds", "discardMachineStagedOperation"];
    await page.goto(`${prefix}/openapi/`);
    for (const id of ["getPayment", ...ids]) {
      const operation = operations.find(value => value.operationId === id);
      const section = page.locator(`[id="operation/${id}"]`);
      const heading = section.getByRole("heading", {level:2}).first();
      await expect(heading).toContainText(operation.summary);
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      const tag = id === "getPayment" ? (locale === "ja" ? "決済" : "Payments") : (locale === "ja" ? "返金" : "Refunds");
      const tagBefore = await section.evaluate((element, expected) => element.parentElement.id === expected, `tag/${tag}/operation/${id}`);
      expect(tagBefore, `${id} under ${tag}`).toBe(true);
    }
    const shown = await page.locator('[id^="operation/"]').evaluateAll(elements => elements.map(element => element.id.slice(10)));
    expect(shown.filter(id => ids.includes(id))).toEqual(ids);
  });

  test(`${locale}: RESTと返金フローの実リンクからoperationを開き直リンクとリロードでも表示できる`, async ({page, context}) => {
    test.setTimeout(300000);
    for (const source of ["reference/rest", "refunds/machine-api"]) {
      await page.goto(`${prefix}/${source}`);
      const links = page.locator('article a[href*="/openapi/#operation/"]');
      const hrefs = [...new Set(await links.evaluateAll(elements => elements.map(element => element.getAttribute("href"))))];
      expect(hrefs.length).toBeGreaterThanOrEqual(source === "reference/rest" ? 7 : 6);
      for (const href of hrefs) {
        expect(href).toContain(`${prefix}/openapi/#operation/`);
        const anchor = page.locator(`article a[href="${href}"]`).first();
        const [viewer] = await Promise.all([context.waitForEvent("page"), anchor.click()]);
        await viewer.waitForLoadState();
        const hash = new URL(href, page.url()).hash;
        expect(new URL(href, page.url()).hash).toMatch(/^#operation\//);
        const id = hash.split("/").pop();
        const tag = ["createPaymentIntent", "getPaymentStatus", "getPayment"].includes(id) ? (locale === "ja" ? "決済" : "Payments") : (locale === "ja" ? "返金" : "Refunds");
        await expect.poll(() => decodeURIComponent(new URL(viewer.url()).hash)).toBe(`#tag/${tag}/operation/${id}`);
        const heading = viewer.locator(`[id="${hash.slice(1)}"]`).getByRole("heading").first();
        await expect(heading).toBeVisible();
        await expect(heading).toBeInViewport();
        await viewer.reload();
        await expect.poll(() => decodeURIComponent(new URL(viewer.url()).hash)).toBe(`#tag/${tag}/operation/${id}`);
        await expect(heading).toBeInViewport();
        await viewer.goto('about:blank');
        await viewer.goto(href);
        await expect.poll(() => decodeURIComponent(new URL(viewer.url()).hash)).toBe(`#tag/${tag}/operation/${id}`);
        await expect(heading).toBeInViewport();
        await viewer.close();
      }
    }
  });
}

test.describe("REST リファレンスのエンドポイント一覧", () => {
  const pages = [
    { path: "/docs/reference/rest/", link: "決済を照会する" },
    { path: "/docs/en/reference/rest/", link: "Look up a payment" },
  ];

  for (const { path, link } of pages) {
    test(`${path}: iPhone 幅では横スクロールせず、用途のリンクが先に見える`, async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 852 });
      await page.goto(path);
      const table = page.locator(".endpoint-table table");
      const { scrollWidth, clientWidth } = await table.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      const box = await page.locator(".endpoint-table").getByRole("link", { name: link }).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(393);

      const first = table.locator("tbody tr").first();
      const purposeTop = (await first.locator("td").nth(3).boundingBox()).y;
      const methodTop = (await first.locator("td").nth(0).boundingBox()).y;
      expect(purposeTop).toBeLessThan(methodTop);
    });

    test(`${path}: PC 幅では見出しがあり 1 行に 4 列が並ぶ`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path);
      const table = page.locator(".endpoint-table table");
      await expect(table.locator("thead")).toBeVisible();
      const tops = await table.locator("tbody tr").first().locator("td").evaluateAll((tds) => tds.map((td) => Math.round(td.getBoundingClientRect().top)));
      expect(tops).toHaveLength(4);
      expect(new Set(tops).size).toBe(1);
    });
  }
});
