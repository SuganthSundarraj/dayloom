import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
});
test("manual tasks work while AI is off", async ({ page }) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Prepare portfolio demo");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Prepare portfolio demo Personal" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Complete Prepare portfolio demo",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "All tasks", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByText("Prepare portfolio demo", { exact: true }),
  ).toBeVisible();
});
test("notes save with AI disabled and are discoverable", async ({ page }) => {
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Note title", { exact: true }).fill("Weekend idea");
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Try a pottery workshop on Saturday.");
  await page.getByRole("button", { name: "Check availability" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "not enabled",
  );
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page.getByRole("textbox", { name: "Search notes" }).fill("pottery");
  await expect(
    page.getByRole("heading", { name: "Weekend idea" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search notes" }).fill("unfindable");
  await expect(page.getByText("No matching notes.")).toBeVisible();
});
test("daily plan stays within available time", async ({ page }) => {
  await page.getByLabel("Time available").selectOption("30");
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("status")).toContainText(
    "15 of 30 minutes planned",
  );
});
test("linked task survives deleting its note", async ({ page }) => {
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await page
    .getByRole("button", { name: /A little direction for this week/ })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page
    .getByRole("button", { name: "All tasks", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Outline the presentation Work", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Linked note", exact: true }),
  ).toHaveValue("");
});
test("demo is honest about persistence and responsive", async ({ page }) => {
  await expect(
    page.getByText("Changes reset on reload.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/folio-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("configuration errors show a recoverable state", async ({ page }) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Please retry");
});
test("creating a linked task keeps note edits", async ({ page }) => {
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await page
    .getByRole("button", { name: /A little direction for this week/ })
    .click();
  await page
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Updated context for the linked task.");
  await page
    .getByRole("button", { name: "Create linked task", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: /A little direction for this week/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Updated context for the linked task.");
});
