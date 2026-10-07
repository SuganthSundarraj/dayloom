import { expect, test, type Page } from "@playwright/test";

async function openFocus(
  page: Page,
  mode:
    | "granted"
    | "denied"
    | "unsupported"
    | "error"
    | "blocked-audio" = "granted",
) {
  await page.clock.install();
  await page.addInitScript((mode) => {
    const events: string[] = [];
    Object.assign(window, { focusAlertEvents: events });
    class TestAudio {
      state = "suspended";
      currentTime = 0;
      destination = {};
      async resume() {
        if (mode === "blocked-audio") throw new Error("Blocked");
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          disconnect() {},
          start() {
            events.push("tone");
          },
          stop() {},
          onended: null,
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    }
    class TestNotification {
      static permission = "default";
      static async requestPermission() {
        events.push("permission");
        TestNotification.permission = mode === "denied" ? "denied" : "granted";
        return TestNotification.permission;
      }
      constructor() {
        if (mode === "error") throw new Error("Unavailable");
        events.push("notification");
      }
      close() {}
    }
    Object.defineProperty(window, "AudioContext", {
      value: TestAudio,
      configurable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: mode === "unsupported" ? undefined : TestNotification,
      configurable: true,
    });
  }, mode);
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { configured: false, url: "", key: "" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Focus timer", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Session duration (minutes)" }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page
    .getByRole("spinbutton", { name: "Session duration (minutes)" })
    .fill("2");
  await page.getByRole("button", { name: "Start focus", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("02:00");
}
async function events(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { focusAlertEvents: string[] }).focusAlertEvents,
  );
}
test("two-minute minimum rejects one minute and alerts once across views", async ({
  page,
}) => {
  await openFocus(page);
  await page
    .getByRole("spinbutton", { name: "Session duration (minutes)" })
    .fill("1");
  await page.getByRole("button", { name: "Start focus", exact: true }).click();
  await expect(page.getByRole("spinbutton")).toBeVisible();
  expect(await events(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Enable desktop notifications" })
    .click();
  await expect(
    page.getByRole("button", { name: "Notifications enabled" }),
  ).toBeDisabled();
  await start(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "My notes", exact: true })
    .click();
  await page.clock.fastForward(119000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.clock.fastForward(1000);
  await expect(page.getByRole("alert")).toContainText(
    "Your focus timer has ended",
  );
  await expect(page).toHaveTitle("Time’s up — Dayloom");
  expect(await events(page)).toEqual([
    "permission",
    "tone",
    "tone",
    "tone",
    "notification",
  ]);
  await page.clock.fastForward(10000);
  await page.getByRole("button", { name: "View focus timer" }).click();
  expect(await events(page)).toHaveLength(5);
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveTitle("Dayloom — Notes & Tasks");
});
test("paused and early-finished timers do not alert", async ({ page }) => {
  await openFocus(page);
  await start(page);
  await page.clock.fastForward(30000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(120000);
  await expect(page.getByRole("timer")).toHaveText("01:30");
  expect(await events(page)).toEqual([]);
  await page.getByRole("button", { name: "Finish session" }).click();
  await page.clock.fastForward(120000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await events(page)).toEqual([]);
});
test("muted sound preserves the in-app alert", async ({ page }) => {
  await openFocus(page);
  await page.getByRole("checkbox", { name: "Sound when time is up" }).uncheck();
  await start(page);
  await page.clock.fastForward(120000);
  await expect(page.getByRole("alert")).toContainText("Time’s up");
  expect(await events(page)).toEqual([]);
});
test("test sound works without starting a session or asking for notifications", async ({
  page,
}) => {
  await openFocus(page);
  await page.getByRole("button", { name: "Test sound" }).click();
  expect(await events(page)).toEqual(["tone", "tone", "tone"]);
  await expect(page.getByRole("button", { name: "Start focus" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("resuming a paused session alerts at its remaining duration", async ({
  page,
}) => {
  await openFocus(page);
  await start(page);
  await page.clock.fastForward(30000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(120000);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(89000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.clock.fastForward(1000);
  await expect(page.getByRole("alert")).toContainText("Time’s up");
  expect(await events(page)).toEqual(["tone", "tone", "tone"]);
});
for (const mode of [
  "denied",
  "unsupported",
  "error",
  "blocked-audio",
] as const) {
  test(`${mode} alerts recover without blocking the timer`, async ({
    page,
  }) => {
    await openFocus(page, mode);
    if (mode !== "unsupported") {
      await page
        .getByRole("button", { name: "Enable desktop notifications" })
        .click();
    } else {
      await expect(
        page.getByRole("button", { name: "Enable desktop notifications" }),
      ).toBeDisabled();
    }
    await start(page);
    await page.clock.fastForward(120000);
    await expect(page.getByRole("alert")).toContainText("Time’s up");
    await expect(
      page.getByRole("button", { name: "Finish session" }),
    ).toBeEnabled();
    const recorded = await events(page);
    expect(recorded.filter((event) => event === "tone")).toHaveLength(
      mode === "blocked-audio" ? 0 : 3,
    );
    expect(recorded.includes("notification")).toBe(mode === "blocked-audio");
  });
}
