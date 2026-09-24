# Visual Regression Testing

This project uses [Playwright](https://playwright.dev/) for visual
regression testing of the design system.

## Quick start

```bash
# Install Playwright + browser binaries (first time only)
npm install -D @playwright/test
npx playwright install chromium

# Run the visual tests (starts the dev server automatically)
npm run test:visual

# Update snapshots after an intentional design change
npm run test:visual -- --update-snapshots

# View the HTML report
npx playwright show-report
```

## What's tested

### 1. Design tokens page (`/design-tokens/index.html`)

A standalone HTML page (no auth, no DB) that renders every design
token + component in every state. Playwright snapshots each section
individually so when a test fails, you know exactly which part of the
design system changed.

Sections snapshotted:
- Status colors (5 tones: success, warning, info, destructive, default)
- Status badges (5 tones)
- Primary accent (dark slate — 4 variants)
- Cards (default, highlighted, success, warning)
- Buttons (primary, outline, destructive, outline-destructive)
- Student panel amber accent (4 variants)
- Progress bars (4 tones)

### 2. Login page (`/login`)

The only public page that uses the full design system. Snapshotted
to catch regressions in form inputs, buttons, and layout.

### 3. Auth-gate verification

Verifies the 3 design-preview routes (`/student/design-preview`,
`/employee/design-preview`, `/admin/design-preview`) redirect to
`/login` when unauthenticated. This catches accidental removal of
the auth guard.

### 4. 404 page

Snapshotted to catch regressions in the not-found experience.

## Configuration

- `playwright.config.ts` — main config
- `tests/visual/` — test files
- `tests/visual/__screenshots__/` — baseline snapshots (committed to git)
- Browser: Chromium only (add Firefox + WebKit in `playwright.config.ts`
  if cross-browser coverage is needed)
- Snapshot threshold: 1% pixel diff (5% for framework-rendered pages
  like 404)

## Adding authenticated snapshots

The design-preview routes require NextAuth + a running database. To
snapshot them, you need to authenticate Playwright first. Two options:

### Option A: UI login (simple, slow)

```typescript
// tests/visual/authenticated.spec.ts
import { test, expect } from "@playwright/test";

test("student design-preview renders", async ({ page }) => {
  // Log in via the UI
  await page.goto("/login");
  await page.fill('input[name="email"]', "student@example.com");
  await page.fill('input[name="password"]', "password");
  await page.click('button[type="submit"]');
  await page.waitForURL("/student");

  // Now snapshot the design-preview page
  await page.goto("/student/design-preview");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("student-design-preview.png");
});
```

**Requires:** A running database with a seeded student account.

### Option B: Programmatic login (fast, requires NextAuth secret)

```typescript
// tests/visual/authenticated.spec.ts
import { test, expect } from "@playwright/test";

test("student design-preview renders", async ({ page }) => {
  // Programmatically set the NextAuth session cookie
  // (requires NEXTAUTH_SECRET in your env)
  const tokens = await fetch("/api/auth/csrf").then(r => r.json());
  // ... sign in via the credentials API endpoint ...

  await page.goto("/student/design-preview");
  await expect(page).toHaveScreenshot("student-design-preview.png");
});
```

**Requires:** `NEXTAUTH_SECRET` environment variable + a seeded DB.

## CI integration

The Playwright config auto-detects CI via `process.env.CI`:
- Retries failed tests 2×
- Uses 1 worker (avoids concurrent dev-server conflicts)
- Reports to GitHub Actions annotations

Example GitHub Actions workflow:

```yaml
# .github/workflows/visual-tests.yml
name: Visual Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build  # visual tests run against the built app
      - run: npm run test:visual
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Updating snapshots

When you intentionally change the design (e.g. update the amber
accent shade), update the baseline snapshots:

```bash
npm run test:visual -- --update-snapshots
git add tests/visual/__screenshots__/
git commit -m "test(visual): update snapshots for amber accent change"
```

**Always review the diff before committing updated snapshots.** A
snapshot update that wasn't intentional is a visual regression hiding
in plain sight.

## Troubleshooting

### "Browser was not found"
Run `npx playwright install chromium` to download the browser.

### "Host system is missing dependencies"
On Linux: `npx playwright install-deps chromium` (requires sudo).

### Tests fail with "page.click: Timeout"
The dev server may not have started. Check `npm run dev` works
manually, or set `PLAYWRIGHT_SKIP_SERVER=1` and start the server
yourself in a separate terminal.

### Snapshot diff is flaky
- Ensure `await page.waitForLoadState("networkidle")` is called
  before snapshotting
- Use `maxDiffPixelRatio: 0.01` (1% tolerance) for most pages
- For pages with animations, add `await page.waitForTimeout(500)`
  before snapshotting to let animations settle
