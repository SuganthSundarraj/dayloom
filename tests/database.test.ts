import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000101",
  other = "00000000-0000-4000-8000-000000000102",
  note = "00000000-0000-4000-8000-000000000103";
beforeAll(async () => {
  await db.exec(
    `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;grant usage on schema public,auth to authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${owner}'),('${other}');`,
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
    `set role authenticated;set request.jwt.claim.sub='${owner}';insert into public.notes(id,title,body) values ('${note}','Private note','Keep this private');insert into public.tasks(title,note_id) values ('Linked task','${note}');reset role;`,
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("only the owner can read saved notes", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  expect((await db.query("select * from public.notes")).rows).toHaveLength(0);
  await db.exec(`set request.jwt.claim.sub='${owner}';`);
  expect((await db.query("select * from public.notes")).rows).toHaveLength(1);
  await db.exec("reset role");
});
it("rejects writing another user's records", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  await expect(
    db.query(
      "insert into public.notes(user_id,title,body) values ($1,'Intrusion','No')",
      [owner],
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("cannot modify or delete another user's notes", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  expect(
    (await db.query("update public.notes set title='Intrusion' returning id"))
      .rows,
  ).toHaveLength(0);
  expect(
    (await db.query("delete from public.notes returning id")).rows,
  ).toHaveLength(0);
  await db.exec("reset role");
});
it("cannot link tasks to another user's notes", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  await expect(
    db.query(
      "insert into public.tasks(title,note_id) values ('Intrusion',$1)",
      [note],
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("enforces task duration constraints", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  await expect(
    db.query("insert into public.tasks(title,minutes) values ('Bad',0)"),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("preserves linked tasks when their note is deleted", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  await db.query("delete from public.notes where id=$1", [note]);
  const result = await db.query<{ note_id: string | null; user_id: string }>(
    "select note_id,user_id from public.tasks",
  );
  expect(result.rows).toEqual([{ note_id: null, user_id: owner }]);
  await db.exec("reset role");
});
it("denies anonymous access", async () => {
  await db.exec("set role anon");
  await expect(db.query("select * from public.tasks")).rejects.toThrow();
  await db.exec("reset role");
});
