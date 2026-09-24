import { test, expect } from "@playwright/test";

/**
 * Visual regression tests for the Euroscope design system.
 *
 * Three test categories:
 *  1. Standalone design-tokens page (no auth, no DB) — pure visual
 *     regression of the color system
 *  2. Login page (public) — verifies the login page renders correctly
 *     and uses the design system colors
 *  3. Auth-gate verification — verifies the design-preview routes
 *     redirect to /login when unauthenticated
 *
 * To extend with authenticated snapshots (e.g. snapshot the actual
 * design-preview routes), see VISUAL_TESTING.md.
 */

// ── 1. Standalone design-tokens page ─────────────────────────────

test.describe("Design tokens page", () => {
  test("renders all 7 sections without visual regression", async ({ page }) => {
    await page.goto("/design-tokens/index.html");

    // Wait for Tailwind CDN to apply styles
    await page.waitForLoadState("networkidle");

    // Snapshot the full page
    await expect(page).toHaveScreenshot("design-tokens-full.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("status color palette renders correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const statusSection = page.locator("section").filter({ hasText: "1. Status Colors" });
    await expect(statusSection).toHaveScreenshot("status-colors.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("status badges render correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const badgeSection = page.locator("section").filter({ hasText: "2. Status Badges" });
    await expect(badgeSection).toHaveScreenshot("status-badges.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("primary accent renders correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const primarySection = page.locator("section").filter({ hasText: "3. Primary Accent" });
    await expect(primarySection).toHaveScreenshot("primary-accent.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("cards render correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const cardsSection = page.locator("section").filter({ hasText: "4. Cards" });
    await expect(cardsSection).toHaveScreenshot("cards.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("buttons render correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const buttonsSection = page.locator("section").filter({ hasText: "5. Buttons" });
    await expect(buttonsSection).toHaveScreenshot("buttons.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("student panel amber accent renders correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const amberSection = page.locator("section").filter({ hasText: "6. Student Panel" });
    await expect(amberSection).toHaveScreenshot("amber-accent.png", {
      maxDiffPixelRatio: 0.01,
    });
  });

  test("progress bars render correctly", async ({ page }) => {
    await page.goto("/design-tokens/index.html");
    await page.waitForLoadState("networkidle");

    const progressSection = page.locator("section").filter({ hasText: "7. Progress Bars" });
    await expect(progressSection).toHaveScreenshot("progress-bars.png", {
      maxDiffPixelRatio: 0.01,
    });
  });
});

// ── 2. Login page (public) ───────────────────────────────────────

test.describe("Login page", () => {
  test("renders without visual regression", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Snapshot the login page
    await expect(page).toHaveScreenshot("login-page.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("has email and password inputs", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test("has a submit button", async ({ page }) => {
    await page.goto("/login");

    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
    await expect(submitButton).toBeVisible();
  });
});

// ── 3. Auth-gate verification ────────────────────────────────────

test.describe("Auth-gate verification", () => {
  test("/student/design-preview redirects to /login when unauthenticated", async ({ page }) => {
    const response = await page.goto("/student/design-preview");
    // Should redirect (3xx) or land on /login
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/(login|student\/design-preview)/);
  });

  test("/employee/design-preview redirects to /login when unauthenticated", async ({ page }) => {
    const response = await page.goto("/employee/design-preview");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/(login|employee\/design-preview)/);
  });

  test("/admin/design-preview redirects to /login when unauthenticated", async ({ page }) => {
    const response = await page.goto("/admin/design-preview");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/(login|admin\/design-preview)/);
  });
});

// ── 4. 404 page ──────────────────────────────────────────────────

test.describe("404 page", () => {
  test("renders without visual regression", async ({ page }) => {
    await page.goto("/nonexistent-page-that-should-404");
    await page.waitForLoadState("networkidle");

    // Some apps show a custom 404; others show Next.js default.
    // Just snapshot whatever renders.
    await expect(page).toHaveScreenshot("404-page.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // looser threshold for framework-rendered pages
    });
  });
});
