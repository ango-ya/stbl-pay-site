// 回帰テスト: パスキー後に「最初のカート画面」へ即バウンスしてしまう不具合
// ------------------------------------------------------------------
// 原因: JPYC EX ページの「リロード復路」ガードが sessionStorage の
// `jpyc-ex-shown` を見て発火するが、このフラグは振込先案内画面を
// 「リロード以外」（戻るボタン・ブラウザバック等）で離脱すると残留する。
// 次の周回でパスキー成功 → post-reservation で JPYC EX を再訪した瞬間、
// ガードが残留フラグで誤発火し、振込先案内を描かずに /demo?status=received
// へ location.replace してしまっていた（＝パスキー後に最初のページへ戻る）。
// 修正後は「実際のリロード時のみ」復路し、それ以外の遷移では残留フラグを
// 掃除するため、パスキー後は必ず振込先案内へ進む。
import { test, expect } from "@playwright/test";

test.describe("パスキー後の振込先案内への到達（回帰）", () => {
  // 2周目（リピーター）状態を作るヘルパ。eKYC・銀行口座登録済みにして
  // パスキー → 振込先案内 まで最短で到達させる。
  async function seedReturning(page) {
    await page.goto("/demo");
    await page.evaluate(() => {
      localStorage.setItem("pay-mock-enrolled", "1");
      localStorage.setItem("jpyc-demo-profile-v2", JSON.stringify({
        jpycExAccount: { email: "yamada@example.com" },
        kycCompleted: true,
        bankRegistered: true,
        bankInfo: { bank: "みずほ銀行", branch: "渋谷支店", type: "普通", accountNumber: "***4567", holder: "ヤマダ タロウ" },
      }));
    });
    await page.reload();
    await expect(page.locator("#accountBadge")).toHaveText("登録済み・2回目以降");
  }

  // カート → パスキー確定 → JPYC EX 振込先案内、までを1周分進める。
  async function payToTransferInfo(page) {
    await page.locator("#openJpyc").click();
    await page.locator("#payBtn").click();
    await expect(page.locator("#passkeyConfirm")).toHaveText("認証する");
    await page.locator("#passkeyConfirm").click();
    await expect(page).toHaveURL(/jpyc-ex\.html\?.*mode=post-reservation/, { timeout: 8000 });
    await expect(page.locator("h1")).toHaveText("振込先のご案内", { timeout: 6000 });
  }

  test("振込先案内をリロード以外で離脱した次の周回でも、パスキー後は振込先案内に着く", async ({ page }) => {
    await seedReturning(page);

    // 1周目: 振込先案内まで到達（ここで sessionStorage[jpyc-ex-shown] がセットされる）
    await payToTransferInfo(page);

    // リロードではなくブラウザバックでカートへ戻る（フラグが残るケースを再現）
    await page.goBack();                       // → pay.html
    await page.goBack();                       // → /demo（カート）
    await expect(page.locator("h1.cart-title")).toHaveText("カート");
    // 残留フラグの存在を明示的に確認（この時点では消えていない）
    const flagStillSet = await page.evaluate(() => sessionStorage.getItem("jpyc-ex-shown"));
    expect(flagStillSet).toBe("1");

    // 2周目: パスキー確定後、最初のカート画面へバウンスせず振込先案内へ進むこと
    await page.locator("#openJpyc").click();
    await page.locator("#payBtn").click();
    await expect(page.locator("#passkeyConfirm")).toHaveText("認証する");
    await page.locator("#passkeyConfirm").click();

    // 修正前はここで /demo?status=received に replace されていた（回帰の核心）
    await expect(page).toHaveURL(/jpyc-ex\.html\?.*mode=post-reservation/, { timeout: 8000 });
    await expect(page).not.toHaveURL(/\/demo/);
    await expect(page.locator("h1")).toHaveText("振込先のご案内", { timeout: 6000 });
  });

  test("正常系: 振込先案内を実際にリロードした時だけカート画面へ復帰する", async ({ page }) => {
    await seedReturning(page);
    await payToTransferInfo(page);

    // 振込先案内画面をリロード → EC カート（受付演出 ?status=received）へ復帰
    await page.reload();
    await expect(page).toHaveURL(/\/demo\/?$/);
    await expect(page.locator("h1.cart-title")).toHaveText("カート");
    // 復帰時に残留フラグは掃除されている
    const flagAfter = await page.evaluate(() => sessionStorage.getItem("jpyc-ex-shown"));
    expect(flagAfter).toBeNull();
  });
});
