import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx sirv . --dev --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
