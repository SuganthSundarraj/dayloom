---
name: dayloom-change
description: Implement Dayloom UI, behavior, dependency, automation, and documentation changes using the project's architecture and relevant verification, database, and release workflows.
---

# Change Dayloom

1. Establish the requested outcome and delivery scope from the conversation. Inspect Git status and preserve unrelated changes. Confirm the working repository is Dayloom before mutations.
2. Follow `../../../AGENTS.md`. Scan files with `sonar analyze secrets <path>` before reading; stop on a detected secret and follow the parent's remediation protocol. If scanning is unavailable, report that limitation rather than reading unscanned files.
3. Trace the affected UI, domain rules, persistence calls, and existing tests. Consider [verification](../dayloom-verify/SKILL.md), [database](../dayloom-database/SKILL.md), and [release](../dayloom-release/SKILL.md) for every request; apply only relevant steps within authorized scope.
4. Implement the smallest cohesive change. Keep transformations and validation in `lib/organizer/`, Supabase access behind the repository layer, and shared UI behavior in existing components. Preserve current contracts unless the requested scope changes them.
5. For UI changes, preserve mobile layouts, empty/loading/error states, keyboard focus, dialog centering/dismissal, and form input on failed saves. Use the shared Radix dialog and duration field rather than recreating them.
6. Add meaningful tests for changed behavior and update affected README instructions. Do not add tests that merely assert instruction wording or mirror implementation details.
7. Run applicable verification, inspect the final diff and callers, then complete authorized delivery. Report database and release applicability alongside concrete results; do not describe unperformed checks as passed.
