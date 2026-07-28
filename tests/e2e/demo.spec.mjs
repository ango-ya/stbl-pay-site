// JPYCかんたん決済デモ — E2E（ヘッドレスブラウザ）
// カート起点フロー・決済1画面化・振込先案内・旧ブラウザ警告・ツールチップを検証する。
import { test, expect } from "@playwright/test";

test.describe("カート（§3.1）", () => {
  test("Google Analytics loader hooks are present for the configured measurement id", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.locator('meta[name="google-analytics-id"]')).toHaveAttribute("content", "G-QEPQ7VY0Z2");
    await expect(page.locator('script[src="/assets/analytics.js"]')).toHaveCount(1);
    const hasGtag = await page.evaluate(() => typeof window.gtag === "function");
    expect(hasGtag).toBe(true);
  });

  test("初期表示はカートに商品が並んだ状態（カート起点フロー）", async ({ page }) => {
    await page.goto("/demo");

    // カートページとして表示される（商品詳細・カートに追加は存在しない）
    await expect(page.locator("h1.cart-title")).toHaveText("カート");
    await expect(page.locator(".add-to-cart")).toHaveCount(0);

    // すてぶるペイの説明（LP 準拠文言）は ⓘ ホバーで表示
    const accountTip = page.locator(".account-status .tip");
    await expect(accountTip.locator(".tip-bubble")).toBeHidden();
    await accountTip.hover();
    await expect(accountTip.locator(".tip-bubble")).toBeVisible();
    await expect(accountTip.locator(".tip-bubble")).toContainText("銀行振込から使える JPY ステーブルコイン決済");
    await expect(accountTip.locator(".tip-bubble")).toContainText("いつもの支払い感覚");

    // 既定カート: 電子書籍 + 動画コース + 素材データ（デジタルコンテンツのみ）= ¥5,440
    await expect(page.locator(".cart-row")).toHaveCount(3);
    await expect(page.locator(".cart-row[data-sku='ebook'] .num")).toHaveText("1");
    await expect(page.locator(".cart-row .cart-thumb")).toHaveCount(3);
    await expect(page.locator("#sumTotal")).toHaveText("¥5,440");
    await expect(page.locator("#cartCount")).toHaveText("3");
    await expect(page.locator("#openJpyc")).toBeEnabled();
    await expect(page.locator("#openJpyc")).toHaveAccessibleName("すてぶるペイで銀行振込をする");
    await expect(page.locator("#openJpyc .btn-jpyc-text")).toHaveText("で銀行振込をする");
  });

  test("ヘッダーからLPへ遷移できる", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.getByRole("link", { name: "STBLpayについて" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "すてぶるペイとは" })).toBeVisible();
    await page.getByRole("link", { name: "すてぶるペイとは" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#hero-title")).toHaveText("円を使って、ステーブルで払う。");
  });

  test("旧URL demo.html は /demo に正規化される", async ({ page }) => {
    await page.goto("/demo.html");

    await expect(page.locator("h1.cart-title")).toHaveText("カート");
    await expect(page).toHaveURL(/\/demo$/);
  });

  test("数量変更・削除で合計とヘッダー件数が整合する", async ({ page }) => {
    await page.goto("/demo");

    // カート内で数量を増やす
    await page.locator(".cart-row[data-sku='ebook'] .cart-plus").click();
    await expect(page.locator(".cart-row[data-sku='ebook'] .num")).toHaveText("2");
    await expect(page.locator("#cartCount")).toHaveText("4");
    await expect(page.locator("#sumTotal")).toHaveText("¥6,920");

    // 減らす・削除する
    await page.locator(".cart-row[data-sku='ebook'] .cart-minus").click();
    await expect(page.locator("#sumTotal")).toHaveText("¥5,440");
    await page.locator(".cart-row[data-sku='preset'] .cart-remove").click();
    await expect(page.locator("#sumTotal")).toHaveText("¥4,460");
    await expect(page.locator("#cartCount")).toHaveText("2");
  });

  test("カートはリロードしても保持され、空にした状態も維持される", async ({ page }) => {
    await page.goto("/demo");
    await page.locator(".cart-row[data-sku='ebook'] .cart-plus").click();
    await page.reload();
    await expect(page.locator("#cartCount")).toHaveText("4");
    await expect(page.locator("#sumTotal")).toHaveText("¥6,920");

    // 全部削除して空にする → リロードしても既定カートは復活しない
    await page.locator(".cart-row[data-sku='ebook'] .cart-remove").click();
    await page.locator(".cart-row[data-sku='video'] .cart-remove").click();
    await page.locator(".cart-row[data-sku='preset'] .cart-remove").click();
    await expect(page.locator("#cartItems .cart-empty")).toBeVisible();
    await expect(page.locator("#openJpyc")).toBeDisabled();
    await page.reload();
    await expect(page.locator("#cartItems .cart-empty")).toBeVisible();
    await expect(page.locator("#cartCount")).toHaveText("0");
  });

  test("最低支払額: 3,000円未満では決済ボタンが無効になり案内が出る", async ({ page }) => {
    await page.goto("/demo");

    // 既定カート ¥5,440 → 有効・案内なし
    await expect(page.locator("#openJpyc")).toBeEnabled();
    await expect(page.locator("#minPayNote")).toBeHidden();
    // 文言はお支払い方法欄に常時表示
    await expect(page.locator(".fee-note")).toContainText("最低お支払い金額は 3,000 円");

    // 電子書籍と素材データを削除して ¥2,980（3,000円未満）→ 無効・案内表示
    await page.locator(".cart-row[data-sku='ebook'] .cart-remove").click();
    await page.locator(".cart-row[data-sku='preset'] .cart-remove").click();
    await expect(page.locator("#sumTotal")).toHaveText("¥2,980");
    await expect(page.locator("#openJpyc")).toBeDisabled();
    await expect(page.locator("#minPayNote")).toBeVisible();
    await expect(page.locator("#minPayNote")).toContainText("最低お支払い金額は 3,000 円");

    // 数量を増やして ¥5,960 → 再び有効
    await page.locator(".cart-row[data-sku='video'] .cart-plus").click();
    await expect(page.locator("#sumTotal")).toHaveText("¥5,960");
    await expect(page.locator("#openJpyc")).toBeEnabled();
    await expect(page.locator("#minPayNote")).toBeHidden();
  });

  test("デモリセットで初期のカート入り状態へ戻る", async ({ page }) => {
    await page.goto("/demo");
    await page.locator(".cart-row[data-sku='video'] .cart-remove").click();
    await expect(page.locator(".cart-row")).toHaveCount(2);
    await page.locator("#resetDemo").click();
    await expect(page.locator(".cart-row")).toHaveCount(3);
    await expect(page.locator("#sumTotal")).toHaveText("¥5,440");
  });
});

