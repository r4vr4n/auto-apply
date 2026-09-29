import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  retries: 0,
  use: { viewport: { width: 1440, height: 900 } },
});
