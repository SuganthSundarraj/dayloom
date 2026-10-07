import type { Task, Note } from "@/lib/organizer/domain";
export type View =
  "today" | "inbox" | "week" | "tasks" | "notes" | "memory" | "focus" | "trash";
export type Editor =
  | { kind: "task"; value: Task; captureId?: string }
  | { kind: "note"; value: Note }
  | { kind: "account" }
  | { kind: "settings" }
  | {
      kind: "delete";
      table: import("@/lib/organizer/features").RecordTable;
      id: string;
      permanent?: boolean;
    };
