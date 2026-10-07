---
name: dayloom-release
description: Deliver authorized Dayloom commits, GitHub pushes, CI and Allure verification, and Sites application releases from the tested source commit.
---

# Release Dayloom

Consider delivery for every change, but perform external actions only within the user's current or continuing authorization. Local implementation alone does not authorize pushing, PR creation, or deployment. Do not request permission again when the conversation already authorizes the action.

1. Confirm repository, current branch, remote, and intended diff. Use the Dayloom repository, not its parent SchedulingEngine repository. Preserve unrelated work; never force-push, reset others' work, or stage broad unrelated files.
2. Complete [verification](../dayloom-verify/SKILL.md) and any applicable [database](../dayloom-database/SKILL.md) work. Relevant regressions block release. Stage only intended paths and create focused descriptive commits. Create branches under `codex/` when a new branch is needed, unless the user specifies otherwise.
3. Push when authorized. Inspect GitHub Actions for the exact pushed SHA, wait for terminal results with reasonable intervals, and diagnose failures. A prior green run is not evidence for this commit. If PR delivery is requested, create/update a relevant PR and attach it using Codex's artifact tool when available.
4. Verify Allure publication separately from the Quality job. GitHub Pages may publish a red report while Quality remains failed. Confirm actual outcomes and distinguish test pass rates from code coverage. Public report: https://suganthsundarraj.github.io/dayloom/.
5. A documentation/skill-only update requires no application redeployment. A GitHub push runs CI/report publication; it does not redeploy the app.
6. When an application deployment is authorized, use the available Sites hosting skill and tools. Read `.openai/hosting.json` after secret scanning and verify project identity. Deploy the exact tested source commit through the Sites source repository and versioned packaging process. Preserve runtime Supabase settings and apply prerequisites first. Do not invent CLI commands or substitute another provider without a requested hosting change.
7. Obtain terminal deployment evidence, then check the live app and affected workflows. Record the version/commit and actual checks. App: https://dayloom-personal-organizer.anywherework-0233.chatgpt.site/.

If credentials, tools, CI, or deployment are unavailable, report the precise unfinished step and complete independent authorized work. End with the commit, CI outcome, report/app links where verified, and any blockers. Never label a push alone as a successful app release.
