# Dayloom project instructions

These instructions apply to Dayloom, the independent web repository in this directory. Use Dayloom's React/TypeScript and Supabase conventions for this project; SchedulingEngine Java modules, Jira naming, and Gradle procedures do not describe this application. Preserve applicable parent security instructions, including scanning files for secrets before reading them.

## Required routing for every change request

Consider all four skills below whenever a request changes this project. Read the applicable skill files before performing their steps, scanning each file for secrets first. Do not depend only on automatic skill discovery. No special invocation from the user is needed.

| Skill | When to apply |
| --- | --- |
| [dayloom-change](.agents/skills/dayloom-change/SKILL.md) | Every project change, including UI, behavior, dependencies, automation, and documentation. |
| [dayloom-verify](.agents/skills/dayloom-verify/SKILL.md) | Every change; choose validation proportional to the affected behavior. |
| [dayloom-database](.agents/skills/dayloom-database/SKILL.md) | Schema, migrations, authentication, persistence, ownership, or database-dependent behavior. Otherwise record no database impact. |
| [dayloom-release](.agents/skills/dayloom-release/SKILL.md) | Commit, push, CI/report publication, or application deployment when included in the user's authorized delivery scope. Otherwise identify any remaining release steps. |

Considering all skills means evaluating applicability, not running unrelated steps. A local edit does not implicitly authorize a push or production deployment. Follow existing authorization without asking again. Read-only questions need only the guidance relevant to the question.

## Project invariants

- Keep business rules in `lib/organizer/`, storage operations in `lib/organizer/repository.ts`, and presentation in `components/organizer/` and `app/globals.css`. Prefer cohesive reusable components and explicit error states.
- Retain strict TypeScript, responsive desktop/mobile layouts, semantic controls, accessible labels, keyboard operation, and the shared Radix dialog. Reuse duration controls and domain validation.
- Supabase Postgres and Auth own saved user data. Enforce ownership with RLS and database constraints independently of the UI. Expose only public connection settings; never expose secret/service-role credentials.
- Keep tasks, notes, captures, planned dates, trash/restore, and focus sessions consistent through reloads and failed writes. Demo data must remain visibly transient.
- AI extraction remains disabled unless explicitly requested. Provider absence or failure must never block manual workflows; enabling AI requires a separate secure design and tests.
- Do not mask defects by weakening assertions, skipping checks, or suppressing errors. Distinguish regressions, environment failures, and proven pre-existing problems.
- GitHub Actions checks and publishes Allure to GitHub Pages. Sites separately deploys the app. Never claim a GitHub push deployed the application.
- Keep README setup, behavior, technology roles, and verified links current when affected. Report only actual validation and deployment evidence.

## Completion

Review the final diff for scope, compatibility, data isolation, failure handling, and unintended changes. State what changed, validation performed, and any unresolved limitations. For authorized release work, also provide the commit, CI outcome, and verified deployment/report links as applicable.
