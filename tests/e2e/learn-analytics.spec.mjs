// 解説・方針ページの計測（assets/analytics.js・assets/fee-calculator.js）：記事の出口、FAQ の開閉、計算ツールの使用、AI からの来訪。
// 計測は本番のホスト・自動操作でないブラウザだけが送るので、learn.spec.mjs の「計測」のテストと同じく、
// stbl-pay.com への通信を baseURL に向け、navigator.webdriver を false にして見る。GA4 への通信は空で返す。
import { test, expect } from "@playwright/test";

const GA = /^https:\/\/([a-z0-9-]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//;

test.beforeEach(async ({ page, baseURL }) => {
  await page.route(GA, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://stbl-pay.com/**", async (route) => {
    const u = new URL(route.request().url());
    // route.fetch の応答は route に結びつく。page.request.get だと、ページを移ったあとに body が disposed で読めず落ちることがあった
    await route.fulfill({ response: await route.fetch({ url: `${baseURL}${u.pathname}${u.search}` }) });
  });
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
});

const events = (page) => page.evaluate(() => (window.dataLayer || []).filter((a) => a[0] === "event").map((a) => [a[1], a[2]]));
const names = async (page) => (await events(page)).map(([n]) => n);

test("計測：解説の本文と末尾の箱から LP・相談・docs・Sandbox・方針へ進んだことを、行き先の種類つきで送る", async ({ page }) => {
  await page.goto("https://stbl-pay.com/learn/chargeback/");
  // クラスの無いリンクを、本文と末尾の箱に足して押す（移動は止める）。行き先で見分けることを確かめる
  const cases = [
    ["learn_body", "/#early-access", "consult"],
    ["learn_body", "/", "lp"],
    ["learn_body", "/docs/getting-started/quickstart/", "docs"],
    ["learn_body", "/docs/testing/sandbox/", "sandbox"],
    ["learn_body", "/policy/expression/", "policy"],
    ["learn_about", "/docs/", "docs"],
    ["learn_about", "/en/#early-access", "consult"],
    ["learn_sources", "/docs/en/testing/sandbox/", "sandbox"],
  ];
  const parent = { learn_body: ".learn-body", learn_about: ".learn-about", learn_sources: ".learn-sources" };
  for (const [where, href] of cases) {
    await page.evaluate(([sel, h]) => {
      const a = document.createElement("a");
      a.href = h;
      a.className = "t-exit";
      a.textContent = "テスト";
      a.addEventListener("click", (e) => e.preventDefault());
      document.querySelector(sel).appendChild(a);
      a.click();
      a.remove();
    }, [parent[where], href]);
  }
  const got = (await events(page)).filter(([n]) => n === "cta_click").map(([, p]) => [p.cta_location, p.cta_destination, p.exit_type]);
  expect(got).toEqual(cases);
  // 本物の末尾の箱のリンク（LP・docs）も送る
  await page.evaluate(() => document.querySelectorAll(".learn-about a").forEach((a) => a.addEventListener("click", (e) => e.preventDefault())));
  await page.locator(".learn-about a[href='/docs/']").click();
  expect(await events(page)).toContainEqual(["cta_click", expect.objectContaining({ cta_location: "learn_about", exit_type: "docs", page_path: "/learn/chargeback/" })]);
});

test("計測：ヘッダーの相談ボタン・出口でないリンクは、解説の出口として送らない。本文から別の解説へ進んだことは select_content で送る", async ({ page }) => {
  await page.goto("https://stbl-pay.com/learn/chargeback/");
  await page.evaluate(() => {
    document.querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
    const a = document.createElement("a");
    a.href = "/learn/payment-fees/";
    a.addEventListener("click", (e) => e.preventDefault());
    document.querySelector(".learn-body").appendChild(a);
    a.click();
    a.remove();
  });
  await page.locator(".header-cta").click();
  const ev = await events(page);
  expect(ev).toContainEqual(["select_content", expect.objectContaining({ content_type: "learn_body", item_id: "/learn/payment-fees/" })]);
  const header = ev.find(([n]) => n === "cta_click");
  expect(header[1].exit_type, "ヘッダーのボタンは、解説の出口としては数えない").toBeUndefined();
  expect(header[1].cta_destination).toBe("/#early-access");
});

