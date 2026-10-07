import { describe, it, expect } from "vitest";
import {
  activeRecords,
  focusSeconds,
  plannedMinutes,
  shiftDate,
  transitionFocus,
  validateCapture,
  weekDates,
  type FocusSession,
} from "../lib/organizer/features";
import {
  dailyPlan,
  demoWorkspace,
  validateTask,
  searchNotes,
} from "../lib/organizer/domain";
const stamp = Date.parse("2026-10-07T10:00:00Z");
const session: FocusSession = {
  id: "timer",
  task_id: null,
  target_minutes: 25,
  elapsed_seconds: 10,
  running_since: new Date(stamp).toISOString(),
  completed_at: null,
  created_at: new Date(stamp).toISOString(),
  updated_at: new Date(stamp).toISOString(),
};
describe("quick capture and recoverable records", () => {
  it.each(["", "  ", "x".repeat(2001)])("rejects invalid capture %j", (text) =>
    expect(validateCapture(text)).toBeTruthy(),
  );
  it.each(["one thought", "x".repeat(2000)])(
    "accepts valid capture %j",
    (text) => expect(validateCapture(text)).toBeNull(),
  );
  it("excludes trash without mutating stored records", () => {
    const records = [
      { id: 1 },
      { id: 2, deleted_at: "2026-10-07" },
      { id: 3, deleted_at: null },
    ];
    expect(activeRecords(records).map((item) => item.id)).toEqual([1, 3]);
    expect(records).toHaveLength(3);
  });
  it("keeps trashed notes out of memory search", () =>
    expect(
      searchNotes([{ ...demoWorkspace().notes[0], deleted_at: "now" }], ""),
    ).toEqual([]));
});
describe("weekly planning", () => {
  it.each(["2026-10-05", "2026-10-07", "2026-10-11"])(
    "uses Monday through Sunday for %s",
    (date) => {
      expect(weekDates(date)).toEqual([
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ]);
    },
  );
  it("crosses months, years, leap days, and daylight-saving dates by calendar day", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });
  it("totals only unfinished live tasks for the selected day", () => {
    const task = { ...demoWorkspace().tasks[0], scheduled_date: "2026-10-07" };
    expect(
      plannedMinutes(
        [
          task,
          { ...task, completed: true },
          { ...task, deleted_at: "now" },
          { ...task, scheduled_date: "2026-10-08" },
        ],
        "2026-10-07",
      ),
    ).toBe(task.minutes);
  });
  it("planned days affect the daily plan without changing deadlines", () => {
    const task = {
      ...demoWorkspace().tasks[0],
      due_date: "2026-10-20",
      scheduled_date: "2026-10-07",
    };
    expect(dailyPlan([task], 120, "2026-10-07")).toEqual([task]);
    expect(
      dailyPlan(
        [
          { ...task, scheduled_date: "2026-10-08" },
          { ...task, deleted_at: "now" },
        ],
        120,
        "2026-10-07",
      ),
    ).toEqual([]);
    expect(task.due_date).toBe("2026-10-20");
  });
  it("rejects impossible planned days", () =>
    expect(
      validateTask({
        ...demoWorkspace().tasks[0],
        scheduled_date: "2026-02-30",
      }),
    ).toBeTruthy());
});
describe("focus timer", () => {
  it("calculates elapsed time after refresh or a sleeping tab", () =>
    expect(focusSeconds(session, stamp + 65000)).toBe(75));
  it("does not count paused or completed time", () => {
    expect(
      focusSeconds({ ...session, running_since: null }, stamp + 65000),
    ).toBe(10);
    expect(
      focusSeconds({ ...session, completed_at: "done" }, stamp + 65000),
    ).toBe(10);
  });
  it("handles a clock moving backwards and caps sessions at 24 hours", () => {
    expect(focusSeconds(session, stamp - 1000)).toBe(10);
    expect(focusSeconds(session, stamp + 100000000)).toBe(86400);
  });
  it("pause/resume/finish preserve actual time and the task link", () => {
    const paused = transitionFocus(session, "pause", stamp + 20000);
    expect(paused.elapsed_seconds).toBe(30);
    expect(paused.running_since).toBeNull();
    const resumed = transitionFocus(paused, "resume", stamp + 50000);
    const finished = transitionFocus(resumed, "finish", stamp + 60000);
    expect(finished.elapsed_seconds).toBe(40);
    expect(finished.running_since).toBeNull();
    expect(finished.completed_at).toBe(new Date(stamp + 60000).toISOString());
    expect(session.elapsed_seconds).toBe(10);
  });
  it("finishes a paused session without adding paused time", () =>
    expect(
      transitionFocus(
        { ...session, running_since: null },
        "finish",
        stamp + 60000,
      ).elapsed_seconds,
    ).toBe(10));
  it("rejects invalid state transitions", () => {
    expect(() => transitionFocus(session, "resume", stamp)).toThrow(
      "already running",
    );
    expect(() =>
      transitionFocus({ ...session, running_since: null }, "pause", stamp),
    ).toThrow("already paused");
    expect(() =>
      transitionFocus({ ...session, completed_at: "done" }, "finish", stamp),
    ).toThrow("already finished");
  });
});
