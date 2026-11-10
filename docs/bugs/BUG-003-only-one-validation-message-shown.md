# BUG-003: Sign up form shows only one message when a password breaks several rules

| Field | Value |
|---|---|
| Severity | Low |
| Priority | Next release |
| Status | Fixed |
| Found by | Browser test "registration shows which field is wrong" (first full run) |
| Environment | Web app, Edge (Chromium) |

## Steps to reproduce
1. Open the sign in page and choose "Create an account".
2. Enter a valid name and email and the password `short`. Submit.

## Expected result
Under the password field, both problems are listed: it must be at least 10 characters, and it must contain a letter and a number.

## Actual result
Only "Password must contain a letter and a number" appeared. The 10-character rule was not shown, so a user who fixed the first problem would hit the second one afterwards.

## Root cause
The API returned two messages for the `password` field. The form turned the list into an object keyed by field name, so the second message overwrote the first.

## Fix
The form now collects every message per field and shows them together.

## Regression test
`tests/regression/regressions.spec.ts` > BUG-003, and a component test in the ReviewDesk repository.
