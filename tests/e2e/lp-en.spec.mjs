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
    expect(faq.mainEntity.length).toBe(16);
  });

  test("FAQPage JSON-LD の質問・答えが、表示中の FAQ と一致する（16 問）", async ({ page }) => {
    await page.goto("/en/");
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faq = blocks
      .map((block) => JSON.parse(block))
      .flatMap((parsed) => parsed["@graph"] ?? [parsed])
      .find((node) => node["@type"] === "FAQPage");
    expect(faq).toBeTruthy();

    // 表示側の答えは、脚注の参照（sup.fn）を除いた文字にそろえて比べる
    const visible = await page.locator("#faq details").evaluateAll((els) =>
      els.map((el) => {
        const p = el.querySelector("p").cloneNode(true);
        p.querySelectorAll("sup.fn").forEach((n) => n.remove());
        return {
          question: el.querySelector("summary").textContent.trim(),
          answer: p.textContent.replace(/\s+/g, " ").trim(),
        };
      })
    );
    expect(visible).toHaveLength(16);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(visible.map((v) => v.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text.replace(/\s+/g, " ").trim())).toEqual(
      visible.map((v) => v.answer)
    );
  });

  test("FAQ に会計処理とパスキー（端末の買い替え）の 2 問があり、同じ位置に並ぶ", async ({ page }) => {
    await page.goto("/en/");
    const questions = (await page.locator("#faq details summary").allTextContents()).map((s) => s.trim());
    expect(questions[12]).toBe("How is received JPYC treated for accounting?");
    expect(questions[13]).toBe("What happens to my passkey if I replace my smartphone?");
    expect(questions[14]).toBe("Won't the details of payments be visible to anyone on the blockchain?");
    expect(questions[15]).toBe("Can buyers living outside Japan use this?");
  });

  test("JSON-LD に SoftwareApplication が無く、手数料の offers は Service にある", async ({ page }) => {
    await page.goto("/en/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = JSON.parse(raw)["@graph"];
    expect(graph.find((n) => n["@type"] === "SoftwareApplication")).toBeUndefined();
    const service = graph.find((n) => n["@type"] === "Service");
    expect(service.audience).toHaveLength(3);
    expect(service.offers.priceCurrency).toBe("JPY");
    expect(service.offers.description).toContain("under consideration");
  });

  test("ヒーローとティッカーが「開発中」を示し、提供開始の時期を書かない", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.locator(".hero-note")).toContainText("STBLpay is under development");
    await expect(page.locator(".hero-note")).not.toContainText("Early-access");
    await expect(page.locator(".hero-ticker .ticker-group").first()).toContainText("STBLpay is under development");
    await expect(page.locator(".hero-ticker .ticker-group").first()).not.toContainText("2026.08");
  });

  test("脚注の参照がすべて実在し、各脚注が参照されている", async ({ page }) => {
    await page.goto("/en/");
    const refs = await page
      .locator('a[href^="#fn-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href").slice(1)));
    const notes = await page
      .locator('.footnote-list li[id^="fn-"]')
      .evaluateAll((els) => els.map((el) => el.id));
    expect(notes).toHaveLength(8);
    for (const ref of refs) expect(notes, `${ref} の脚注が無い`).toContain(ref);
    for (const note of notes) expect(refs, `${note} を参照する箇所が無い`).toContain(note);
    // 参照側の id は重複しない
    const ids = await page.locator("sup.fn a[id]").evaluateAll((els) => els.map((el) => el.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("フッターに運営会社の実績が 4 行ある", async ({ page }) => {
    await page.goto("/en/");
    const facts = page.locator(".site-footer ul.footer-facts li");
    await expect(facts).toHaveText([
      "Founded in February 2019, headquartered in Fukuoka City.",
      'Co-developed "JPYC Explorer," an accounting audit support tool for JPYC, with Asteria Corporation (announced by Asteria on March 13, 2026).',
      "Began a joint proof-of-concept of Web3 infrastructure, including validator node operation, with QTnet, Inc. (announced February 19, 2024).",
      'A proof-of-concept project using the IoT data trading platform "PTPF" was selected for the Fukuoka City Demonstration Experiment Full Support Program (announced by Fukuoka City on January 31, 2022).',
    ]);
  });

  test("決定の逆戻りを防ぐ：HTML ソース（head・JSON-LD・AI_DISCOVERY_BLOCK を含む）に禁止語が無い", async ({
    request,
  }) => {
    const res = await request.get("/en/");
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).toContain("AI_DISCOVERY_BLOCK");
    expect(html).toContain("application/ld+json");
    const banned = [
      [/SDK/, "SDK"],
      [/early access/i, "early access"],
      [/August 2026/, "August 2026"],
      [/2026\.08/, "2026.08"],
      [/Just make a bank transfer/i, "Just make a bank transfer"],
      // 残高を増やす操作は「残高を追加」（add to your balance）。top up / charge は使わない
      [/\btop[- ]?up\b/i, "top up"],
      [/\brecharge\b/i, "recharge"],
      [/\bcharge (up )?(your|the|my) (balance|account)/i, "charge (balance)"],
    ];
    for (const [pattern, label] of banned) {
      expect(pattern.test(html), `英語ページの HTML ソースに「${label}」が残っている`).toBe(false);
    }
  });
});

test.describe("英語LP 手数料の料率を出さない", () => {
  test("手数料の料率（5% など）を、表示と HTML ソースのどこにも出さない", async ({ page, request }) => {
    // 料率は検討中（2026-10-16 ユーザー決定：5% は出さない）。fee / rate の近くに数字の % が来たら落とす
    // （マイナンバーカードの holding rate of 84.5% は手数料ではないので除く）
    const feeRate = /\bfees?\b[^.\n]{0,40}\d[\d.]*\s*%|\d[\d.]*\s*%[^.\n]{0,20}\bfees?\b|(?<!holding )\brate\b[^.\n]{0,20}\d[\d.]*\s*%/i;
    await page.goto("/en/");
    const body = await page.locator("body").innerText();
    expect(feeRate.test(body), "英語ページの表示に手数料の料率がある").toBe(false);
    const html = await (await request.get("/en/")).text();
    expect(feeRate.test(html), "英語ページの HTML ソースに手数料の料率がある").toBe(false);
    // 検査が効くこと
    expect(feeRate.test("The payment fee is 5%.")).toBe(true);
    expect(feeRate.test("a flat rate of 1.5%")).toBe(true);
    expect(feeRate.test("a holding rate of 84.5%")).toBe(false);
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
