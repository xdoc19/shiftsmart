const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/e2e.spec.js',
  timeout: 15000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
