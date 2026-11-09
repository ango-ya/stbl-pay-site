// /learn/payment-fees/ の「総コストを計算する」。計算の結果は手計算した値と照らす。本番の CSP を付け、違反が出ないことも見る。
import { test, expect } from "@playwright/test";
import { CSP } from "./text-rules.mjs";

const PATH = "/learn/payment-fees/";
const ANALYTICS = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;

test.beforeEach(async ({ context, page }) => {
  await context.route(ANALYTICS, (route) => route.abort());
  await context.route((url) => url.hostname === "127.0.0.1" && url.pathname === PATH, async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const headers = { ...response.headers(), "content-security-policy": CSP };
    delete headers["content-length"];
    delete headers["content-encoding"];
    return route.fulfill({ response, body: await response.text(), headers });
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  await page.goto(PATH);
});

const fill = async (page, v) => {
  for (const [k, val] of Object.entries(v)) await page.locator(`#fc-${k}`).fill(val);
};

test("入力どおりに合計と割合を出す（売上 1,000,000・200 件・3.25%・月額 3,000・入金 2 回×250）", async ({ page }) => {
  await fill(page, { sales: "1000000", count: "200", rate: "3.25", fixed: "0", monthly: "3000", payouts: "2", transfer: "250" });
  // 32,500 + 0 + 3,000 + 500 = 36,000 円、36,000 / 1,000,000 = 3.60%
  await expect(page.locator("#fc-total")).toHaveText("36,000 円");
  await expect(page.locator("#fc-ratio")).toHaveText("3.60%");
  await expect(page.locator("#fc-b-rate")).toHaveText("32,500 円");
  await expect(page.locator("#fc-b-monthly")).toHaveText("3,000 円");
  await expect(page.locator("#fc-b-transfer")).toHaveText("500 円");
  await expect(page.locator("#fc-warn")).toBeHidden();
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});

test("空欄は 0 円で、割合は「—」。初期値は空", async ({ page }) => {
  for (const k of ["sales", "count", "rate", "fixed", "monthly", "payouts", "transfer"]) await expect(page.locator(`#fc-${k}`)).toHaveValue("");
  await expect(page.locator("#fc-total")).toHaveText("0 円");
  await expect(page.locator("#fc-ratio")).toHaveText("—");
  // 売上が 0 のまま月額だけ入れても、割合は「—」
  await fill(page, { monthly: "3000" });
  await expect(page.locator("#fc-total")).toHaveText("3,000 円");
  await expect(page.locator("#fc-ratio")).toHaveText("—");
});

test("負の値は 0 として計算し、注意を出す", async ({ page }) => {
  await fill(page, { sales: "100000", rate: "-3", monthly: "1000" });
  await expect(page.locator("#fc-warn")).toBeVisible();
  await expect(page.locator("#fc-warn")).toContainText("決済手数料の料率");
  await expect(page.locator("#fc-b-rate")).toHaveText("0 円");
  await expect(page.locator("#fc-total")).toHaveText("1,000 円");
  await expect(page.locator("#fc-ratio")).toHaveText("1.00%");
  // 直すと注意は消える
  await fill(page, { rate: "3" });
  await expect(page.locator("#fc-warn")).toBeHidden();
  await expect(page.locator("#fc-total")).toHaveText("4,000 円");
});

test("固定の手数料と振込手数料も足す（200 件×40.5 円・入金 3 回×275 円）", async ({ page }) => {
  await fill(page, { sales: "500000", count: "200", rate: "3.6", fixed: "40.5", payouts: "3", transfer: "275" });
  // 18,000 + 8,100 + 0 + 825 = 26,925 円
  await expect(page.locator("#fc-b-rate")).toHaveText("18,000 円");
  await expect(page.locator("#fc-b-fixed")).toHaveText("8,100 円");
  await expect(page.locator("#fc-b-transfer")).toHaveText("825 円");
  await expect(page.locator("#fc-total")).toHaveText("26,925 円");
});

test("1 円未満の四捨五入は十進でずれない（1,500 円×2.3% = 34.5 → 35 円、1,250 円×2.28% = 28.5 → 29 円）", async ({ page }) => {
  await fill(page, { sales: "1500", rate: "2.3" });
  await expect(page.locator("#fc-b-rate")).toHaveText("35 円");
  await fill(page, { sales: "1250", rate: "2.28" });
  await expect(page.locator("#fc-b-rate")).toHaveText("29 円");
});

test("正しくない入力は注意を出し、その欄に aria-invalid と aria-describedby を付ける", async ({ page }) => {
  await expect(page.locator("#fc-result")).toHaveAttribute("role", "status");
  // 数値でない（数値欄に「1e」を打つとブラウザは値を読めない）
  await page.locator("#fc-sales").pressSequentially("1e");
  await expect(page.locator("#fc-warn")).toContainText("月の売上（数値でない）");
  await expect(page.locator("#fc-sales")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#fc-sales")).toHaveAttribute("aria-describedby", "fc-warn");
  await page.locator("#fc-sales").fill("");
  // 件数が小数・料率が負
  await fill(page, { count: "1.5", rate: "-3" });
  await expect(page.locator("#fc-warn")).toContainText("月の決済件数（整数でない）");
  await expect(page.locator("#fc-warn")).toContainText("決済手数料の料率（負の値）");
  for (const k of ["count", "rate"]) await expect(page.locator(`#fc-${k}`)).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#fc-sales")).not.toHaveAttribute("aria-invalid", /.*/);
  // 直すと外れる
  await fill(page, { count: "2", rate: "3" });
  await expect(page.locator("#fc-warn")).toBeHidden();
  for (const k of ["count", "rate"]) {
    await expect(page.locator(`#fc-${k}`)).not.toHaveAttribute("aria-invalid", /.*/);
    await expect(page.locator(`#fc-${k}`)).not.toHaveAttribute("aria-describedby", /.*/);
  }
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});
