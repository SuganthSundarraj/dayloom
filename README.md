# Dayloom — Notes & Tasks

A responsive personal organizer with manual tasks, linked notes, a quick-capture inbox, weekly planning, recoverable trash, a persistent focus timer, keyword memory search, and deterministic daily planning. AI extraction is deliberately disabled: there are no provider calls, API keys, or AI charges. A labelled, transient sample workspace is shown until Supabase is configured. Demo changes are never represented as saved data.

## Stack and structure

React 19, strict TypeScript, Vinext (Next-compatible routes), Cloudflare Workers hosting, and Supabase Postgres/Auth. `components/organizer/` owns UI, with `day-view.tsx` keeping the daily composition separate from the workspace controller, a shared Radix UI dialog for modal/focus behavior, and `duration-field.tsx` for minutes, decimal hours, or hours-plus-minutes entry; `lib/organizer/domain.ts` owns pure validation, planning, search, and the disabled extraction boundary; `lib/organizer/features.ts` owns calendar and timer transformations; `productivity-views.tsx` presents the four productivity views; `repository.ts` owns persistence; `app/api/config/route.ts` exposes only a public publishable key. Database constraints and Row Level Security enforce ownership independently of the UI. No service-role key is required or accepted by the public configuration endpoint.

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

Allure combines the Vitest unit/database suite and Playwright desktop/mobile suite in one HTML report. Browser steps, assertion failures, and failure screenshots/traces are included; coverage is uploaded separately alongside the report. Allure test pass rates are not code coverage percentages.

Use Node 24 and Java 17 or newer, then run:

```bash
npm ci
npx playwright install chromium
npm run test:report
npm run allure:open
```

`test:report` clears old results, runs both suites, and generates `allure-report/index.html` even if tests fail. Its exit status remains unsuccessful when any suite or generation fails. The single-file HTML can also be opened directly. Generated reports/results are ignored by Git. Individual test commands append Allure results; use `npm run allure:clean` before starting a fresh combined run and `npm run allure:generate` to generate manually.

GitHub Actions uploads the report, raw results, and coverage as the `allure-report` artifact with 30-day retention. Runs on `main` also publish the latest report at https://suganthsundarraj.github.io/dayloom/. Pull requests generate downloadable artifacts without replacing that public report. Failed test runs can publish a red report while the Quality job remains failed. If setup fails before results exist, there is no new report and the previously published report remains. Tests currently use demo/mocked data and temporary PostgreSQL-compatible databases, without production Supabase credentials.

Official integrations: https://allurereport.org/docs/playwright/ and https://allurereport.org/docs/vitest/.

## Update and redeploy

This project has its own hosted source repository and versioned deployments via Sites. Keep changes within this directory. Ask Codex to update Dayloom and publish it; it will run checks, push the source, save a version, and deploy it using `.openai/hosting.json`'s project identity. The deployable archive is built from the same pushed source commit. Keep hosted environment settings separate from source.

For independent hosting, Cloudflare Workers can run the built Worker with assets. A React static frontend on Cloudflare Pages plus Supabase is also viable, but this project currently includes a Worker for public runtime configuration and is not a plain static Pages export. Do not upload the source directory as static assets.

## Scope and tradeoffs

Memory currently uses transparent keyword search and original source notes, not embeddings or generated answers. Daily planning uses planned-today/overdue planned tasks, or overdue/due-today and undated tasks when no planned day is set, then deadline order, priority, duration, and stable ties; it never moves a future deadline or mutates tasks. Durations are user-entered and no calendar sync is performed. Simultaneous edits use last-write-wins. Large workspaces will require pagination before scaling. AI extraction remains off until a provider, secure server endpoint, usage limits, explicit review step, and failure tests are added; a missing provider never blocks the core workspace.

## UI customization

The shared dialog uses the installed open-source Radix UI primitives. Keep presentation in the `.dialog-*` styles and behavior in `components/organizer/dialog.tsx`; do not create separate modal positioning or focus logic per editor. `app/globals.css` owns the palette variables, spacing, layouts, and responsive rules. Update shared components and their styles together. Duration formats are presentation only: Supabase still stores integer minutes (5–480).

For reusable components with editable source and CLI distribution, shadcn/ui is a suitable option (https://ui.shadcn.com/docs). It does not eliminate the need for responsive, accessibility, keyboard, and form-state checks. Dayloom now uses Radix directly for dialogs rather than claiming to have migrated every control to shadcn/ui.

After a UI edit, run `npm run typecheck`, `npm run lint`, and `npm run test:e2e`; rerun coverage when domain or persistence changes. Use the Sites workflow above to commit, push, and publish the checked source. Production Supabase configuration stays in the hosting environment across redeployments.
