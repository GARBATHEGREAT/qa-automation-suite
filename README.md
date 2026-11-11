# QA Automation Suite

[![QA](https://github.com/GARBATHEGREAT/qa-automation-suite/actions/workflows/qa.yml/badge.svg)](https://github.com/GARBATHEGREAT/qa-automation-suite/actions/workflows/qa.yml)

**Live test report: https://garbathegreat.github.io/qa-automation-suite/** (rebuilt on every push)

Automated quality assurance for [ReviewDesk](https://github.com/GARBATHEGREAT/reviewdesk) (live: https://reviewdesk-theta.vercel.app), a full-stack app I built:
**browser tests, API tests, regression tests, accessibility checks and continuous integration**, written with Playwright and TypeScript.

The suite found **four real bugs** in the application during development. Each one has a written bug report, a fix and a regression test:

| Bug | Severity | Found by |
|---|---|---|
| [BUG-001](docs/bugs/BUG-001-unknown-api-route-returns-401.md) Unknown API routes answered 401 instead of 404 | Low | Integration test |
| [BUG-002](docs/bugs/BUG-002-tasks-served-in-random-order.md) Tasks added in one batch were served in random order | Medium | Browser test |
| [BUG-003](docs/bugs/BUG-003-only-one-validation-message-shown.md) Sign up showed only one of two password errors | Low | Browser test |
| [BUG-004](docs/bugs/BUG-004-tasks-table-overflows-on-phones.md) Tasks table made the page scroll sideways on phones | Medium | Mobile run |

## What is covered

74 test runs in total (37 API, 26 browser, 5 regression, plus 6 smoke tests repeated on a phone profile).

| Area | Tests | Examples |
|---|---|---|
| **API** (`tests/api`) | 37 | Registration and login rules, token refresh and re-use detection, role-based access, validation errors, the review workflow (including two reviewers at the same instant), blind review, agreement statistics (Cohen's kappa), CSV export safety, health, metrics and security headers |
| **Browser** (`tests/e2e`) | 21 | Sign up, sign in and sign out, session after reload, admin creates a project and tasks, reviewer works through a queue, role-based screens, pagination and filters, insights page, CSV download |
| **Accessibility and layout** (`tests/e2e/quality.spec.ts`) | 5 | axe-core scan for serious WCAG 2 A/AA violations on the sign in, projects and review screens; keyboard-only sign in; no sideways scrolling on small screens |
| **Regression** (`tests/regression`) | 5 | One test per fixed bug |
| **Mobile** | 6 | The tests tagged `@smoke`, re-run on a Pixel 7 profile |

Continuous integration (`.github/workflows/qa.yml`) starts PostgreSQL and ReviewDesk, runs every test in Chromium, and uploads the HTML report, traces and videos of any failure.
Read the approach in [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md); use [docs/bug-report-template.md](docs/bug-report-template.md) for new bugs.

## Run it yourself

You need Node.js 20 or newer and a running ReviewDesk with demo data.

1. Start ReviewDesk (see its README). Use a high sign-in rate limit, because the tests create many accounts:

   macOS or Linux:
   ```bash
   export AUTH_RATE_LIMIT=100000
   ```
   Windows PowerShell:
   ```powershell
   $env:AUTH_RATE_LIMIT = "100000"
   ```
   Then run `npm run seed` and start the app (`npm run build`, then `WEB_DIST=../web/dist node dist/server.js` from `server`, or `docker compose up`).

2. Install and run the tests:

   ```bash
   npm install
   npx playwright install chromium     # or set PW_CHANNEL=msedge / chrome to use a browser you already have
   npm test
   npm run report                      # opens the HTML report
   ```

Useful variants:

```bash
npm run test:api           # API tests only (fast)
npm run test:smoke         # tagged @smoke
npm run test:regression    # bug regression tests
BASE_URL=https://your-host npm test     # test another deployment
```

## How it is organised

```
tests/
  api/          API tests using Playwright's request client
  e2e/          browser tests: auth, roles, workflow, insights, accessibility
  regression/   one test per fixed bug
  docs/         creates the screenshots used in the ReviewDesk README
helpers/        creating users, projects and tasks through the API; sign-in helpers
docs/           test strategy, bug reports, bug report template
```

Every test creates its own data with unique names, so tests run in parallel and in any order.

## Limits

Chromium-based browsers only; no load testing; no pixel-by-pixel visual comparison. See the strategy document.

## License

MIT
