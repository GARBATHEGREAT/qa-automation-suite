# BUG-002: Tasks added in one batch are listed and served in random order

| Field | Value |
|---|---|
| Severity | Medium |
| Priority | Fix now |
| Status | Fixed |
| Found by | Browser test "a reviewer works through every task, then sees all caught up" (first full run) |
| Environment | Web app and API, Edge (Chromium), PostgreSQL 17 |

## Steps to reproduce
1. As an admin, add two or more tasks to a project in one request ("Question 1", "Question 2", ...).
2. Sign in as a reviewer and open the project.

## Expected result
The reviewer is shown "Question 1" first, then "Question 2", in the order the admin added them.
The Tasks table lists them in the same order on every page.

## Actual result
The reviewer was shown "Question 2" first. The order differed between runs.

## Root cause
Tasks were ordered by `created_at` and then by `id`. All tasks in one batch are inserted in the same
transaction and receive the same `created_at`, and `id` is a random UUID, so the tie was broken randomly.
Pagination in the Tasks table was affected in the same way.

## Fix
Migration `003_task_order.sql` adds an auto-incrementing `seq` column and an index. Listing, the "next task"
query and the CSV export now order by `seq`.

## Regression test
`tests/regression/regressions.spec.ts` > BUG-002 (API order and browser order), and an integration test in the ReviewDesk repository.
