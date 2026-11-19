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
    expect(faq.mainEntity.length).toBe(17);
  });

  test("FAQPage JSON-LD の質問・答えが、表示中の FAQ と一致する（17 問）", async ({ page }) => {
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
    expect(visible).toHaveLength(17);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(visible.map((v) => v.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text.replace(/\s+/g, " ").trim())).toEqual(
      visible.map((v) => v.answer)
    );
  });

  test("FAQ に会計処理とパスキー（端末の買い替え）の 2 問があり、同じ位置に並ぶ", async ({ page }) => {
    await page.goto("/en/");
    const questions = (await page.locator("#faq details summary").allTextContents()).map((s) => s.trim());
    expect(questions[13]).toBe("How is received JPYC treated for accounting?");
    expect(questions[14]).toBe("What happens to my passkey if I replace my smartphone?");
    expect(questions[15]).toBe("Won't the details of payments be visible to anyone on the blockchain?");
    expect(questions[16]).toBe("Can buyers living outside Japan use this?");
  });

  test("JSON-LD に SoftwareApplication が無く、手数料の offers は Service にある", async ({ page }) => {
    await page.goto("/en/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = JSON.parse(raw)["@graph"];
    expect(graph.find((n) => n["@type"] === "SoftwareApplication")).toBeUndefined();
    const service = graph.find((n) => n["@type"] === "Service");
    expect(service.audience).toHaveLength(3);
    expect(service.offers.priceCurrency).toBe("JPY");
    expect(service.offers.description).toContain("5%");
    expect(service.offers.description).not.toContain("under consideration");
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

test.describe("英語LP 手数料の料率は 5% だけ", () => {
  test("ヒーロー・比較表・FAQ に 5% があり /fees/ へ（日本語と明示して）リンクし、under consideration は残らない", async ({ page, request }) => {
    await page.goto("/en/");
    await expect(page.locator(".hero-note")).toContainText("5%");
    await expect(page.locator(".hero-note a[href='/fees/'][hreflang='ja']")).toHaveCount(1);
    await expect(page.locator("#comparison")).toContainText("5%");
    await expect(page.locator("#comparison a[href='/fees/'][hreflang='ja']")).toHaveCount(1);
    await expect(page.locator("#faq")).toContainText("5% of the payment amount");
    await expect(page.locator("#faq a[href='/fees/'][hreflang='ja']")).toHaveCount(1);
    await expect(page.locator("#faq a[href='/fees/']")).toContainText("(in Japanese)");
    await expect(page.locator(".footnotes a[href='/fees/'][hreflang='ja']")).toHaveCount(1);
    const text = await page.locator("body").textContent();
    // プライバシー機能の「timing and method are under consideration」は手数料ではないので、fee / rate を含む文だけ見る
    const feeUndecided = /\b(fees?|rates?)\b[^.]{0,60}under consideration|under consideration[^.]{0,60}\b(fees?|rates?)\b|flat rate for all merchants is planned/i;
    expect(text).not.toMatch(feeUndecided);
    const html = await (await request.get("/en/")).text();
    expect(html).not.toMatch(feeUndecided);
  });

  test("自社の手数料の料率は 5% だけで、ほかの料率を表示と HTML ソースのどこにも出さない", async ({ page, request }) => {
    // 2026-11-19 運営者の決定（2026-10-16 の「5% を出さない」を置き換え）。間違った料率を出さない意図は変えない：
    // fee / rate の近くに数字の % が来たら、その数字は 5 でなければ落とす
    // （マイナンバーカードの holding rate of 84.5% は手数料ではないので除く）
    // 改行やタグをまたいでも見逃さないよう、タグを空白に変え、空白・改行を 1 つにまとめてから調べる
    // HTML コメント（head の AI_DISCOVERY_BLOCK など）の中身も調べるため、コメントの記号だけ先に外す
    const norm = (text) => text.replace(/<!--|-->/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    // % の数字ごとに、同じ文の前 80 字に fee、前 20 字に rate（holding rate を除く）、後 20 字に fee があるかを見る
    const ratesIn = (text) => {
      const t = norm(text);
      return [...t.matchAll(/(\d[\d.]*)\s*%/g)]
        .filter((m) => {
          const before = t.slice(Math.max(0, m.index - 80), m.index).split(/\.\s/).pop();
          const after = t.slice(m.index + m[0].length, m.index + m[0].length + 20).split(/\.(?:\s|$)/)[0];
          return /\bfees?\b/i.test(before) || /(?<!holding )\brate\b/i.test(before.slice(-20)) || /\bfees?\b/i.test(after);
        })
        .map((m) => m[1]);
    };
    const onlyFive = (text) => ratesIn(text).every((n) => n === "5");
    await page.goto("/en/");
    // 閉じた FAQ の答えも含めるため innerText ではなく textContent
    const body = await page.locator("body").textContent();
    expect(ratesIn(body).length, "英語ページの表示に 5% の手数料がある").toBeGreaterThan(0);
    expect(onlyFive(body), `英語ページの表示に 5% 以外の手数料の料率がある: ${ratesIn(body)}`).toBe(true);
    // 比較表の手数料の行（STBLpay 側）の数字の % は 5% だけ
    const selfFee = await page.locator("#comparison tr", { has: page.locator('th:text-is("Fees")') }).locator("td.col-self").textContent();
    expect([...selfFee.matchAll(/\d[\d.]*\s*%/g)].map((m) => m[0])).toEqual(["5%"]);
    const html = await (await request.get("/en/")).text();
    expect(onlyFive(html), "英語ページの HTML ソースに 5% 以外の手数料の料率がある").toBe(true);
    expect(ratesIn(html).length, "英語ページの HTML ソースに 5% の手数料がある").toBeGreaterThan(0);
    // 検査が効くこと（5% 以外の料率を足した文は、改行やタグで分かれていても当たる）
    expect(onlyFive("The payment fee is 5%.")).toBe(true);
    expect(onlyFive("The payment fee is 6%.")).toBe(false);
    expect(onlyFive("a flat rate of 1.5%")).toBe(false);
    expect(onlyFive("Payment fee:\n15%.")).toBe(false);
    expect(onlyFive("<th>Fees</th>\n<td>7%</td>")).toBe(false);
    expect(onlyFive("a holding rate of 84.5%")).toBe(true);
    expect(onlyFive("a 5% fee (it may become 6%)")).toBe(false);
    expect(onlyFive("<!-- merchant_value: Payment fee: 6% of the payment amount -->")).toBe(false);
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
