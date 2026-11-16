import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'.',testMatch:'*.spec.mjs',workers:1,reporter:'list',timeout:60000,
  outputDir:'../../test-results/referral-ui',
  use:{baseURL:'http://127.0.0.1:5182',headless:true,channel:process.env.REVIEW_TEST_BROWSER || 'chrome',viewport:{width:1440,height:1100}},
  webServer:{command:'node node_modules/vite/bin/vite.js --config tests/referral-ui/vite.config.mjs',url:'http://127.0.0.1:5182',reuseExistingServer:true,timeout:60000},
});
