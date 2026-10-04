---
id: T-060
title: Fix 4 failing usePersistedChoice unit tests (localStorage undefined under Node 26)
sprint: 2026-09-28
urgent: false
status: done
owner: client-tests
rolled: 0
order: -16
created: 2026-10-04
---
## Goal
Found by security-deps (2026-10-04, T-058): 4 client Vitest tests for usePersistedChoice fail on main too — localStorage is undefined when Vitest runs under Node 26. Find the root cause (test environment setup: jsdom/happy-dom env, Node 26 built-in localStorage global shadowing, vitest config) and fix it so the whole client unit suite passes on main and in CI. No skipping the tests.

## Notes
- 2026-10-04: Done (2026-10-04). Root cause: Node 25+ defines its own localStorage/sessionStorage globals (undefined without --localstorage-file); Vitest 3.2.4's jsdom env skips keys Node already has unless on its allow-list, so tests got Node's empty storage instead of jsdom's (CI on Node 22 never saw it).
Fix: app/apps/client/src/test/setup.ts points both globals at jsdom.window's Storage. Test-only; hook unchanged, no deps touched. Newer Vitest handles this itself (overriddenKeys) — a later Vitest bump makes the line redundant but harmless.
Test: cd app/apps/client && bunx vitest run → 132 files / 1377 tests pass on Node 26.7 (before: 4 failed).
Not verified locally: Node 22 (no local install); CI test.yml unit job covers it.
Commit: 2aa36dc3
branch: fix/client-unit-tests-localstorage
pr: #87 https://github.com/radio-crestin/church-hub/pull/87
before: n/a (test-only)
after: n/a (test-only)
build: skipped (test-only)
app: skipped (test-only)
- 2026-10-04: Node 25+ localStorage global shadowed jsdom's in Vitest 3.2.4; test setup points both storages at jsdom. 1377 client tests pass. PR #87.

## PR
- Branch: fix/client-unit-tests-localstorage
- PR: #87 https://github.com/radio-crestin/church-hub/pull/87
- Videos: none (test-only)