test("計測：FAQ の問いが開かれたことを、summary の文の先頭 80 字で、1 回の閲覧に同じ問いは 1 回だけ送る", async ({ page }) => {
  await page.goto("https://stbl-pay.com/learn/chargeback/");
  const summary = page.locator(".faq-list details > summary").first();
  const expected = ((await summary.textContent()) || "").trim().slice(0, 80);
  await summary.click();
  await summary.click(); // 閉じる
  await summary.click(); // もう一度開く
  await page.waitForTimeout(200);
  const faq = async () => (await events(page)).filter(([n]) => n === "faq_open"); // toggle は少し遅れて届く
  await expect.poll(async () => (await faq()).length).toBe(1);
  expect(await faq()).toEqual([["faq_open", expect.objectContaining({ question: expected })]]);
  await page.locator(".faq-list details > summary").nth(1).click();
  await expect.poll(async () => (await faq()).length).toBe(2);
});

test("計測：決済手数料の計算ツールが使われたことを、1 回の表示で 1 回だけ、入力した値を含めずに送る", async ({ page }) => {
  await page.goto("https://stbl-pay.com/learn/payment-fees/");
  expect(await names(page)).not.toContain("fee_calc_use");
  await page.locator("#fc-sales").fill("1234567");
  await page.locator("#fc-count").fill("89");
  await page.locator("#fc-rate").fill("3.6");
  const ev = await events(page);
  expect(ev.filter(([n]) => n === "fee_calc_use")).toEqual([["fee_calc_use", { page_path: "/learn/payment-fees/" }]]);
  expect(JSON.stringify(ev), "入力した値は送らない").not.toMatch(/1234567|89|3\.6/);
});

test("計測：ai_referral は、参照元のサブドメインと utm_source でも数え、AI でないときは送らない", async ({ page }) => {
  const cases = [
    [{ referer: "https://www.perplexity.ai/search?q=x" }, "/learn/", "perplexity"],
    [{ referer: "https://search.chatgpt.com/" }, "/learn/", "chatgpt"],
    [{}, "/learn/?utm_source=chatgpt.com", "chatgpt"],
    [{}, "/learn/chargeback/?utm_source=Perplexity", "perplexity"],
    [{ referer: "https://example.com/" }, "/learn/?utm_source=copilot.microsoft.com", "copilot"],
  ];
  for (const [opts, path, source] of cases) {
    await page.goto(`https://stbl-pay.com${path}`, opts);
    const hit = (await events(page)).filter(([n]) => n === "ai_referral");
    expect(hit, `${JSON.stringify(opts)} ${path}`).toEqual([["ai_referral", expect.objectContaining({ ai_source: source, landing_page: path.split("?")[0] })]]);
  }
  for (const [opts, path] of [[{ referer: "https://notchatgpt.com/" }, "/learn/"], [{}, "/learn/?utm_source=newsletter"], [{}, "/learn/"]]) {
    await page.goto(`https://stbl-pay.com${path}`, opts);
    expect(await names(page), `${JSON.stringify(opts)} ${path}`).not.toContain("ai_referral");
  }
});

test("計測：本番のホストでないとき、?ga=off のときは、増やしたイベントも送らない", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/learn/payment-fees/?utm_source=chatgpt.com`);
  await page.locator(".faq-list details > summary").first().click();
  await page.locator("#fc-sales").fill("1");
  expect(await names(page), "手元のホストでは送らない").toEqual([]);

  await page.goto("https://stbl-pay.com/learn/payment-fees/?ga=off&utm_source=chatgpt.com");
  await page.locator(".faq-list details > summary").first().click();
  await page.locator("#fc-sales").fill("1");
  expect(await names(page), "?ga=off では送らない").toEqual([]);
});
