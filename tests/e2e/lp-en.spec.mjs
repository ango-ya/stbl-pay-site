import { test, expect } from "@playwright/test";

test.describe("日本語LPのフォーム文言（回帰ガード）", () => {
  test("空送信で日本語のバリデーション文言が出る", async ({ page }) => {
    await page.goto("/");
    await page.locator(".early-form button[type='submit']").click();
    await expect(page.locator("[data-early-state]")).toHaveText(
      "会社名をご記入ください。"
    );
  });
});

test.describe("英語LP", () => {
  test("英語LPが lang=en で表示される", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#hero-title")).toHaveText(
      "Pay in yen. Settle in stablecoin."
    );
  });

  test("空送信で英語のバリデーション文言が出る", async ({ page }) => {
    await page.goto("/en/");
    await page.locator(".early-form button[type='submit']").click();
    await expect(page.locator("[data-early-state]")).toHaveText(
      "Please enter your company name."
    );
  });

  test("JSON-LD が英語FAQを持ち構文エラーがない", async ({ page }) => {
    await page.goto("/en/");
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    const data = JSON.parse(raw);
    const faq = data["@graph"].find((n) => n["@type"] === "FAQPage");
    expect(faq.inLanguage).toBe("en");
    expect(faq.mainEntity.length).toBe(14);
  });
});

test.describe("言語切替とhreflang", () => {
  test("日本語→英語→日本語のリンクが相互に張られている", async ({ page }) => {
    await page.goto("/");
    const toEn = page.locator('.site-nav a[href="/en/"]');
    await expect(toEn).toHaveText("EN");
    await page.goto("/en/");
    const toJa = page.locator('.site-nav a[href="/"]');
    await expect(toJa).toHaveText("日本語");
  });

  test("両ページに hreflang が3行ずつあり x-default が / を指す", async ({ page }) => {
    for (const path of ["/", "/en/"]) {
      await page.goto(path);
      await expect(
        page.locator('link[rel="alternate"][hreflang="ja"]')
      ).toHaveAttribute("href", "https://stbl-pay.com/");
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]')
      ).toHaveAttribute("href", "https://stbl-pay.com/en/");
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]')
      ).toHaveAttribute("href", "https://stbl-pay.com/");
    }
  });
});
