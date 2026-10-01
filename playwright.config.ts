import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Euroscope app.
 *
 * Visual regression tests for the design system. The design-preview
 * routes require auth (NextAuth + Credentials + DB), so we test:
 *  1. The login page (public, uses the design system colors)
 *  2. Auth-gate verification (design-preview routes redirect to
 *     /login when unauthenticated)
 *  3. A standalone HTML page that renders the design tokens directly
 *     (no auth, no DB — pure visual regression of the color system)
 *
 * To extend with authenticated tests, see VISUAL_TESTING.md.
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: "{snapshotDir}/{testFileDir}/{arg}{ext}",
  snapshotDir: "tests/visual/__screenshots__",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
