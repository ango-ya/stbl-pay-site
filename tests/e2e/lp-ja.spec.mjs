import { test, expect } from "@playwright/test";

test.describe("日本語LP FAQ JSON-LD 同期テスト", () => {
  test("FAQPage JSON-LD mirrors the visible FAQ questions", async ({
    page,
  }) => {
    await page.goto("/");

    // 構造化データは可視コンテンツの鏡であること（docs/lp-geo-seo.md 運用ルール）
    const visible = await page.locator("#faq details summary").allTextContents();
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
});
