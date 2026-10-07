import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  setDeletedAt,
  convertCapture,
  controlFocus,
  loadWorkspace,
} from "../lib/organizer/repository";
import { demoWorkspace } from "../lib/organizer/domain";
import type { FocusSession } from "../lib/organizer/features";
function mock(error: object | null = null) {
  const result = { data: { id: "chosen" }, error };
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const update = vi.fn(() => query);
  const db = { from: vi.fn(() => ({ update })) };
  return { db: db as unknown as SupabaseClient, update, query };
}
it.each(["2026-10-07T10:00:00Z", null])(
  "moves/restores only the requested record (%s)",
  async (stamp) => {
    const { db, update, query } = mock();
    await setDeletedAt(db, "captures", "chosen", stamp);
    expect(update).toHaveBeenCalledWith({ deleted_at: stamp });
    expect(query.eq).toHaveBeenCalledWith("id", "chosen");
  },
);
it("does not claim a failed trash/restore succeeded", async () =>
  await expect(
    setDeletedAt(mock({}).db, "tasks", "chosen", null),
  ).rejects.toThrow("could not be moved"));
it("converts captures through one atomic operation", async () => {
  const data = { task: demoWorkspace().tasks[0], capture: { id: "capture" } };
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  expect(
    await convertCapture(
      { rpc } as unknown as SupabaseClient,
      "capture",
      data.task,
    ),
  ).toEqual(data);
  expect(rpc).toHaveBeenCalledWith("convert_capture", {
    p_capture_id: "capture",
    p_task: data.task,
  });
});
it("preserves the conversion failure signal", async () =>
  await expect(
    convertCapture(
      { rpc: async () => ({ error: {} }) } as unknown as SupabaseClient,
      "capture",
      demoWorkspace().tasks[0],
    ),
  ).rejects.toThrow("inbox item is still here"));
const timer = {
  id: "timer",
  task_id: null,
  target_minutes: 25,
  updated_at: "version",
} as FocusSession;
it.each(["start", "pause", "resume", "finish"] as const)(
  "saves timer %s using the expected version",
  async (action) => {
    const rpc = vi.fn(() => ({
      single: async () => ({ data: timer, error: null }),
    }));
    expect(
      await controlFocus({ rpc } as unknown as SupabaseClient, timer, action),
    ).toEqual(timer);
    expect(rpc).toHaveBeenCalledWith("control_focus", {
      p_id: "timer",
      p_action: action,
      p_task_id: null,
      p_target_minutes: 25,
      p_expected_updated_at: action === "start" ? null : "version",
    });
  },
);
it("surfaces timer persistence and conflict failures", async () =>
  await expect(
    controlFocus(
      {
        rpc: () => ({ single: async () => ({ error: {} }) }),
      } as unknown as SupabaseClient,
      timer,
      "pause",
    ),
  ).rejects.toThrow("reload your workspace"));
it.each(["captures", "focus_sessions"])(
  "does not hide a partial workspace failure in %s",
  async (table) => {
    const db = {
      from: (name: string) => ({
        select: () => ({
          order: async () => ({ data: [], error: name === table ? {} : null }),
        }),
      }),
    };
    await expect(
      loadWorkspace(db as unknown as SupabaseClient),
    ).rejects.toThrow("could not be loaded");
  },
);
