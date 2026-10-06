import type { Task, Note } from "@/lib/organizer/domain";
export type View = "today" | "tasks" | "notes" | "memory";
export type Editor =
  | { kind: "task"; value: Task }
  | { kind: "note"; value: Note }
  | { kind: "account" }
  | { kind: "settings" }
  | { kind: "delete"; table: "tasks" | "notes"; id: string };
