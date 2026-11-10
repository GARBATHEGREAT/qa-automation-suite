# Test strategy

## What is under test
[ReviewDesk](https://github.com/GARBATHEGREAT/reviewdesk): a React + Node.js + PostgreSQL application where teams rate AI answers
and measure how much reviewers agree. This repository tests the running application from the outside.

## Layers

| Layer | Where | What it proves | Speed |
|---|---|---|---|
| API tests | `tests/api` | Authentication, role rules, validation, the review workflow, statistics and CSV export work through the HTTP interface | Fast (about 30 s for 37 tests) |
| Browser tests | `tests/e2e` | A person can sign up, sign in, create projects, review tasks and read insights; each role sees the right screens | Slower |
| Accessibility checks | `tests/e2e/quality.spec.ts` | No serious or critical WCAG 2 A/AA violations (axe-core) on the main screens; keyboard-only sign in | Slower |
| Responsive checks | tagged `@smoke`, run on a phone profile | The layout does not break on a small screen | Quick |
| Regression tests | `tests/regression` | Every bug that was found stays fixed (one test per bug, named after the bug id) | Quick |

The ReviewDesk repository has its own unit and integration tests (real PostgreSQL). This suite checks the finished product the way a user or another system would use it.

## How the tests are written
- **Independent tests.** Every test creates its own users and projects with unique names, so tests can run in parallel and in any order.
- **Fast set-up through the API, real behaviour in the browser.** Tests that are about something else sign in through the API; the sign-in screen itself is tested through the form.
- **Locators a user would use.** Elements are found by role, label and visible text (not by CSS classes), which also checks the page is accessible. Test ids are used only for dynamic values (the current task, the agreement score).
- **No fixed waits.** Playwright's auto-waiting assertions are used instead of sleeps, which keeps the suite stable.
- **Evidence on failure.** Traces, screenshots and (in CI) videos are kept for failed tests, and an HTML report is published as a build artifact.

## Bug handling
Each bug gets a report in `docs/bugs` (see `docs/bug-report-template.md`), a fix, and a regression test named after the bug.
See [BUG-001](bugs/BUG-001-unknown-api-route-returns-401.md) to [BUG-004](bugs/BUG-004-tasks-table-overflows-on-phones.md): all four were found by running this suite or ReviewDesk's own tests during development.

## Known limits
- Only Chromium-based browsers are covered (Playwright Chromium in CI, Microsoft Edge locally). Firefox and WebKit are not run.
- The suite does not include load testing or penetration testing. The API tests check the main security behaviours (role rules, token handling, safe error messages, headers).
- Visual appearance is checked by accessibility and layout rules, not by pixel comparison.
