import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
    await expect(nav.getByRole("link", { name: "EN", exact: true })).toHaveAttribute("href", "/docs/en/lifecycle/transitions");
    await expect(nav.getByRole("link", { name: "日本語", exact: true })).toHaveCount(0);
    await page.goto("/docs/en/lifecycle/transitions");
    await expect(nav.getByRole("link", { name: "日本語", exact: true })).toHaveAttribute("href", "/docs/lifecycle/transitions");
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
      expect(await response.text(), `${path} → ${href}`).toMatch(/^openapi: 3\.1\.0$/m);
    }
    // llms.txt が案内する場所
    expect((await request.get("/docs/openapi.yaml")).ok()).toBe(true);
    expect(await (await request.get("/llms.txt")).text()).toContain("(/docs/openapi.yaml)");
  });

  test("_headers の docs 用 CSP に、インラインスクリプトのハッシュが入っている", () => {
    const headers = readFileSync(`${dist}_headers`, "utf8");
    expect(headers).not.toContain("__DOCS_SCRIPT_HASHES__");

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
