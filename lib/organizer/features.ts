import { localDate, type Task } from "./domain";

export type Capture = {
  id: string;
  text: string;
  created_at: string;
  deleted_at: string | null;
  converted_at: string | null;
  converted_task_id: string | null;
};
export type FocusSession = {
  id: string;
  task_id: string | null;
  target_minutes: number;
  elapsed_seconds: number;
  running_since: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type RecordTable = "tasks" | "notes" | "captures";
export type FocusAction = "start" | "pause" | "resume" | "finish";

export function validateCapture(text: string): string | null {
  return text.trim().length < 1 || text.trim().length > 2000
    ? "Write a thought between 1 and 2,000 characters."
    : null;
}
export function activeRecords<T extends { deleted_at?: string | null }>(
  records: T[],
): T[] {
  return records.filter((record) => !record.deleted_at);
}
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return localDate(new Date(year, month - 1, day + days, 12));
}
export function weekDates(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  const monday = shiftDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
export function plannedMinutes(tasks: Task[], date: string): number {
  return activeRecords(tasks)
    .filter((task) => !task.completed && task.scheduled_date === date)
    .reduce((sum, task) => sum + task.minutes, 0);
}
export function focusSeconds(session: FocusSession, now: number): number {
  const running =
    session.running_since && !session.completed_at
      ? Math.max(
          0,
          Math.floor((now - Date.parse(session.running_since)) / 1000),
        )
      : 0;
  return Math.min(86400, session.elapsed_seconds + running);
}
export function transitionFocus(
  session: FocusSession,
  action: Exclude<FocusAction, "start">,
  now: number,
): FocusSession {
  if (session.completed_at)
    throw new Error("This focus session has already finished.");
  if (action === "pause" && !session.running_since)
    throw new Error("The timer is already paused.");
  if (action === "resume" && session.running_since)
    throw new Error("The timer is already running.");
  const timestamp = new Date(now).toISOString();
  return {
    ...session,
    elapsed_seconds: focusSeconds(session, now),
    running_since: action === "resume" ? timestamp : null,
    completed_at: action === "finish" ? timestamp : null,
    updated_at: timestamp,
  };
}
