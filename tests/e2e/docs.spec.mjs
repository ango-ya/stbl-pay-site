import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
    // LP へ戻るリンクは /docs/ を付けずにサイトのトップを指す
    await expect(page.getByRole("link", { name: "トップ" })).toHaveAttribute("href", "/");
    expect(consoleErrors).toEqual([]);
  });

  test("状態遷移のフローチャートが表示される", async ({ page }) => {
    await page.goto("/docs/lifecycle/transitions");
    await expect(page.locator("h1")).toContainText("状態遷移と期限");
    await expect(page.locator('svg[role="img"]:visible')).toHaveCount(1);
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
