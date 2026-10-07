import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000701";
const other = "00000000-0000-4000-8000-000000000702";
beforeAll(async () => {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated;
    grant usage on schema public,auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${owner}'),('${other}');`);
  for (const migration of [
    "202610060001_workspace.sql",
    "202610070001_productivity.sql",
    "202610070002_focus_alerts.sql",
  ])
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    `set role authenticated; set request.jwt.claim.sub='${owner}';`,
  );
}, 30000);
afterAll(() => db.close());
it.each([2, 480])(
  "starts and finishes a %i minute session",
  async (minutes) => {
    const id = crypto.randomUUID();
    const result = await db.query<{
      target_minutes: number;
      updated_at: string;
    }>("select * from public.control_focus($1,'start',null,$2)", [id, minutes]);
    expect(result.rows[0].target_minutes).toBe(minutes);
    await db.query(
      "select * from public.control_focus($1,'finish',null,$2,$3)",
      [id, minutes, result.rows[0].updated_at],
    );
  },
);
it.each([0, 1, 481])(
  "rejects a %i minute session in the database",
  async (minutes) => {
    await expect(
      db.query("select * from public.control_focus($1,'start',null,$2)", [
        crypto.randomUUID(),
        minutes,
      ]),
    ).rejects.toThrow(/focus_sessions_target_minutes_check/);
  },
);
it("keeps two-minute sessions isolated by owner and task estimates at five minutes", async () => {
  const id = crypto.randomUUID();
  await db.query("select * from public.control_focus($1,'start',null,2)", [id]);
  await db.exec(`set request.jwt.claim.sub='${other}';`);
  expect(
    (await db.query("select id from public.focus_sessions where id=$1", [id]))
      .rows,
  ).toEqual([]);
  await expect(
    db.query("select * from public.control_focus($1,'finish')", [id]),
  ).rejects.toThrow("Session unavailable");
  await db.exec(`set request.jwt.claim.sub='${owner}';`);
  await expect(
    db.query("insert into public.tasks(title,minutes) values('Short task',2)"),
  ).rejects.toThrow();
});
