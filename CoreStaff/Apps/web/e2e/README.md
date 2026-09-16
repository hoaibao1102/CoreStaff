# App Shell browser checks

From `CoreStaff/`:

```powershell
npx playwright install chromium
npm run test:e2e --workspace @corestaff/web
```

To use installed Chrome instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e --workspace @corestaff/web
```

Tests start Vite on port 4173 and intercept API requests with test fixtures. They
exercise the actual app, routing, components and CSS without a live account or
backend writes. Screenshots and failure traces are saved in `test-results/`.

`departments.spec.ts` covers `/hr/departments`: create/edit, duplicate codes,
partial update payloads, activation/deactivation without a body, status filters,
read-only tenant roles, missing tenant, 401/403/404/500 responses, retry, and
responsive list/form layouts with keyboard focus restoration. Run it alone with
`npm run test:e2e --workspace @corestaff/web -- departments.spec.ts`.
Installed Edge is also supported via `$env:PLAYWRIGHT_CHANNEL = 'msedge'`.

Coverage includes 375/768/1024/1440px layouts, all four roles, nested active routes,
icon and logo geometry, rapid toggles, persistence, tooltips on hover/focus, account
navigation/logout, drawer focus trapping/restoration, backdrop/Escape/route close,
desktop breakpoint changes, short viewports and reduced motion. Every test rejects
browser console warnings and errors. Logout moved from the jsdom navigation test
to this suite so the portaled menu runs with real layout and focus behavior.

## Design Master application

The requested sidebar supersedes the horizontal navigation and icon-with-label-only
examples in sections B/C/U. `WorkspaceShell.css` owns the 280px/72px widths and the
1024px drawer breakpoint. `CoreStaffLogo` is reused from Login's `AuthLayout`; there
is no separate image asset in that login header.

The shell uses the existing overlay components' layer 50. Its header/sidebar use
10/20 so menus and tooltips stay above them; a Sheet's nested menu follows its
parent portal. This adapts section X's suggested layer ordering to the installed
components. These sidebar rules should replace the old tab examples if the
Design Master is updated across the application.
