# BUG-004: The Tasks table makes the whole page scroll sideways on a phone

| Field | Value |
|---|---|
| Severity | Medium |
| Priority | Next release |
| Status | Fixed |
| Found by | Mobile run (Pixel 7 profile) of "the page does not scroll sideways on a small screen" |
| Environment | Web app at 412 px wide |

## Steps to reproduce
1. Open a project that has tasks on a phone-sized screen (412 px wide) as an admin.
2. Open the Tasks tab.

## Expected result
The page fits the screen. A wide table scrolls inside its own box.

## Actual result
The page was 152 px wider than the screen, so the whole page, including the header, scrolled sideways.

## Root cause
The table (with the assignee drop-down column) was wider than the viewport and was not inside a scrollable container.

## Fix
Tables are wrapped in a `TableScroll` region that scrolls horizontally and can be focused with the keyboard.

## Regression test
`tests/regression/regressions.spec.ts` > BUG-004 and the `@smoke` mobile test in `tests/e2e/quality.spec.ts`.
