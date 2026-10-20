import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // 本番と同じ dist/ を配信する（scripts/build-dist.sh が組み立てる。docs も含む）。
    // CI では直前の手順で組み立て済み。手元では毎回組み立て直し、古い dist/ をテストしない
    command: '[ -n "$CI" ] || ./scripts/build-dist.sh; python3 -m http.server 4173 --bind 127.0.0.1 --directory dist',
    timeout: 180_000,
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
