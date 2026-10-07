import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { configured: false, url: "", key: "" } }),
  );
  await page.goto("/");
  await expect(page.getByText("Demo workspace", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
});

test("task dialog is centered and its close button aligns with the title", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New task", exact: true });
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - viewport!.width / 2),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - viewport!.height / 2),
  ).toBeLessThanOrEqual(2);
  const close = await dialog
    .getByRole("button", { name: "Close dialog" })
    .boundingBox();
  const title = await dialog
    .getByRole("heading", { name: "New task", exact: true })
    .boundingBox();
  expect(close!.x + close!.width).toBeGreaterThan(
    bounds!.x + bounds!.width - 45,
  );
  expect(
    Math.abs(close!.y + close!.height / 2 - title!.y - title!.height / 2),
  ).toBeLessThan(8);
  await page.screenshot({
    path: `test-results/dayloom-task-dialog-${test.info().project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeFocused();
});

test("duration formats preserve the saved time estimate", async ({ page }) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Task title", { exact: true })
    .fill("Time estimate check");
  await dialog
    .getByRole("combobox", { name: "Duration format", exact: true })
    .selectOption("hours");
  await dialog.getByLabel("Duration (hours)", { exact: true }).fill("1.5");
  await dialog
    .getByRole("combobox", { name: "Duration format", exact: true })
    .selectOption("mixed");
  await expect(dialog.getByLabel("Hours", { exact: true })).toHaveValue("1");
  await expect(dialog.getByLabel("Minutes", { exact: true })).toHaveValue("30");
  await dialog.getByLabel("Minutes", { exact: true }).fill("45");
  await dialog
    .getByRole("combobox", { name: "Duration format", exact: true })
    .selectOption("minutes");
  await expect(
    dialog.getByLabel("Duration (minutes)", { exact: true }),
  ).toHaveValue("105");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Time estimate check Personal", exact: true })
    .click();
  await expect(
    page.getByLabel("Duration (minutes)", { exact: true }),
  ).toHaveValue("105");
});

test("invalid and oversized durations keep the editor open", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Task title", { exact: true })
    .fill("Valid duration only");
  await dialog
    .getByRole("combobox", { name: "Duration format", exact: true })
    .selectOption("hours");
  const decimal = dialog.getByLabel("Duration (hours)", { exact: true });
  await decimal.fill("1.2345");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(
    await decimal.evaluate(
      (element: HTMLInputElement) => element.validationMessage,
    ),
  ).toContain("whole minutes");
  await dialog
    .getByRole("combobox", { name: "Duration format", exact: true })
    .selectOption("mixed");
  await dialog.getByLabel("Hours", { exact: true }).fill("8");
  await dialog.getByLabel("Minutes", { exact: true }).fill("1");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Minutes", { exact: true }).fill("0");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Valid duration only Personal", exact: true })
    .click();
  await expect(
    page.getByLabel("Duration (minutes)", { exact: true }),
  ).toHaveValue("480");
});

test("five-minute minimum is enforced and blank duration is not saved", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title", { exact: true }).fill("A small step");
  const duration = dialog.getByLabel("Duration (minutes)", { exact: true });
  for (const invalid of ["", "4"]) {
    await duration.fill(invalid);
    await dialog
      .getByRole("button", { name: "Save task", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    expect(
      await duration.evaluate((element: HTMLInputElement) =>
        element.checkValidity(),
      ),
    ).toBe(false);
  }
  await duration.fill("5");
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "A small step Personal", exact: true })
    .click();
  await expect(
    page.getByLabel("Duration (minutes)", { exact: true }),
  ).toHaveValue("5");
});

test("all editors fit the viewport, keep close reachable, and trap keyboard focus", async ({
  page,
}) => {
  async function checkPopup(name: string) {
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(15);
    expect(bounds!.y).toBeGreaterThanOrEqual(15);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 15);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      viewport.height - 15,
    );
    expect(
      Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
    ).toBeLessThanOrEqual(2);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeInViewport();
    const scan = await new (await import("@axe-core/playwright")).default({
      page,
    })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations, JSON.stringify(scan.violations, null, 2)).toEqual(
      [],
    );
    await page.screenshot({
      path: `test-results/dayloom-${name.toLowerCase().replaceAll(" ", "-")}-dialog-${test.info().project.name}.png`,
    });
    await dialog.getByRole("button", { name: "Close dialog" }).click();
  }
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await checkPopup("Settings & connection");
  await page
    .getByRole("button", { name: "Open your account", exact: true })
    .click();
  await checkPopup("Your private workspace");
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await checkPopup("New note");
  await page
    .getByRole("button", { name: /A little direction for this week/ })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await checkPopup("Move to trash?");
});
