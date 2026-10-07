import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Note, Task, Workspace } from "./domain";
import type {
  Capture,
  FocusSession,
  FocusAction,
  RecordTable,
} from "./features";
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
  const [tasks, notes, captures, sessions] = await Promise.all([
    client
      .from("tasks")
      .select(
        "id,title,project,priority,due_date,minutes,completed,note_id,created_at,scheduled_date,deleted_at",
      )
      .order("created_at", { ascending: false }),
    client
      .from("notes")
      .select("id,title,body,tags,pinned,created_at,deleted_at")
      .order("created_at", { ascending: false }),
    client
      .from("captures")
      .select("id,text,created_at,deleted_at,converted_at,converted_task_id")
      .order("created_at", { ascending: false }),
    client
      .from("focus_sessions")
      .select(
        "id,task_id,target_minutes,elapsed_seconds,running_since,completed_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
  ]);
  if (tasks.error || notes.error || captures.error || sessions.error)
    throw new Error("Your workspace could not be loaded. Please try again.");
  return {
    tasks: tasks.data as Task[],
    notes: notes.data as Note[],
    captures: captures.data as Capture[],
    sessions: sessions.data as FocusSession[],
  };
}
export async function saveRecord(
  client: SupabaseClient,
  table: RecordTable,
  record: Task | Note | Capture,
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
  table: RecordTable,
  id: string,
): Promise<void> {
  const { error } = await client
    .from(table)
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .single();
  if (error)
    throw new Error("This item could not be deleted. Please try again.");
}
export async function setDeletedAt(
  client: SupabaseClient,
  table: RecordTable,
  id: string,
  deletedAt: string | null,
): Promise<void> {
  const { error } = await client
    .from(table)
    .update({ deleted_at: deletedAt })
    .eq("id", id)
    .select("id")
    .single();
  if (error)
    throw new Error("The item could not be moved or restored. Please retry.");
}
export async function convertCapture(
  client: SupabaseClient,
  id: string,
  task: Task,
): Promise<{ task: Task; capture: Capture }> {
  const { data, error } = await client.rpc("convert_capture", {
    p_capture_id: id,
    p_task: task,
  });
  if (error)
    throw new Error(
      "The thought could not become a task. Your inbox item is still here; please retry.",
    );
  return data as { task: Task; capture: Capture };
}
export async function controlFocus(
  client: SupabaseClient,
  session: FocusSession,
  action: FocusAction,
): Promise<FocusSession> {
  const { data, error } = await client
    .rpc("control_focus", {
      p_id: session.id,
      p_action: action,
      p_task_id: session.task_id,
      p_target_minutes: session.target_minutes,
      p_expected_updated_at: action === "start" ? null : session.updated_at,
    })
    .single();
  if (error)
    throw new Error(
      "The timer could not be saved. Retry, or reload your workspace if it changed on another device.",
    );
  return data as FocusSession;
}
