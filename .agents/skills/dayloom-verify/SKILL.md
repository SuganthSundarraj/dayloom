---
name: dayloom-verify
description: Select and run Dayloom checks for project changes, including regression tests, SQL ownership tests, browser accessibility workflows, coverage, and Allure evidence.
---

# Verify Dayloom

Read `package.json` and relevant test configuration after secret scanning to confirm current commands and thresholds. Use Node 24 as in CI; Java 17+ is required for Allure generation, not the application backend.

| Change | Validation |
| --- | --- |
| Documentation or skill instructions only | Review facts, relative links, routing, and `git diff --check`; validate modified skills with the Skill Creator validator when available. No application suite or deployment is required solely for prose. |
| UI or user interaction | Typecheck, lint, relevant desktop/mobile Playwright workflows, responsive bounds, keyboard/focus behavior, and affected axe accessibility checks; build before application release. |
| Domain or persistence behavior | Focused happy-path, boundary, and failure tests; `npm run test:coverage`, typecheck, lint, and affected browser workflows. |
| Database/auth changes | Migration and PGlite ownership/constraint tests plus repository failure cases and relevant browser flows. Local mocks do not verify production email delivery or real account sessions. |
| Dependencies, framework, CI, or application release | Typecheck, lint, coverage, browser suite, `npm run audit:production`, and `npm run build`; inspect CI behavior and report artifacts when affected. |

Commands: `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run test:e2e`, `npm run audit:production`, `npm run build`. Use targeted Vitest/Playwright selection during diagnosis; retain full existing CI gates. Install Chromium when required with `npx playwright install chromium`.

For bug fixes, demonstrate the regression test fails with the original defect and passes with the fix when feasible. Classify failures using evidence before editing: product defect, test defect, invalid data, environment, timing/race, assumption, or backend problem. Never weaken assertions or hide a known defect to obtain green results. Relevant unresolved regressions block release.

Allure aggregates unit/database and browser results; coverage is separate. `npm run test:report` clears stale results and generates a combined report while preserving failures in its exit status. Do not merge stale runs into claimed fresh evidence. Report executed commands, actual outcomes, coverage scope, and limitations. CI must be checked for the delivered commit, not an earlier green run.
