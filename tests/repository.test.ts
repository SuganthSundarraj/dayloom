import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connect,
  deleteRecord,
  loadWorkspace,
  saveRecord,
  parseConfig,
} from "../lib/organizer/repository";
import { demoWorkspace } from "../lib/organizer/domain";
function mock(result: unknown) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockResolvedValue(result);
  const upsert = vi.fn().mockResolvedValue(result);
  const db = {
    from: vi.fn(() => ({
      select: () => ({ order }),
      upsert,
      delete: () => ({ eq }),
    })),
  };
  return { db: db as unknown as SupabaseClient, upsert, eq };
}
it("creates a public-key client", () => {
  const client = connect({
    url: "https://example.supabase.co",
    key: "sb_publishable_example",
    configured: true,
  });
  expect(client.auth).toBeDefined();
});
it("validates configuration and rejects privileged or malformed keys", () => {
  expect(parseConfig({ configured: false, url: "", key: "" })).toEqual({
    configured: false,
    url: "",
    key: "",
  });
  expect(
    parseConfig({
      configured: true,
      url: "https://example.supabase.co",
      key: "sb_publishable_example",
    }).configured,
  ).toBe(true);
  for (const value of [
    null,
    "bad",
    {},
    { configured: true, url: "http://unsafe", key: "sb_publishable_example" },
    {
      configured: true,
      url: "https://example.supabase.co",
      key: "sb_secret_example",
    },
  ])
    expect(() => parseConfig(value)).toThrow("invalid");
});
it("loads successful results", async () => {
  const { db } = mock({ data: [], error: null });
  expect(await loadWorkspace(db)).toEqual({ tasks: [], notes: [] });
});
it("surfaces read failures instead of a falsely empty workspace", async () => {
  const { db } = mock({ data: null, error: { message: "private details" } });
  await expect(loadWorkspace(db)).rejects.toThrow("could not be loaded");
});
it("attributes saved data to the signed in user", async () => {
  const { db, upsert } = mock({ error: null });
  const note = demoWorkspace().notes[0];
  await saveRecord(db, "notes", note, "owner");
  expect(upsert).toHaveBeenCalledWith({ ...note, user_id: "owner" });
});
it("preserves the failure signal on saving", async () => {
  const { db } = mock({ error: { message: "failure" } });
  await expect(
    saveRecord(db, "tasks", demoWorkspace().tasks[0], "owner"),
  ).rejects.toThrow("input is still here");
});
it("deletes only the selected id", async () => {
  const { db, eq } = mock({ error: null });
  await deleteRecord(db, "notes", "chosen");
  expect(eq).toHaveBeenCalledWith("id", "chosen");
});
it("surfaces deletion failure", async () => {
  const { db } = mock({ error: { message: "failure" } });
  await expect(deleteRecord(db, "tasks", "chosen")).rejects.toThrow(
    "could not be deleted",
  );
});
