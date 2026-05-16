import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /tests\/a11y\/.*\.spec\.ts/,
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "npm run specfirst:demo -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
