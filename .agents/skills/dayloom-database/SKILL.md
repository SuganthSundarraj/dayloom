---
name: dayloom-database
description: Change Dayloom Supabase migrations, authentication, persistence, and ownership rules with SQL constraints, RLS tests, and safe deployment ordering.
---

# Change Dayloom storage

Apply when a change affects saved data, authentication, SQL, ownership, or database-dependent behavior. For other changes, record no database impact and proceed.

- Scan before reading migrations, repository code, configuration, and tests. Never read or publish credential values. Use Supabase URL/public publishable key for frontend settings; secret/service-role keys must never enter client code, logs, README, or committed files.
- Inspect `supabase/migrations/` and `lib/organizer/repository.ts` together with callers. Reuse existing repository and transactional RPC behavior when its semantics match.
- Keep applied migrations immutable; add ordered migrations for new changes. Preserve existing rows and backward compatibility during rollout. Explain and obtain authorization for destructive data changes not already requested.
- Enforce `auth.uid()` ownership through RLS, grants, foreign keys, and function checks. Test owner access, cross-owner rejection, and anonymous rejection where applicable. Client filtering is insufficient.
- Preserve atomic, retry-safe capture conversion, note/task relationships, reversible trash, integer minute durations, planned dates distinct from deadlines, and server-time focus controls when touched. Exercise concurrent/stale edits and partial failures where relevant.
- Add PGlite migration/constraint/ownership tests and repository success/failure tests. Inspect deployment requirements independently: mocked browser tests do not prove real Supabase signup or email delivery.
- When live application/database delivery is authorized, apply required migrations before code that depends on them. Verify the exact project identity against deployment configuration without printing secrets. Prefer isolated or rollback-only verification; never experiment on real user rows.
- If live access is unavailable, complete reviewable migrations/tests and report exactly what remains unapplied. Never claim local SQL execution applied a production migration.
