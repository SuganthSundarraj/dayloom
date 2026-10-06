import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Note, Task, Workspace } from "./domain";
export type PublicConfig = { url: string; key: string; configured: boolean };
export function parseConfig(value: unknown): PublicConfig {
  if (!value || typeof value !== "object")
    throw new Error("Connection settings are invalid. Please retry.");
  const data = value as Record<string, unknown>;
  if (
    typeof data.configured !== "boolean" ||
    typeof data.url !== "string" ||
    typeof data.key !== "string"
  )
    throw new Error("Connection settings are invalid. Please retry.");
  if (
    data.configured &&
    (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(data.url) ||
      !data.key.startsWith("sb_publishable_"))
  )
    throw new Error("Connection settings are invalid. Please retry.");
  return { configured: data.configured, url: data.url, key: data.key };
}
export function connect(config: PublicConfig): SupabaseClient {
  return createClient(config.url, config.key);
}
export async function loadWorkspace(
  client: SupabaseClient,
): Promise<Workspace> {
  const [tasks, notes] = await Promise.all([
    client
      .from("tasks")
      .select(
        "id,title,project,priority,due_date,minutes,completed,note_id,created_at",
      )
      .order("created_at", { ascending: false }),
    client
      .from("notes")
      .select("id,title,body,tags,pinned,created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (tasks.error || notes.error)
    throw new Error("Your workspace could not be loaded. Please try again.");
  return { tasks: tasks.data as Task[], notes: notes.data as Note[] };
}
export async function saveRecord(
  client: SupabaseClient,
  table: "tasks" | "notes",
  record: Task | Note,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from(table)
    .upsert({ ...record, user_id: userId });
  if (error)
    throw new Error(
      "Your changes could not be saved. Your input is still here; please try again.",
    );
}
export async function deleteRecord(
  client: SupabaseClient,
  table: "tasks" | "notes",
  id: string,
): Promise<void> {
  const { error } = await client.from(table).delete().eq("id", id);
  if (error)
    throw new Error("This item could not be deleted. Please try again.");
}
