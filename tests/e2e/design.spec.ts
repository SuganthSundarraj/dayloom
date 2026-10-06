import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Dayloom navigation and views remain accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Dayloom home" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Dayloom — Notes & Tasks");
  for (const name of ["Today", "All tasks", "My notes", "Memory"]) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: name !== "All tasks" })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations,
      JSON.stringify(accessibility.violations, null, 2),
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/dayloom-${name.toLowerCase().replaceAll(" ", "-")}-${test.info().project.name}.png`,
      fullPage: true,
    });
  }
});
test("task editor supports keyboard input and dismissal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Task title", exact: true }),
  ).toBeFocused();
  await page.keyboard.type("A keyboard-created task");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeFocused();
});

test("dashboard status reflects task completion and reopening", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  const status = page.getByRole("region", { name: "Task status" });
  await expect(status).toContainText("0 tasks");
  await page
    .getByRole("button", {
      name: "Complete Outline the presentation",
      exact: true,
    })
    .click();
  const completed = page.getByRole("region", { name: "Completed tasks" });
  await expect(
    completed.getByRole("button", {
      name: "Reopen Outline the presentation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(status).toContainText("33% of all tasks");
  await completed
    .getByRole("button", {
      name: "Reopen Outline the presentation",
      exact: true,
    })
    .click();
  await expect(completed).toContainText(
    "Your finished tasks will appear here.",
  );
  await expect(status).toContainText("0 tasks");
});
test("header search opens matching tasks and settings stays accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Quick task search" })
    .fill("reading");
  await page.getByRole("button", { name: "Find tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My tasks", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Make time for a little reading Personal",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Outline the presentation Work · Linked note",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Settings & connection" }),
  ).toBeVisible();
});
