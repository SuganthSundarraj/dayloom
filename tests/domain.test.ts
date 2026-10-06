import { describe, it, expect } from "vitest";
import {
  dailyPlan,
  demoWorkspace,
  extractTasks,
  localDate,
  searchNotes,
  validateNote,
  validateTask,
  type Task,
} from "../lib/organizer/domain";
const base: Task = {
  id: "a",
  title: "Plan",
  project: "Work",
  priority: "medium",
  due_date: "2026-10-06",
  minutes: 30,
  completed: false,
  note_id: null,
  created_at: "2026-10-06T00:00:00Z",
};
describe("task validation", () => {
  it("accepts a task without a deadline", () =>
    expect(validateTask({ ...base, due_date: null })).toBeNull());
  it.each(["", " ", "a".repeat(201)])(
    "rejects empty or excessive titles",
    (title) => expect(validateTask({ ...base, title })).toBeTruthy(),
  );
  it.each([0, 4, 481, 5.5, NaN])("rejects invalid duration %s", (minutes) =>
    expect(validateTask({ ...base, minutes })).toBeTruthy(),
  );
  it.each(["2026-02-30", "yesterday", "2026-13-01"])(
    "rejects invalid date %s",
    (due_date) => expect(validateTask({ ...base, due_date })).toBeTruthy(),
  );
  it("accepts a leap day", () =>
    expect(validateTask({ ...base, due_date: "2028-02-29" })).toBeNull());
  it("rejects unknown priority", () =>
    expect(
      validateTask({ ...base, priority: "urgent" as Task["priority"] }),
    ).toBeTruthy());
});
describe("notes and memory", () => {
  it("validates note boundaries", () => {
    expect(validateNote({ title: "Hello", body: "Saved thought" })).toBeNull();
    for (const note of [
      { title: "", body: "x" },
      { title: "a".repeat(201), body: "x" },
      { title: "x", body: " " },
      { title: "x", body: "x".repeat(20001) },
    ])
      expect(validateNote(note)).toBeTruthy();
  });
  it("matches titles, text and tags without inventing answers", () => {
    const notes = demoWorkspace().notes;
    expect(searchNotes(notes, "PRIYA")[0].body).toContain("Ask Priya");
    expect(searchNotes(notes, "personal")[0].tags).toContain("personal");
    expect(searchNotes(notes, "direction")[0].title).toContain("direction");
    expect(searchNotes(notes, "unfindable")).toEqual([]);
  });
  it("returns pinned notes first without mutating input", () => {
    const notes = demoWorkspace().notes.reverse();
    const copy = structuredClone(notes);
    expect(searchNotes(notes, " ")[0].pinned).toBe(true);
    expect(notes).toEqual(copy);
  });
  it("breaks equal-score ties deterministically", () => {
    const notes = demoWorkspace().notes.map((n) => ({
      ...n,
      title: "same",
      body: "same",
      tags: [],
    }));
    expect(searchNotes(notes.reverse(), "same")[0].id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });
});
describe("daily planning", () => {
  it("excludes completed and future work and respects the budget", () => {
    const tasks = [
      base,
      { ...base, id: "done", completed: true },
      { ...base, id: "future", due_date: "2026-10-07" },
      { ...base, id: "small", minutes: 15, due_date: null },
    ];
    expect(dailyPlan(tasks, 45, "2026-10-06").map((t) => t.id)).toEqual([
      "a",
      "small",
    ]);
    expect(tasks[0]).toEqual(base);
  });
  it("prioritizes older deadlines then priority", () => {
    const tasks = [
      { ...base, id: "low", priority: "low" as const },
      { ...base, id: "high", priority: "high" as const },
      { ...base, id: "overdue", due_date: "2026-10-01" },
    ];
    expect(dailyPlan(tasks, 90, "2026-10-06").map((t) => t.id)).toEqual([
      "overdue",
      "high",
      "low",
    ]);
  });
  it("skips an oversized task and uses stable tie ordering", () =>
    expect(
      dailyPlan(
        [
          { ...base, id: "z" },
          { ...base, id: "b", minutes: 10 },
          { ...base, id: "a", minutes: 10 },
        ],
        20,
        "2026-10-06",
      ).map((t) => t.id),
    ).toEqual(["a", "b"]));
  it.each([-1, NaN, 1.5, 0])("handles unavailable time %s", (budget) =>
    expect(dailyPlan([base], budget, "2026-10-06")).toEqual([]),
  );
  it("uses local calendar date rather than UTC truncation", () =>
    expect(localDate(new Date(2026, 9, 6, 0, 10))).toBe("2026-10-06"));
});
it("AI being disabled never blocks a manual workflow", async () => {
  const workspace = demoWorkspace();
  const result = await extractTasks();
  expect(result.status).toBe("disabled");
  expect(result.suggestions).toEqual([]);
  expect(validateTask(base)).toBeNull();
  expect(workspace.notes).toHaveLength(2);
});
