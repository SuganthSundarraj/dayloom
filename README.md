# Dayloom — Notes & Tasks

A responsive personal organizer with manual tasks, linked notes, keyword memory search, and deterministic daily planning. AI extraction is deliberately disabled: there are no provider calls, API keys, or AI charges. A labelled, transient sample workspace is shown until Supabase is configured. Demo changes are never represented as saved data.

## Stack and structure

React 19, strict TypeScript, Vinext (Next-compatible routes), Cloudflare Workers hosting, and Supabase Postgres/Auth. `components/organizer/` owns UI, with `day-view.tsx` keeping the daily composition separate from the workspace controller; `lib/organizer/domain.ts` owns pure validation, planning, search, and the disabled extraction boundary; `repository.ts` owns persistence; `app/api/config/route.ts` exposes only a public publishable key. Database constraints and Row Level Security enforce ownership independently of the UI. No service-role key is required or accepted by the public configuration endpoint.

## Run locally

Use Node 24 LTS. Run `npm ci`, then `npm run dev`. To test real storage, create `.env` from `.env.example` and fill the public connection values. Never commit credentials. Without Supabase configuration the app opens a sample workspace, which resets on reload.

## Connect Supabase (free)

1. Create an account at https://supabase.com/dashboard and create a project on a **Free** organization. Choose a nearby region and keep your database password private.
2. Open SQL Editor. Run `supabase/migrations/202610060001_workspace.sql` once. Keep this initial migration immutable after deployment; use a new migration for future changes.
3. In Project Settings / API, obtain the project URL and the new `sb_publishable_…` public key. Do **not** use a secret key or a service-role key. This application deliberately supports the new public publishable key format only.
4. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in your hosting environment and redeploy. For local development, set these in the ignored `.env` file.
5. In Authentication / URL Configuration, set the Site URL to the final HTTPS app URL. Confirm email/password authentication is enabled. Set up a production email provider or a supported social sign-in flow before inviting a broad audience: Supabase's default mail delivery is restricted and is unsuitable for general public signup. The app currently implements email/password signup and login only.
6. Create two test users and verify real cross-device persistence and isolation before inviting others. Until this is done, live Supabase integration remains unverified.

All rows are scoped to `auth.uid()`. A composite foreign key prevents linking a task to a different user's note. Deleting a note clears only the task's note link and keeps the task and owner. Anonymous database access is revoked. No attachment storage is provisioned because the initial version uses text notes only.

The currently checked Free plan includes 500 MB database storage and 1 GB file storage; projects can pause after a week of inactivity. See https://supabase.com/pricing for current limits. Maintain your own exports/backups; free hosting and storage do not guarantee uninterrupted production availability.

## Quality checks

- `npm run typecheck`
- `npm run test:coverage`: pure workflow and persistence error tests, plus real PostgreSQL-compatible PGlite migration, constraints, RLS, and ownership checks. Thresholds apply to `lib/organizer/` (90% statements/lines/functions and 85% branches), not the entire UI.
- `npx playwright install chromium`, then `npm run test:e2e`: desktop/mobile manual tasks, notes, search, planning, note deletion, AI-disabled behavior, configuration failure checks, keyboard focus/return, responsive layout, and automated WCAG A/AA checks across all four views.
- `npm run build`: deployable Cloudflare Worker build.

CI runs all these gates. PGlite and mocked persistence tests are not a substitute for real Supabase authentication/email checks.

## Update and redeploy

This project has its own hosted source repository and versioned deployments via Sites. Keep changes within this directory. Ask Codex to update Dayloom and publish it; it will run checks, push the source, save a version, and deploy it using `.openai/hosting.json`'s project identity. The deployable archive is built from the same pushed source commit. Keep hosted environment settings separate from source.

For independent hosting, Cloudflare Workers can run the built Worker with assets. A React static frontend on Cloudflare Pages plus Supabase is also viable, but this project currently includes a Worker for public runtime configuration and is not a plain static Pages export. Do not upload the source directory as static assets.

## Scope and tradeoffs

Memory currently uses transparent keyword search and original source notes, not embeddings or generated answers. Planning uses overdue/due-today and undated tasks, deadline order, priority, duration, and stable ties; it never moves a future deadline or mutates tasks. Durations are user-entered and no calendar sync is performed. Simultaneous edits use last-write-wins. Large workspaces will require pagination before scaling. AI extraction remains off until a provider, secure server endpoint, usage limits, explicit review step, and failure tests are added; a missing provider never blocks the core workspace.
