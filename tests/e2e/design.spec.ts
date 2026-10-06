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
