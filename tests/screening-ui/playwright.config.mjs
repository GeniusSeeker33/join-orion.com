import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", workers: 1, timeout: 30000,
  outputDir: "../../test-results/screening-ui",
  use: {
    baseURL: "http://127.0.0.1:5183",
    launchOptions: process.env.REVIEW_BROWSER_PATH ? { executablePath: process.env.REVIEW_BROWSER_PATH } : undefined
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config tests/screening-ui/vite.config.mjs",
    url: "http://127.0.0.1:5183", cwd: process.cwd(), reuseExistingServer: false
  }
});
