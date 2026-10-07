# Dayloom — Notes & Tasks

A responsive personal organizer with manual tasks, linked notes, a quick-capture inbox, weekly planning, recoverable trash, a persistent focus timer, keyword memory search, and deterministic daily planning. AI extraction is deliberately disabled: there are no provider calls, API keys, or AI charges. A labelled, transient sample workspace is shown until Supabase is configured. Demo changes are never represented as saved data.

## Project links

| Resource | Link | What it provides |
| --- | --- | --- |
| Live application | [Open Dayloom](https://dayloom-personal-organizer.anywherework-0233.chatgpt.site/) | Publicly hosted organizer; sign in to save your personal workspace in Supabase. |
| Source code | [SuganthSundarraj/dayloom](https://github.com/SuganthSundarraj/dayloom) | Application code, SQL migrations, tests, and setup instructions. |
| Project presentation | [Dayloom — Project Overview (Google Slides)](https://docs.google.com/presentation/d/1UBFbXgRTGIdOXkq6nbuy84HPavF0Z6WNt4mmRNGh14o/edit?usp=drivesdk) | Nine editable slides explaining features, architecture, technologies, deployment, and test coverage, with app and report links. |
| Allure report | [Open the latest test report](https://suganthsundarraj.github.io/dayloom/) | Unit, database, and desktop/mobile browser test results from the latest report published from `main`. |
| Build and test runs | [GitHub Actions](https://github.com/SuganthSundarraj/dayloom/actions/workflows/quality.yml) | Quality checks, logs, downloadable reports, and coverage artifacts for each run. |

The app and Allure report have separate hosting: Sites deploys the app to Cloudflare Workers; GitHub Pages hosts the generated Allure HTML.

## Technologies and where they are used

| Technology | Used for | Main location | Why it is used |
| --- | --- | --- | --- |
| React 19 | Dashboard, editors, navigation, inbox, weekly plan, trash, and focus timer | `components/organizer/`, `app/page.tsx` | Reusable components and state-driven updates across the workspace. |
| TypeScript | Typed tasks, notes, captures, sessions, validation, and persistence contracts | `lib/organizer/`, `components/organizer/`, `tsconfig.json` | Strict checking catches incompatible data and API usage before deployment. |
| Vinext and Vite | Next-compatible app routes, local development, and production builds | `app/`, `vite.config.ts`, `scripts/run-framework.mjs` | Uses app routes and React while building the Cloudflare Worker and browser assets. |
| CSS and Tailwind CSS 4 | White and dark grey palette, shared styles, responsive layouts, and control appearance | `app/globals.css` | Dayloom's design is primarily editable CSS classes and variables; Tailwind is also imported by the stylesheet. |
| Radix UI | Shared dialogs, focus trapping, keyboard dismissal, and accessible modal semantics | `components/organizer/dialog.tsx` | Gives task, note, account, and confirmation dialogs a shared behavior foundation. |
| Lucide React | Navigation and action icons | `components/organizer/` | Consistent icons that can be changed alongside component code. |
| Supabase Auth | Email/password sign-in, signup, and account sessions | `components/organizer/organizer.tsx`, `lib/organizer/repository.ts` | Connects saved data to the signed-in user's identity. |
| Supabase Postgres and SQL | Tasks, notes, captures, focus sessions, planned dates, trash state, and atomic operations | `supabase/migrations/` | Database constraints, Row Level Security, and transactional functions enforce ownership and consistency. |
| Supabase JavaScript client | Auth requests, loading/saving records, and calling database functions | `lib/organizer/repository.ts` | Keeps storage operations behind a shared persistence layer. |
| Cloudflare Workers and Sites | Production app runtime, static assets, runtime configuration, and versioned publication | `app/api/config/route.ts`, `vite.config.ts`, `.openai/hosting.json` | Hosts the app and serves public Supabase connection settings without embedding deployment credentials in source. |
| Vitest and V8 coverage | Unit tests, persistence failure tests, and domain/persistence code coverage | `tests/*.test.ts`, `vitest.config.ts` | Fast tests for observable business rules and error handling, with enforced coverage thresholds. |
| PGlite | Temporary PostgreSQL-compatible databases for migration, constraints, transactions, and ownership tests | `tests/database.test.ts`, `tests/productivity-database.test.ts` | Exercises real SQL locally without using production data or credentials. |
| Playwright and axe-core | Desktop/mobile browser workflows, responsive bounds, keyboard behavior, and automated accessibility checks | `tests/e2e/`, `playwright.config.ts` | Verifies complete user flows and catches UI regressions. |
| Allure | Combined test results, failure attachments, and a shareable HTML report | `vitest.config.ts`, `playwright.config.ts`, `scripts/test-report.mjs` | Makes unit/database and browser test evidence available in one report. |
| GitHub Actions and GitHub Pages | Automated quality gates, report artifacts, and public report publication | `.github/workflows/quality.yml` | Checks every push/PR and publishes reports from `main`. |
| Node.js 24 and Java 17+ | Development/build/test tooling; Java runs the Allure report generator | `package.json`, `.github/workflows/quality.yml` | Provides reproducible tooling locally and in CI; Java is not an application backend. |

Installed starter packages do not automatically form part of Dayloom's implementation. Its organizer dialogs use Radix directly; Supabase SQL migrations define its datastore. Cloudflare D1/R2 bindings are not configured, and Supabase file storage is not used by these text-based features. AI extraction is disabled and no AI provider is called.

## Code structure and data flow

| Location | Responsibility |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Application entry point, page metadata, and global stylesheet. |
| `components/organizer/organizer.tsx` | Workspace state, authentication UI, navigation, and coordinating mutations. |
| `components/organizer/day-view.tsx` | Today's tasks, notes, and daily plan composition. |
| `components/organizer/productivity-views.tsx` | Quick capture, inbox, weekly planning, trash, and focus timer UI. |
| `components/organizer/editors.tsx`, `duration-field.tsx`, `dialog.tsx` | Task/note/account forms, duration formats, and shared modal behavior. |
| `lib/organizer/domain.ts`, `features.ts` | Pure validation, keyword search, daily planning, calendar dates, and timer calculations. |
| `lib/organizer/repository.ts` | Supabase connection, record loading/saving, trash/restore, conversion, and timer operations. |
| `app/api/config/route.ts` | Exposes only the Supabase URL and public publishable key from the Worker environment. |
| `supabase/migrations/` | Tables, constraints, owner policies, and transactional database functions. |
| `tests/`, `.github/workflows/quality.yml` | Unit/database/browser checks and CI/report publication. |

The browser loads the public configuration from `/api/config`, signs in through Supabase Auth, and uses the Supabase client to access Postgres. Row Level Security checks `auth.uid()` independently of the UI. Capture-to-task conversion runs through `convert_capture`; focus controls use `control_focus` and database timestamps. The app never requires or exposes a service-role key.

## Run locally

Use Node 24 LTS. Run `npm ci`, then `npm run dev`. To test real storage, create `.env` from `.env.example` and fill the public connection values. Never commit credentials. Without Supabase configuration the app opens a sample workspace, which resets on reload.

## Connect Supabase (free)

1. Create an account at https://supabase.com/dashboard and create a project on a **Free** organization. Choose a nearby region and keep your database password private.
2. Open SQL Editor. Run `supabase/migrations/202610060001_workspace.sql`, then `supabase/migrations/202610070001_productivity.sql`, once each in that order. Existing installations need only the second migration. Keep applied migrations immutable; use a new migration for future changes.
3. In Project Settings / API, obtain the project URL and the new `sb_publishable_…` public key. Do **not** use a secret key or a service-role key. This application deliberately supports the new public publishable key format only.
4. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in your hosting environment and redeploy. For local development, set these in the ignored `.env` file.
5. In Authentication / URL Configuration, set the Site URL to the final HTTPS app URL. Confirm email/password authentication is enabled. Set up a production email provider or a supported social sign-in flow before inviting a broad audience: Supabase's default mail delivery is restricted and is unsuitable for general public signup. The app currently implements email/password signup and login only.
6. Complete real email signup and cross-device login checks before inviting others. The deployed migrations and database workflows have been verified in live Supabase using a rollback-only transaction with two temporary owners; email delivery and real browser account sessions are separate checks.

All rows are scoped to `auth.uid()`. A composite foreign key prevents linking a task to a different user's note. Moving a note to Trash preserves its task links. Permanent deletion clears only the note link and keeps the task and owner. Captures and focus sessions also have owner policies. Inbox conversion runs in one retry-safe database transaction; focus controls use server timestamps and reject stale edits from another device. Anonymous database access is revoked. No attachment storage is provisioned because the initial version uses text notes only.

The currently checked Free plan includes 500 MB database storage and 1 GB file storage; projects can pause after a week of inactivity. See https://supabase.com/pricing for current limits. Maintain your own exports/backups; free hosting and storage do not guarantee uninterrupted production availability.

## Productivity features

- **Quick-capture inbox:** save a thought without filling out a task form, then convert it into a task. The original thought remains available under Converted thoughts. Failed saves retain the input.
- **Weekly planning:** assign tasks to a planned day separately from their deadlines, navigate weeks, and see remaining workload against a daily capacity. The capacity selector is a view preference that resets when the view is reopened; task assignments are saved.
- **Trash and undo:** tasks, notes, and inbox thoughts move to Trash first. Undo restores the most recent removal during the current session; Trash supports restore after a reload. Items remain until explicitly deleted permanently through a confirmation dialog.
- **Focus timer:** choose 5–480 minutes and optionally link an open task. Pause, resume, and finish sessions; elapsed time survives refreshes and excludes paused time. Finishing records actual focused time without automatically completing a task. One unfinished session per account is enforced in the database.

## Quality checks

- `npm run typecheck`
- `npm run test:coverage`: pure workflow and persistence error tests, plus real PostgreSQL-compatible PGlite migration, constraints, RLS, and ownership checks. Thresholds apply to `lib/organizer/` (90% statements/lines/functions and 85% branches), not the entire UI.
- `npx playwright install chromium`, then `npm run test:e2e`: desktop/mobile manual tasks, notes, search, planning, note deletion, AI-disabled behavior, configuration failure checks, keyboard focus/return/trapping, dialog centering and bounds, duration conversions and limits, responsive layout, and automated WCAG A/AA checks across all eight views, plus inbox conversion/retry failures, weekly assignment persistence, trash/undo/confirmed purge, and timer reload/pause/history behavior.
- `npm run build`: deployable Cloudflare Worker build.

CI runs all these gates. PGlite and mocked persistence tests are not a substitute for real Supabase authentication/email checks.

## Allure test reports

**Published report:** [Dayloom Allure report](https://suganthsundarraj.github.io/dayloom/). Check the associated [GitHub Actions run](https://github.com/SuganthSundarraj/dayloom/actions/workflows/quality.yml) for its commit, status, and coverage artifact.

Allure combines the Vitest unit/database suite and Playwright desktop/mobile suite in one HTML report. Browser steps, assertion failures, and failure screenshots/traces are included; coverage is uploaded separately alongside the report. Allure test pass rates are not code coverage percentages.

Use Node 24 and Java 17 or newer, then run:

```bash
npm ci
npx playwright install chromium
npm run test:report
npm run allure:open
```

`test:report` clears old results, runs both suites, and generates `allure-report/index.html` even if tests fail. Its exit status remains unsuccessful when any suite or generation fails. The single-file HTML can also be opened directly. Generated reports/results are ignored by Git. Individual test commands append Allure results; use `npm run allure:clean` before starting a fresh combined run and `npm run allure:generate` to generate manually.

GitHub Actions uploads the report, raw results, and coverage as the `allure-report` artifact with 30-day retention. Runs on `main` also publish the latest report at the [public Allure report URL](https://suganthsundarraj.github.io/dayloom/). Pull requests generate downloadable artifacts without replacing that public report. Failed test runs can publish a red report while the Quality job remains failed. If setup fails before results exist, there is no new report and the previously published report remains. Tests currently use demo/mocked data and temporary PostgreSQL-compatible databases, without production Supabase credentials.

Official integrations: https://allurereport.org/docs/playwright/ and https://allurereport.org/docs/vitest/.

## Update and redeploy

The application is live at [Dayloom](https://dayloom-personal-organizer.anywherework-0233.chatgpt.site/), with public source in [GitHub](https://github.com/SuganthSundarraj/dayloom). It also has a separate Sites source repository used for versioned application deployments.

1. Edit components/styles for UI changes, domain logic for behavior, or add a new SQL migration for schema changes.
2. Run the checks appropriate to the change. Application changes must pass type checking, lint, affected tests, the production dependency audit, and the Worker build.
3. Apply any new SQL migration to Supabase before deploying code that depends on it; do not reapply existing migrations.
4. Commit and push to GitHub. GitHub Actions runs the quality checks and publishes the generated Allure report to GitHub Pages from `main`.
5. For an application release, push the same source commit to the Sites source repository, build/package that exact source, save a version, and deploy it using the project identity in `.openai/hosting.json`.

**A GitHub push updates CI and the report; it does not automatically redeploy the Dayloom app.** Ask Codex to publish application changes through Sites. A README-only update needs no application redeployment. Keep runtime Supabase environment settings separate from source and preserve them across releases.

For independent hosting, Cloudflare Workers can run the built Worker with assets. A React static frontend on Cloudflare Pages plus Supabase is also viable, but this project currently includes a Worker for public runtime configuration and is not a plain static Pages export. Do not upload the source directory as static assets.

## Scope and tradeoffs

Memory currently uses transparent keyword search and original source notes, not embeddings or generated answers. Daily planning uses planned-today/overdue planned tasks, or overdue/due-today and undated tasks when no planned day is set, then deadline order, priority, duration, and stable ties; it never moves a future deadline or mutates tasks. Durations are user-entered and no calendar sync is performed. Simultaneous edits use last-write-wins. Large workspaces will require pagination before scaling. AI extraction remains off until a provider, secure server endpoint, usage limits, explicit review step, and failure tests are added; a missing provider never blocks the core workspace.

## Assistant workflow and project skills

Dayloom's [AGENTS.md](AGENTS.md) requires the assistant to consider implementation, verification, database impact, and release scope for every project change. You do not need to name individual skills in each request. Project skills are versioned under `.agents/skills/`:

- [dayloom-change](.agents/skills/dayloom-change/SKILL.md): implementation, architecture, UI standards, and final diff review.
- [dayloom-verify](.agents/skills/dayloom-verify/SKILL.md): relevant tests, accessibility, coverage, build checks, and accurate Allure evidence.
- [dayloom-database](.agents/skills/dayloom-database/SKILL.md): Supabase migrations, authentication, account isolation, and rollout order.
- [dayloom-release](.agents/skills/dayloom-release/SKILL.md): authorized commits/pushes, verification of CI for the delivered commit, and separate Sites deployment.

For example: “Add recurring tasks, test, push, and deploy” applies all relevant workflows. “Update this label locally” selects the affected implementation and validation without automatically pushing or deploying. GitHub Actions remains the executable quality gate; skills guide the assistant and do not themselves schedule jobs or grant external access.

## UI customization

The shared dialog uses the installed open-source Radix UI primitives. Keep presentation in the `.dialog-*` styles and behavior in `components/organizer/dialog.tsx`; do not create separate modal positioning or focus logic per editor. `app/globals.css` owns the palette variables, spacing, layouts, and responsive rules. Update shared components and their styles together. Duration formats are presentation only: Supabase still stores integer minutes (5–480).

For reusable components with editable source and CLI distribution, shadcn/ui is a suitable option (https://ui.shadcn.com/docs). It does not eliminate the need for responsive, accessibility, keyboard, and form-state checks. Dayloom now uses Radix directly for dialogs rather than claiming to have migrated every control to shadcn/ui.

After a UI edit, run `npm run typecheck`, `npm run lint`, and `npm run test:e2e`; rerun coverage when domain or persistence changes. Use the Sites workflow above to commit, push, and publish the checked source. Production Supabase configuration stays in the hosting environment across redeployments.
