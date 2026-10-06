import { test, expect, type Page } from "@playwright/test";
const owner = "00000000-0000-4000-8000-000000000101";
async function mockStorage(page: Page, failSave: boolean) {
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        configured: true,
        url: "https://dayloom-test.supabase.co",
        key: "sb_publishable_example",
      },
    }),
  );
  await page.route("https://dayloom-test.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.includes("/auth/v1/token")) {
      const payload = Buffer.from(
        JSON.stringify({
          sub: owner,
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "authenticated",
        }),
      ).toString("base64url");
      await route.fulfill({
        json: {
          access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
          refresh_token: "test-refresh",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id: owner,
            email: "person@example.test",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        },
      });
      return;
    }
    if (url.pathname.includes("/rest/v1/")) {
      if (request.method() === "POST") {
        if (failSave) {
          await route.fulfill({
            status: 503,
            json: { message: "temporarily unavailable" },
          });
          return;
        }
        saved.push(request.postDataJSON());
        await route.fulfill({ status: 201, body: "" });
        return;
      }
      await route.fulfill({
        json: url.pathname.endsWith("/notes") ? saved : [],
      });
      return;
    }
    await route.fulfill({ json: {} });
  });
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
  return saved;
}
async function writeNote(page: Page) {
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByLabel("Note title", { exact: true })
    .fill("A private thought");
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Keep my input when storage fails.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
}
test("storage failure preserves editable note text", async ({ page }) => {
  await mockStorage(page, true);
  await writeNote(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "input is still here",
  );
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Keep my input when storage fails.");
  await expect(
    page.getByRole("button", { name: "Save note", exact: true }),
  ).toBeEnabled();
});
test("saved notes are attributed to the user and loaded after reload", async ({
  page,
}) => {
  const saved = await mockStorage(page, false);
  await writeNote(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(saved[0].user_id).toBe(owner);
  await page.reload();
  await page.getByRole("button", { name: "My notes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A private thought", exact: true }),
  ).toBeVisible();
});