test.describe("決済画面の1画面化（§3.6）", () => {
  test("初回フロー: カート → 開設案内 → JPYC EX開設 → 決済確認&認証 → 振込先案内 → ECへ復帰・注文確定", async ({ page }) => {
    await page.goto("/demo");

    // 既定カート（3商品・¥5,440）のまま決済開始
    await page.locator("#openJpyc").click();

    // pay.html ①: JPYC EX アカウント開設のご案内（決済確認ではなく開設が主役）
    await expect(page).toHaveURL(/pay\.html\?payment_intent_id=pi_[0-9a-f]{12}/);
    await expect(page.locator("h1")).toHaveText("JPYC EX アカウント開設のご案内");
    // なぜ開設が必要か（JPYCで支払う／ご自身のJPYC EXアカウントで銀行振込で発行）が分かる
    await expect(page.locator("#payNote")).toContainText("ご自身の JPYC EX アカウント");
    await expect(page.locator("#payNote")).toContainText("銀行振込により発行");
    await expect(page.locator("#payNote")).toContainText("初回のみ");
    await expect(page.locator("#payNote .ex-note-logo")).toBeVisible(); // JPYC EX ロゴ埋め込み
    // 開設は3ステップ
    await expect(page.locator(".guide-steps li")).toHaveCount(3);
    await expect(page.locator(".guide-note")).toContainText("3 ステップ");
    // 支払い先・金額は小さく文脈として添える（大きな確定金額・残高内訳は出さない）
    await expect(page.locator(".pay-merchant")).toContainText("¥5,440");
    await expect(page.locator(".order-amount")).toHaveCount(0);
    await expect(page.locator(".wallet-balance")).toHaveCount(0);
    // 開設案内のCTA。パスキー（決済認証）はここでは行わない
    await expect(page.locator("#guideBtn .pay-cta-label")).toHaveText("JPYC EX アカウント開設を始める");
    await expect(page.locator("#payBtn")).toHaveCount(0);

    // CTA押下 → パスキーを挟まず直接 JPYC EX 開設フロー（アカウント作成）へ
    await page.locator("#guideBtn").click();
    await expect(page.locator("#passkeyDialog")).toBeHidden();
    await expect(page).toHaveURL(/jpyc-ex\.html/, { timeout: 5000 });
    await expect(page.locator("h1")).toHaveText("JPYC EX アカウント作成");
    await expect(page.locator(".ex-sub")).not.toContainText("すてぶるペイ");
    await expect(page.locator(".ex-sub")).not.toContainText("決済");
    // 既定はパスキー方式。作成ボタンで決済サイトと同じ Touch ID モーダルが出る
    await page.locator("#signupBtn").click();
    await expect(page.locator("#passkeyDialog")).toBeVisible();
    await expect(page.locator("#passkeyConfirm")).toHaveText("登録する");
    await page.locator("#passkeyConfirm").click();
    await expect(page.locator("h1")).toHaveText("本人確認 (eKYC)");
    await page.locator("#kycSim").click();
    await expect(page.locator("h1")).toHaveText("送金元銀行口座の登録", { timeout: 6000 });
    await page.locator("#bankBtn").click();

    // pay.html ③: 開設完了（＝認証確認）を伝えたうえで、決済確認＆パスキーで確定する
    await expect(page).toHaveURL(/pay\.html\?.*jpyc_ex_auth=pending/, { timeout: 5000 });
    await expect(page.locator("h1")).toHaveText("お支払い内容の確認");
    await expect(page.locator(".pay-done-banner")).toContainText("JPYC EX アカウントの開設が完了しました");
    await expect(page.locator(".order-amount")).toHaveText("¥5,440");
    await expect(page.locator(".order-total")).toContainText("合計お支払い金額");
    await expect(page.locator(".wallet-balance").nth(0)).toContainText("JPYC残高");
    await expect(page.locator(".wallet-balance").nth(0)).toContainText("0 JPYC");
    await expect(page.locator(".wallet-balance").nth(1)).toContainText("JPYC発行申請金額");
    await expect(page.locator(".wallet-balance").nth(1)).toContainText("¥5,440");
    await expect(page.locator("#payNote")).toContainText("次に JPYC EX で振込先をご案内します");
    await expect(page.locator("#payNote")).not.toContainText("callback");
    await expect(page.locator("#payNote")).not.toContainText("HMAC");
    await expect(page.locator("#payNote")).not.toContainText("アクセストークン");
    await expect(page.locator("#payBtn .pay-cta-label")).toHaveText("銀行振込でJPYC支払い ¥5,440");
    await expect(page.locator(".trust-note")).toContainText("送信されません");
    await expect(page.locator(".powered")).toContainText("Powered by すてぶるペイ");

    // 確定ボタン押下 → Touch ID（モック）が直接起動。初回はパスキーの「登録」表示
    await page.locator("#payBtn").click();
    await expect(page.locator("#passkeyDialog")).toBeVisible();
    await expect(page.locator("#passkeyTitle")).toHaveText("パスワードなしでログイン");
    await expect(page.locator("#passkeyDesc")).toContainText("パスキーというパスワードに代わる簡単で安全な");
    await expect(page.locator("#passkeyConfirm")).toHaveText("登録する");
    await page.locator("#passkeyConfirm").click();

    // 同一画面内で完了表示（ボタンがチェックにモーフ）→ そのまま JPYC EX 振込ページへ遷移
    await expect(page.locator("#payBtn")).toHaveClass(/success/);
    await expect(page.locator("#payStatus")).toBeEmpty();
    await expect(page).toHaveURL(/jpyc-ex\.html\?.*mode=post-reservation/, { timeout: 8000 });

    // 予約 API 実行後は、開設時に eKYC と銀行口座登録が済んでいるため振込先案内へ進む
    await expect(page.locator("h1")).toHaveText("振込先のご案内", { timeout: 6000 });

    // 振込ページ到達の約2秒後に案内ポップアップ（本文のみ）が表示される
    await expect(page.locator("#transferNoticeDialog")).toBeVisible({ timeout: 6000 });
    await expect(page.locator("#transferNoticeDesc")).toContainText("JPYC の発行からお支払いまで自動で完了します");
    // 背景タップで閉じられる（確認ボタンは無い）
    await page.locator("#transferNoticeDialog").click();
    await expect(page.locator("#transferNoticeDialog")).toBeHidden();

    // 振込先案内（§3.6.6）: 金額ヒーロー・フィールド別コピー・入金確認の予告
    await expect(page.locator(".transfer-amount .v")).toHaveText("¥5,440");
    expect(await page.locator(".bank-details .btn-copy").count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator(".bank-details.secure")).toBeVisible();

    // コピー操作のフィードバック
    const copyBtn = page.locator(".bank-details .btn-copy").first();
    await copyBtn.click();
    await expect(copyBtn).toHaveText("コピー完了");

    // 「ECサイトに戻る」ボタンは置かず、リロードで EC サイト（カート画面）へ戻る
    await expect(page.locator("#returnEC")).toHaveCount(0);
    await expect(page.locator(".reload-hint")).toContainText("再読み込みすると EC サイトのカート画面に戻ります");
    await page.reload();
    await expect(page).toHaveURL(/\/demo\/?$/);
    // 受付・確定などの文言は表示せず、通常のカート画面（既定カート）として表示される
    await expect(page.locator("body")).not.toContainText("受け付けました");
    await expect(page.locator("body")).not.toContainText("ご注文が確定しました");
    await expect(page.locator("#cartCount")).toHaveText("3");
    await expect(page.locator("#sumTotal")).toHaveText("¥5,440");
    await expect(page.locator("#openJpyc")).toBeEnabled();

    // そのまま2周目（リピーター）を開始できる
    await page.locator("#openJpyc").click();
    await expect(page.locator("#payBtn .pay-cta-label")).toHaveText("銀行振込でJPYC発行申請 ¥4,440");
  });

  test("2回目フロー: ログイン認証を挟まず、確認画面から振込先案内へ直接進む", async ({ page }) => {
    // 登録済み状態を事前セット
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

    // 既定カート（¥5,440）のまま決済開始
    await page.locator("#openJpyc").click();

    // 2回目は JPYC 残高を充当し、不足分だけ JPYC EX で発行申請する
    await expect(page.locator("#payNote")).toBeVisible();
    await expect(page.locator(".order-amount")).toHaveText("¥5,440");
    await expect(page.locator(".order-total")).toContainText("合計お支払い金額");
    await expect(page.locator(".wallet-balance").nth(0)).toContainText("JPYC残高");
    await expect(page.locator(".wallet-balance").nth(0)).toContainText("1,000 JPYC");
    await expect(page.locator(".wallet-balance").nth(1)).toContainText("不足分のJPYC発行申請");
    await expect(page.locator(".wallet-balance").nth(1)).toContainText("¥4,440");
    await expect(page.locator("#payNote")).toContainText("次に JPYC EX で振込先をご案内します");
    await expect(page.locator("#payNote")).not.toContainText("発行申請予約を作成します");
    await expect(page.locator("#payNote")).not.toContainText("初回のみ");
    await expect(page.locator("#payNote")).not.toContainText("JPYC EX アカウント作成");
    await expect(page.locator("#payNote")).not.toContainText("登録済みのため");
    await expect(page.locator("#payNote .ex-note-logo")).toBeVisible();
    await expect(page.locator("#payBtn .pay-cta-label")).toHaveText("銀行振込でJPYC発行申請 ¥4,440");

    await page.locator("#payBtn").click();
    // 2回目は登録済みパスキーでの認証表示になる
    await expect(page.locator("#passkeyTitle")).toHaveText("パスワードなしでログイン");
    await expect(page.locator("#passkeyDesc")).toContainText("パスキーというパスワードに代わる簡単で安全な");
    await expect(page.locator("#passkeyConfirm")).toHaveText("認証する");
    await page.locator("#passkeyConfirm").click();
    await expect(page.locator("#payStatus")).toBeEmpty();

    // 2周目以降は JPYC EX ログイン認証・認証確認を挟まず、振込先案内へ直接遷移する
    await expect(page).toHaveURL(/jpyc-ex\.html\?.*mode=post-reservation/, { timeout: 8000 });
    await expect(page.locator("h1")).toHaveText("振込先のご案内", { timeout: 6000 });

    // 振込ページ到達の約2秒後に案内ポップアップが表示され、背景タップで閉じられる
    await expect(page.locator("#transferNoticeDialog")).toBeVisible({ timeout: 6000 });
    await page.locator("#transferNoticeDialog").click();
    await expect(page.locator("#transferNoticeDialog")).toBeHidden();

    await expect(page.locator(".transfer-amount .v")).toHaveText("¥4,440");
    await expect(page.locator(".bank-details.secure")).toBeVisible();
  });

  test("アカウント作成: ログイン方式（パスキー/SMS/音声着信）を選べフォームが切り替わる", async ({ page }) => {
    await page.goto("/demo");
    await page.locator("#openJpyc").click();       // 開設案内①
    await page.locator("#guideBtn").click();        // → JPYC EX アカウント作成
    await expect(page.locator("h1")).toHaveText("JPYC EX アカウント作成");

    // 3方式が選べる。既定はパスキー（パスワード欄なし・パスキー登録の案内）
    await expect(page.locator(".login-method")).toHaveCount(3);
    await expect(page.locator('input[name="loginMethod"][value="passkey"]')).toBeChecked();
    await expect(page.locator("#pw")).toHaveCount(0);
    await expect(page.locator("#signupForm")).toContainText("パスキーを登録します");
    await expect(page.locator("#signupBtn")).toHaveText("パスキーを登録してアカウント作成");

    // 音声着信方式: パスワード＋携帯番号が現れる
    await page.locator('input[name="loginMethod"][value="voice"]').check();
    await expect(page.locator("#pw")).toBeVisible();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#signupBtn")).toHaveText("音声通話で認証する");

    // SMS方式: 送信 → コード入力パネル → 認証してアカウント作成 → eKYC
    await page.locator('input[name="loginMethod"][value="sms"]').check();
    await expect(page.locator("#phone")).toBeVisible();
    await expect(page.locator("#signupBtn")).toHaveText("SMSに認証コードを送信");
    await page.locator("#signupBtn").click();
    await expect(page.locator(".ex-sub")).toContainText("SMSによる認証");
    await expect(page.locator("#authCode")).toBeVisible();
    await page.locator("#codeBtn").click();
    await expect(page.locator("h1")).toHaveText("本人確認 (eKYC)", { timeout: 6000 });
  });

  test("アカウント作成: パスキー方式はモーダルのキャンセルで留まり作成されない", async ({ page }) => {
    await page.goto("/demo");
    await page.locator("#openJpyc").click();
    await page.locator("#guideBtn").click();
    await expect(page.locator("h1")).toHaveText("JPYC EX アカウント作成");
    await page.locator("#signupBtn").click();
    await expect(page.locator("#passkeyDialog")).toBeVisible();
    await page.locator("#passkeyCancel").click();
    // 同一画面（アカウント作成）に留まる
    await expect(page.locator("h1")).toHaveText("JPYC EX アカウント作成");
    await expect(page.locator(".login-method")).toHaveCount(3);
  });

  test("失敗ステート: キャンセルで同一画面のままインラインエラー・即再試行できる", async ({ page }) => {
    // 決済確認画面（パスキー確定）はログイン認証済み（2周目）の①で表示される。
    // 初回①は開設案内でパスキーを持たないため、登録済み状態を事前セットして検証する。
    await page.goto("/demo");
    await page.evaluate(() => localStorage.setItem("pay-mock-enrolled", "1"));
    await page.locator("#openJpyc").click();

    await page.locator("#payBtn").click();
    await page.locator("#passkeyCancel").click();

    // 同一画面に留まり、エラー表示・ボタン再有効化
    await expect(page).toHaveURL(/pay\.html/);
    await expect(page.locator("#payError")).toBeVisible();
    await expect(page.locator("#payBtn")).toBeEnabled();

    // 再試行すると成功できる
    await page.locator("#payBtn").click();
    await expect(page.locator("#payError")).toBeHidden();
    await page.locator("#passkeyConfirm").click();
    await expect(page.locator("#payBtn")).toHaveClass(/success/);
  });

  test("intent なしで直接開くとエラー画面と復帰導線", async ({ page }) => {
    await page.goto("/pay.html");
    await expect(page.locator("h1")).toHaveText("お支払いを開始できません");
    await expect(page.locator(".ex-btn")).toHaveText("ECサイトに戻る");
  });

  test("ツールチップ（§3.6.5）: ⓘ ホバー/フォーカスで仕組み説明が表示される", async ({ page }) => {
    // 3種のツールチップ（JPYC/最低金額/パスキー）は決済確認画面に揃う。
    // 初回①は開設案内のため、登録済み状態で決済確認画面（2周目①）を表示して検証する。
    await page.goto("/demo");
    await page.evaluate(() => localStorage.setItem("pay-mock-enrolled", "1"));
    await page.locator("#openJpyc").click();

    const tips = page.locator(".tip");
    expect(await tips.count()).toBeGreaterThanOrEqual(3);

    // ホバーで表示
    const bubble = tips.first().locator(".tip-bubble");
    await expect(bubble).toBeHidden();
    await tips.first().hover();
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("ステーブルコイン");

    // キーボードフォーカスでも表示（アクセシビリティ）
    const passkeyTip = page.locator(".trust-note .tip");
    await passkeyTip.focus();
    await expect(passkeyTip.locator(".tip-bubble")).toBeVisible();
    await expect(passkeyTip.locator(".tip-bubble")).toContainText("パスキー");
  });

  test("ヘッダー: 白ベース・濃紺ワードマーク・ECへ戻るリンク常設", async ({ page }) => {
    await page.goto("/demo");
    await page.locator("#openJpyc").click();

    const logo = page.locator(".stbl-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", "assets/logo-wordmark-suteburu-black.png");
    // ロゴサイズが適正化されている（128px → 26px）
    const height = await logo.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(32);
    // ヘッダーは白ベース（invert 撤去）
    const bg = await page.locator(".ex-header").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(255, 255, 255)");
    await expect(page.locator("#backToShop")).toHaveText("ECサイトに戻る");
  });
});

test.describe("デザイン統一（§3.3）と決済ボタン（§3.2）", () => {
  test("ショップの決済ボタンはロゴ入り・青基調", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator(".btn-jpyc-logo")).toHaveAttribute("src", "/assets/logo-wordmark-suteburu-black.png");
    const btn = page.locator("#openJpyc");
    const height = await btn.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44); // §3.6.2 ボタン規格
    // ブランド変数が青軸になっている
    const brand = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
    expect(brand.toUpperCase()).toBe("#2563EB");
  });
});

test.describe("旧ブラウザ警告（§3.5）", () => {
  test("WebAuthn 非対応環境では警告バナーが出る", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      // 旧ブラウザを擬似: WebAuthn API を消す
      delete window.PublicKeyCredential;
    });
    const page = await context.newPage();
    await page.goto("/demo");
    await expect(page.locator(".compat-warning")).toBeVisible();
    await expect(page.locator(".compat-warning")).toContainText("お使いのブラウザは古いため");
    await context.close();
  });

  test("対応ブラウザでは警告バナーは出ない", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator(".compat-warning")).toHaveCount(0);
  });
});
