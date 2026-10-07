export type Priority = "high" | "medium" | "low";
export type Task = {
  id: string;
  title: string;
  project: string;
  priority: Priority;
  due_date: string | null;
  minutes: number;
  completed: boolean;
  note_id: string | null;
  created_at: string;
  scheduled_date?: string | null;
  deleted_at?: string | null;
};
export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  deleted_at?: string | null;
};
export type Workspace = {
  tasks: Task[];
  notes: Note[];
  captures?: import("./features").Capture[];
  sessions?: import("./features").FocusSession[];
};
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validateTask(
  task: Pick<
    Task,
    "title" | "minutes" | "due_date" | "priority" | "scheduled_date"
  >,
): string | null {
  if (!task.title.trim() || task.title.trim().length > 200)
    return "Use a task title between 1 and 200 characters.";
  if (!Number.isInteger(task.minutes) || task.minutes < 5 || task.minutes > 480)
    return "Choose a duration between 5 and 480 minutes.";
  if (!["high", "medium", "low"].includes(task.priority))
    return "Choose a valid priority.";
  for (const date of [task.due_date, task.scheduled_date])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date + "T00:00:00Z")) ||
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
    )
      return "Choose a valid due or planned date.";
  return null;
}
export function validateNote(
  note: Pick<Note, "title" | "body">,
): string | null {
  if (!note.title.trim() || note.title.trim().length > 200)
    return "Use a note title between 1 and 200 characters.";
  if (!note.body.trim() || note.body.length > 20000)
    return "Write a note between 1 and 20,000 characters.";
  return null;
}
export function dailyPlan(
  tasks: Task[],
  budget: number,
  today: string,
): Task[] {
  if (!Number.isInteger(budget) || budget < 0) return [];
  const rank = { high: 0, medium: 1, low: 2 };
  const candidates = tasks.filter(
    (t) =>
      !t.deleted_at &&
      !t.completed &&
      (t.scheduled_date
        ? t.scheduled_date <= today
        : !t.due_date || t.due_date <= today),
  );
  candidates.sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      rank[a.priority] - rank[b.priority] ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
  const plan: Task[] = [];
  let remaining = budget;
  for (const task of candidates)
    if (task.minutes <= remaining) {
      plan.push(task);
      remaining -= task.minutes;
    }
  return plan;
}
export function searchNotes(notes: Note[], query: string): Note[] {
  notes = notes.filter((note) => !note.deleted_at);
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length)
    return [...notes].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.created_at.localeCompare(a.created_at),
    );
  return notes
    .map((note) => ({
      note,
      score: terms.reduce(
        (score, term) =>
          score +
          (note.title.toLocaleLowerCase().includes(term) ? 3 : 0) +
          (note.body.toLocaleLowerCase().includes(term) ? 1 : 0) +
          (note.tags.some((tag) => tag.toLocaleLowerCase().includes(term))
            ? 2
            : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.note.id.localeCompare(b.note.id))
    .map((item) => item.note);
}
export async function extractTasks(): Promise<{
  status: "disabled";
  suggestions: Task[];
  message: string;
}> {
  return {
    status: "disabled",
    suggestions: [],
    message:
      "AI extraction is not enabled. Your note is safe to save, and you can create linked tasks manually.",
  };
}
export function demoWorkspace(): Workspace {
  const today = localDate(),
    created_at = new Date().toISOString();
  const noteId = "00000000-0000-4000-8000-000000000001";
  return {
    notes: [
      {
        id: noteId,
        title: "A little direction for this week",
        body: "Keep the presentation simple: three customer stories, the key findings, and a clear next step. Ask Priya for the latest figures before putting the slides together.\n\nLeave Friday afternoon free to review everything.",
        tags: ["work", "presentation"],
        pinned: true,
        created_at,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "Ideas worth coming back to",
        body: "Make more space for focused work. Try a quiet morning without notifications and keep a short reading list. Start with twenty minutes, rather than a perfect routine.",
        tags: ["personal", "ideas"],
        pinned: false,
        created_at,
      },
    ],
    tasks: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        title: "Outline the presentation",
        project: "Work",
        priority: "high",
        due_date: today,
        minutes: 45,
        completed: false,
        note_id: noteId,
        created_at,
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        title: "Ask Priya for the latest figures",
        project: "Work",
        priority: "medium",
        due_date: today,
        minutes: 15,
        completed: false,
        note_id: noteId,
        created_at,
      },
      {
        id: "00000000-0000-4000-8000-000000000013",
        title: "Make time for a little reading",
        project: "Personal",
        priority: "low",
        due_date: null,
        minutes: 20,
        completed: false,
        note_id: null,
        created_at,
      },
    ],
  };
}
