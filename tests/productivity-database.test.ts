import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000201";
const other = "00000000-0000-4000-8000-000000000202";
const existing = "00000000-0000-4000-8000-000000000203";
beforeAll(async () => {
  await db.exec(
    `create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; grant usage on schema public,auth to authenticated; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${owner}'),('${other}');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610060001_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `insert into public.tasks(id,user_id,title,due_date) values('${existing}','${owner}','Existing task','2026-10-20');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610070001_productivity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${owner}';`,
  );
});
afterAll(async () => {
  await db.close();
});
async function thought(text = "Prepare the outline") {
  const id = crypto.randomUUID();
  await db.query("insert into public.captures(id,text) values($1,$2)", [
    id,
    text,
  ]);
  return id;
}
const taskValue = (minutes = 30) => ({
  id: crypto.randomUUID(),
  title: "Outline",
  project: "Work",
  priority: "high",
  minutes,
  due_date: "2026-10-20",
});
async function start(
  id = crypto.randomUUID(),
  taskId: string | null = null,
  minutes = 25,
) {
  const result = await db.query<{
    id: string;
    updated_at: string;
    elapsed_seconds: number;
    running_since: string | null;
    completed_at: string | null;
  }>("select * from public.control_focus($1,'start',$2,$3)", [
    id,
    taskId,
    minutes,
  ]);
  return result.rows[0];
}
it("adds features without changing existing tasks or deadlines", async () => {
  const result = await db.query(
    "select title,due_date::text,scheduled_date,deleted_at from public.tasks where id=$1",
    [existing],
  );
  expect(result.rows).toEqual([
    {
      title: "Existing task",
      due_date: "2026-10-20",
      scheduled_date: null,
      deleted_at: null,
    },
  ]);
  await db.query(
    "update public.tasks set scheduled_date='2026-10-07' where id=$1",
    [existing],
  );
  expect(
    (
      await db.query<{ due_date: string }>(
        "select due_date::text from public.tasks where id=$1",
        [existing],
      )
    ).rows[0].due_date,
  ).toBe("2026-10-20");
});
it("capture conversion is atomic and retry-safe", async () => {
  const id = await thought();
  const value = taskValue();
  const first = await db.query<{
    result: { task: { id: string }; capture: { converted_at: string } };
  }>("select public.convert_capture($1,$2) as result", [
    id,
    JSON.stringify(value),
  ]);
  const second = await db.query<{ result: { task: { id: string } } }>(
    "select public.convert_capture($1,$2) as result",
    [id, JSON.stringify(taskValue())],
  );
  expect(first.rows[0].result.task.id).toBe(value.id);
  expect(first.rows[0].result.capture.converted_at).toBeTruthy();
  expect(second.rows[0].result.task.id).toBe(value.id);
  expect(
    (await db.query("select id from public.tasks where id=$1", [value.id]))
      .rows,
  ).toHaveLength(1);
});
it("a rejected conversion leaves its capture and task table unchanged", async () => {
  const id = await thought();
  const value = taskValue(0);
  await expect(
    db.query("select public.convert_capture($1,$2)", [
      id,
      JSON.stringify(value),
    ]),
  ).rejects.toThrow();
  expect(
    (
      await db.query("select converted_at from public.captures where id=$1", [
        id,
      ])
    ).rows,
  ).toEqual([{ converted_at: null }]);
  expect(
    (await db.query("select id from public.tasks where id=$1", [value.id]))
      .rows,
  ).toEqual([]);
});
it("cross-account capture reads, writes, conversion, and deletion are denied", async () => {
  const id = await thought();
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  expect(
    (await db.query("select id from public.captures where id=$1", [id])).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "update public.captures set deleted_at=now() where id=$1 returning id",
        [id],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query("delete from public.captures where id=$1 returning id", [
        id,
      ])
    ).rows,
  ).toEqual([]);
  await expect(
    db.query("select public.convert_capture($1,$2)", [
      id,
      JSON.stringify(taskValue()),
    ]),
  ).rejects.toThrow("Capture unavailable");
  await expect(
    db.query("insert into public.captures(user_id,text) values($1,'Spoof')", [
      owner,
    ]),
  ).rejects.toThrow();
});
it("trash and restoration preserve linked notes and task data", async () => {
  const id = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  await db.query(
    "insert into public.notes(id,title,body) values($1,'Source','Keep this context')",
    [id],
  );
  await db.query(
    "insert into public.tasks(id,title,note_id) values($1,'Linked',$2)",
    [taskId, id],
  );
  await db.query("update public.notes set deleted_at=now() where id=$1", [id]);
  expect(
    (await db.query("select note_id from public.tasks where id=$1", [taskId]))
      .rows,
  ).toEqual([{ note_id: id }]);
  await db.query("update public.notes set deleted_at=null where id=$1", [id]);
  expect(
    (
      await db.query("select body,deleted_at from public.notes where id=$1", [
        id,
      ])
    ).rows,
  ).toEqual([{ body: "Keep this context", deleted_at: null }]);
  await db.query("delete from public.notes where id=$1", [id]);
  expect(
    (await db.query("select note_id from public.tasks where id=$1", [taskId]))
      .rows,
  ).toEqual([{ note_id: null }]);
});
it("invalid and trashed captures cannot be converted", async () => {
  await expect(thought(" ")).rejects.toThrow();
  await expect(thought("x".repeat(2001))).rejects.toThrow();
  const id = await thought();
  await db.query("update public.captures set deleted_at=now() where id=$1", [
    id,
  ]);
  await expect(
    db.query("select public.convert_capture($1,$2)", [
      id,
      JSON.stringify(taskValue()),
    ]),
  ).rejects.toThrow("Capture unavailable");
});
it("timer start is retry-safe and only one active session is allowed", async () => {
  const session = await start();
  expect((await start(session.id)).id).toBe(session.id);
  await expect(start()).rejects.toThrow();
  await db.query("select * from public.control_focus($1,'finish',null,25,$2)", [
    session.id,
    session.updated_at,
  ]);
});
it("pause, resume, finish use database time and reject stale writes", async () => {
  const session = await start();
  await db.query(
    "update public.focus_sessions set running_since=clock_timestamp()-interval '10 seconds' where id=$1",
    [session.id],
  );
  const paused = (
    await db.query<{
      updated_at: string;
      elapsed_seconds: number;
      running_since: null;
    }>("select * from public.control_focus($1,'pause',null,25,$2)", [
      session.id,
      session.updated_at,
    ])
  ).rows[0];
  expect(paused.elapsed_seconds).toBeGreaterThanOrEqual(10);
  expect(paused.running_since).toBeNull();
  await expect(
    db.query("select * from public.control_focus($1,'resume',null,25,$2)", [
      session.id,
      session.updated_at,
    ]),
  ).rejects.toThrow("Session changed");
  const resumed = (
    await db.query<{ updated_at: string; running_since: string }>(
      "select * from public.control_focus($1,'resume',null,25,$2)",
      [session.id, paused.updated_at],
    )
  ).rows[0];
  expect(resumed.running_since).toBeTruthy();
  await expect(
    db.query("select * from public.control_focus($1,'resume',null,25,$2)", [
      session.id,
      resumed.updated_at,
    ]),
  ).rejects.toThrow("Invalid timer action");
  const finished = (
    await db.query<{ completed_at: string; running_since: null }>(
      "select * from public.control_focus($1,'finish',null,25,$2)",
      [session.id, resumed.updated_at],
    )
  ).rows[0];
  expect(finished.completed_at).toBeTruthy();
  expect(finished.running_since).toBeNull();
  await expect(
    db.query("select * from public.control_focus($1,'pause',null,25,$2)", [
      session.id,
      resumed.updated_at,
    ]),
  ).rejects.toThrow("Session unavailable");
});
it("timer ownership, task ownership, duration, and anonymous permissions are enforced", async () => {
  const session = await start();
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  expect(
    (
      await db.query("select id from public.focus_sessions where id=$1", [
        session.id,
      ])
    ).rows,
  ).toEqual([]);
  await expect(
    db.query("select * from public.control_focus($1,'pause',null,25,$2)", [
      session.id,
      session.updated_at,
    ]),
  ).rejects.toThrow("Session unavailable");
  await expect(start(crypto.randomUUID(), existing)).rejects.toThrow(
    "Task unavailable",
  );
  await expect(start(crypto.randomUUID(), null, 0)).rejects.toThrow();
  await db.exec("reset role; set role anon;");
  await expect(db.query("select * from public.captures")).rejects.toThrow();
  await expect(
    db.query("select * from public.focus_sessions"),
  ).rejects.toThrow();
  await expect(start()).rejects.toThrow();
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${owner}';`,
  );
  await db.query("select * from public.control_focus($1,'finish',null,25,$2)", [
    session.id,
    session.updated_at,
  ]);
});
it("permanent task deletion preserves focus history and converted capture text", async () => {
  const id = await thought();
  const value = taskValue();
  await db.query("select public.convert_capture($1,$2)", [
    id,
    JSON.stringify(value),
  ]);
  const session = await start(crypto.randomUUID(), value.id);
  await db.query("select * from public.control_focus($1,'finish',null,25,$2)", [
    session.id,
    session.updated_at,
  ]);
  await db.query("delete from public.tasks where id=$1", [value.id]);
  expect(
    (
      await db.query("select task_id from public.focus_sessions where id=$1", [
        session.id,
      ])
    ).rows,
  ).toEqual([{ task_id: null }]);
  const capture = (
    await db.query<{
      text: string;
      converted_at: string;
      converted_task_id: null;
    }>(
      "select text,converted_at,converted_task_id from public.captures where id=$1",
      [id],
    )
  ).rows[0];
  expect(capture.text).toBe("Prepare the outline");
  expect(capture.converted_at).toBeTruthy();
  expect(capture.converted_task_id).toBeNull();
});
