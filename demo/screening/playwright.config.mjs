import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "../../test-results/screening-demo",
  use: {
    baseURL: "http://127.0.0.1:5191",
    launchOptions: process.env.REVIEW_BROWSER_PATH ? { executablePath: process.env.REVIEW_BROWSER_PATH } : undefined
  },
  webServer: {
    command: "npm run demo:screening",
    cwd: new URL("../../", import.meta.url).pathname,
    url: "http://127.0.0.1:5191",
    reuseExistingServer: !process.env.CI
  }
});
