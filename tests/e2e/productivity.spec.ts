import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoWorkspace } from "../../lib/organizer/domain";
import {
  transitionFocus,
  type FocusSession,
} from "../../lib/organizer/features";
const owner = "00000000-0000-4000-8000-000000000301";
async function storage(page: Page) {
  const seed = demoWorkspace();
  seed.tasks[0].due_date = "2026-10-20";
  const tables: Record<string, Record<string, unknown>[]> = {
    tasks: seed.tasks,
    notes: seed.notes,
    captures: [],
    focus_sessions: [],
  };
  const failures = new Set<string>();
  let serverTime = Date.parse("2026-10-07T10:00:00Z");
  await page.clock.setFixedTime(new Date(serverTime));
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        configured: true,
        url: "https://productivity-test.supabase.co",
        key: "sb_publishable_example",
      },
    }),
  );
  await page.route(
    "https://productivity-test.supabase.co/**",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table = url.pathname.split("/").pop()!;
      if (failures.has(`${table}:${request.method()}`))
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      if (url.pathname.endsWith("/auth/v1/token")) {
        const payload = Buffer.from(
          JSON.stringify({ sub: owner, exp: 9999999999, aud: "authenticated" }),
        ).toString("base64url");
        return route.fulfill({
          json: {
            access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
            refresh_token: "test-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: owner,
              email: "person@example.test",
              aud: "authenticated",
              role: "authenticated",
              app_metadata: {},
              user_metadata: {},
              created_at: new Date(serverTime).toISOString(),
            },
          },
        });
      }
      if (url.pathname.includes("/rpc/convert_capture")) {
        const { p_capture_id: id, p_task: task } = request.postDataJSON();
        const capture = tables.captures.find((item) => item.id === id)!;
        if (capture.converted_at)
          return route.fulfill({
            json: {
              capture,
              task: tables.tasks.find(
                (item) => item.id === capture.converted_task_id,
              ),
            },
          });
        Object.assign(capture, {
          converted_at: new Date(serverTime).toISOString(),
          converted_task_id: task.id,
        });
        tables.tasks.push(task);
        return route.fulfill({ json: { capture, task } });
      }
      if (url.pathname.includes("/rpc/control_focus")) {
        const input = request.postDataJSON();
        const current = tables.focus_sessions.find(
          (item) => item.id === input.p_id,
        );
        const stamp = new Date(serverTime).toISOString();
        const next =
          input.p_action === "start"
            ? {
                id: input.p_id,
                task_id: input.p_task_id,
                target_minutes: input.p_target_minutes,
                elapsed_seconds: 0,
                running_since: stamp,
                completed_at: null,
                created_at: stamp,
                updated_at: stamp,
              }
            : transitionFocus(
                current as unknown as FocusSession,
                input.p_action,
                serverTime,
              );
        tables.focus_sessions = [
          next as unknown as Record<string, unknown>,
          ...tables.focus_sessions.filter((item) => item.id !== input.p_id),
        ];
        return route.fulfill({ json: next });
      }
      if (url.pathname.includes("/rest/v1/")) {
        const records = tables[table];
        if (!records) return route.fulfill({ status: 404, json: {} });
        const id = url.searchParams.get("id")?.replace("eq.", "");
        if (request.method() === "POST") {
          const record = request.postDataJSON();
          tables[table] = [
            record,
            ...records.filter((item) => item.id !== record.id),
          ];
          return route.fulfill({ status: 201, body: "" });
        }
        if (request.method() === "PATCH") {
          const record = records.find((item) => item.id === id)!;
          Object.assign(record, request.postDataJSON());
          return route.fulfill({ json: { id } });
        }
        if (request.method() === "DELETE") {
          tables[table] = records.filter((item) => item.id !== id);
          return route.fulfill({ json: { id } });
        }
        return route.fulfill({ json: records });
      }
      return route.fulfill({ json: {} });
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Sign in or create an account" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("person@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Connected to Supabase", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  return {
    tables,
    failures,
    advance: async (seconds: number) => {
      serverTime += seconds * 1000;
      await page.clock.setFixedTime(new Date(serverTime));
    },
  };
}
async function navigate(page: Page, name: string) {
  await expect(page.locator(".page-heading").getByRole("button")).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true }),
  ).toHaveAttribute("aria-current", "page");
}
test("quick capture saves, reloads, converts once, and retains its original thought", async ({
  page,
}) => {
  const mock = await storage(page);
  await page
    .getByLabel("Quick capture", { exact: true })
    .fill("Ask Maya about the revised launch date");
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await expect(page.getByLabel("Quick capture", { exact: true })).toHaveValue(
    "",
  );
  expect(mock.tables.captures[0].user_id).toBe(owner);
  await page.reload();
  await navigate(page, "Inbox");
  await expect(
    page.getByText("Ask Maya about the revised launch date", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create task", exact: true }),
  ).toHaveCount(0);
  expect(
    mock.tables.tasks.filter(
      (item) => item.title === "Ask Maya about the revised launch date",
    ),
  ).toHaveLength(1);
  await page.getByText("Converted thoughts", { exact: true }).click();
  await expect(
    page.getByText("Ask Maya about the revised launch date", { exact: true }),
  ).toBeVisible();
});
test("conversion completed on another device reconciles the original task without duplication", async ({
  page,
}) => {
  const mock = await storage(page);
  await page
    .getByLabel("Quick capture", { exact: true })
    .fill("Outline the presentation");
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await expect(page.getByLabel("Quick capture", { exact: true })).toHaveValue(
    "",
  );
  await navigate(page, "Inbox");
  // Another device converted this thought to an already-loaded task.
  Object.assign(mock.tables.captures[0], {
    converted_at: new Date("2026-10-07T10:00:00Z").toISOString(),
    converted_task_id: mock.tables.tasks[0].id,
  });
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /^All tasks/ })
    .click();
  await expect(
    page.locator(".task-main").filter({ hasText: "Outline the presentation" }),
  ).toHaveCount(1);
  expect(mock.tables.tasks).toHaveLength(3);
});
test("failed capture and failed conversion preserve recoverable input", async ({
  page,
}) => {
  const mock = await storage(page);
  mock.failures.add("captures:POST");
  await page
    .getByLabel("Quick capture", { exact: true })
    .fill("Keep this thought");
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await expect(page.getByRole("alert")).toContainText("input is still here");
  await expect(page.getByLabel("Quick capture", { exact: true })).toHaveValue(
    "Keep this thought",
  );
  mock.failures.clear();
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await navigate(page, "Inbox");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  mock.failures.add("convert_capture:POST");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "inbox item is still here",
  );
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Keep this thought",
  );
  expect(mock.tables.tasks).toHaveLength(3);
});
test("weekly assignments persist, warn about capacity, and preserve deadlines", async ({
  page,
}) => {
  const mock = await storage(page);
  await navigate(page, "Weekly plan");
  await page
    .getByLabel("Plan Outline the presentation", { exact: true })
    .selectOption("2026-10-07");
  await expect(
    page.getByLabel("Plan Outline the presentation", { exact: true }),
  ).toHaveValue("2026-10-07");
  expect(
    mock.tables.tasks.find((item) => item.title === "Outline the presentation")!
      .due_date,
  ).toBe("2026-10-20");
  await page.reload();
  await navigate(page, "Weekly plan");
  await expect(
    page.getByLabel("Plan Outline the presentation", { exact: true }),
  ).toHaveValue("2026-10-07");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Long study session");
  await page.getByLabel("Planned day", { exact: true }).fill("2026-10-07");
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("180");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Plan for 2026-10-07" }),
  ).toContainText("225 / 120 min · Over capacity");
  await page
    .getByLabel("Plan Outline the presentation", { exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Plan for 2026-10-12" }),
  ).toBeVisible();
});
test("trash persists, undo restores, and permanent deletion is confirmed", async ({
  page,
}) => {
  const mock = await storage(page);
  await page
    .getByLabel("Quick capture", { exact: true })
    .fill("A recoverable thought");
  await page.getByRole("button", { name: "Add to inbox" }).click();
  await navigate(page, "Inbox");
  await page
    .getByRole("button", { name: "Trash thought: A recoverable thought" })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByText("A recoverable thought", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Trash thought: A recoverable thought" })
    .click();
  await page.reload();
  await navigate(page, "Trash");
  await expect(
    page.getByRole("heading", { name: "A recoverable thought", exact: true }),
  ).toBeVisible();
  mock.failures.add("captures:PATCH");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be moved");
  await expect(
    page.getByRole("heading", { name: "A recoverable thought", exact: true }),
  ).toBeVisible();
  mock.failures.clear();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(mock.tables.captures).toHaveLength(1);
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByText("Nothing in trash.")).toBeVisible();
  expect(mock.tables.captures).toHaveLength(0);
});
test("timer persists across refresh, excludes paused time, and records actual focus", async ({
  page,
}) => {
  const mock = await storage(page);
  await page
    .getByRole("button", {
      name: "Focus on Outline the presentation",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Focus on", exact: true }),
  ).toHaveValue(String(mock.tables.tasks[0].id));
  await page.getByRole("button", { name: "Start focus", exact: true }).click();
  await mock.advance(10);
  await page.reload();
  await navigate(page, "Focus timer");
  await expect(page.getByRole("timer")).toHaveText("24:50");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await mock.advance(60);
  await expect(page.getByRole("timer")).toHaveText("24:50");
  mock.failures.add("control_focus:POST");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "timer could not be saved",
  );
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  mock.failures.clear();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await mock.advance(5);
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Focus history" }),
  ).toContainText("0 min 15 sec");
  expect(mock.tables.tasks[0].completed).toBe(false);
  await page.reload();
  await navigate(page, "Focus timer");
  await expect(
    page.getByRole("region", { name: "Focus history" }),
  ).toContainText("0 min 15 sec");
});
test("new views are accessible and fit desktop and mobile", async ({
  page,
}) => {
  await storage(page);
  for (const name of ["Inbox", "Weekly plan", "Trash", "Focus timer"]) {
    await navigate(page, name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations, JSON.stringify(scan.violations, null, 2)).toEqual(
      [],
    );
    await page.screenshot({
      path: `test-results/dayloom-${name.replaceAll(" ", "-")}-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
});
