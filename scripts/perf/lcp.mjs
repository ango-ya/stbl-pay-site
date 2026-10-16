// スマホ相当（Slow 4G・CPU 4 倍遅延）で FCP / LCP を交互に測って中央値を出す。
// 動画やキャラを足して LP 全体が遅くなっていないかの確認用。
//
//   node scripts/perf/serve-br.mjs <main の作業ツリー> 4184 &
//   node scripts/perf/serve-br.mjs . 4183 &
//   ROUNDS=6 node scripts/perf/lcp.mjs main=http://127.0.0.1:4184/ branch=http://127.0.0.1:4183/
//
// Playwright の Chromium が入っていないときは CHROME_PATH にブラウザの実行ファイルを渡す。
import { chromium } from "@playwright/test";

const targets = process.argv.slice(2).map((s) => {
  const [label, url] = s.split("=");
  return { label, url, res: [] };
});
const ROUNDS = Number(process.env.ROUNDS || 6);
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

for (let i = 0; i < ROUNDS; i++) {
  for (const t of targets) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(t.url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1200);
    t.res.push(
      await page.evaluate(() => ({
        lcp: Math.round(window.__lcp),
        fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0),
      }))
    );
    await ctx.close();
  }
}
await browser.close();

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const t of targets) {
  console.log(
    `${t.label.padEnd(12)} FCP ${median(t.res.map((r) => r.fcp))} ms / LCP ${median(t.res.map((r) => r.lcp))} ms` +
      `  (LCP: ${t.res.map((r) => r.lcp).join(", ")})`
  );
}
