import type { Task, Note } from "@/lib/organizer/domain";
export const blankTask = (noteId: string | null = null): Task => ({
  id: crypto.randomUUID(),
  title: "",
  project: "Personal",
  priority: "medium",
  due_date: null,
  minutes: 30,
  completed: false,
  note_id: noteId,
  created_at: new Date().toISOString(),
});
export const blankNote = (): Note => ({
  id: crypto.randomUUID(),
  title: "",
  body: "",
  tags: [],
  pinned: false,
  created_at: new Date().toISOString(),
});
