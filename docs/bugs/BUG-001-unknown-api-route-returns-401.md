# BUG-001: Unknown API routes answer 401 instead of 404

| Field | Value |
|---|---|
| Severity | Low |
| Priority | Next release |
| Status | Fixed |
| Found by | ReviewDesk integration test "returns a request id and a JSON 404 for unknown API routes" |
| Environment | API, Node 22, PostgreSQL 17, first version of the work router |

## Steps to reproduce
1. Without signing in, send `GET /api/this-does-not-exist`.

## Expected result
`404` with the JSON body `{"error": {"code": "NOT_FOUND", ...}}`, like every other unknown route.

## Actual result
`401 Unauthorized`. The task and review routes were mounted at `/api` with an authentication
check applied to the whole router, so the check ran for every path under `/api`, including paths that do not exist.

## Root cause
Authentication was applied with `router.use(...)` on a router mounted at the shared `/api` prefix.

## Fix
Authentication is now attached to each route individually, so the catch-all 404 handler is reached for unknown paths.

## Regression test
`tests/regression/regressions.spec.ts` > BUG-001 (and the matching integration test in the ReviewDesk repository).
