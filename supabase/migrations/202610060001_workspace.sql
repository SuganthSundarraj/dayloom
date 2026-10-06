begin;
create table public.notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 1 and 200),
 body text not null check (char_length(trim(body)) between 1 and 20000),
 tags text[] not null default '{}' check (cardinality(tags) <= 10),
 pinned boolean not null default false,
 created_at timestamptz not null default now(),
 unique (id,user_id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 1 and 200),
 project text not null default 'Personal' check (char_length(trim(project)) between 1 and 80),
 priority text not null default 'medium' check (priority in ('low','medium','high')),
 due_date date,
 minutes integer not null default 30 check (minutes between 5 and 480),
 completed boolean not null default false,
 note_id uuid,
 created_at timestamptz not null default now(),
 foreign key (note_id,user_id) references public.notes(id,user_id) on delete set null (note_id)
);
create index notes_owner_created on public.notes(user_id,created_at desc);
create index tasks_owner_due on public.tasks(user_id,completed,due_date);
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
create policy own_notes on public.notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_tasks on public.tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.notes, public.tasks from anon;
grant select, insert, update, delete on public.notes, public.tasks to authenticated;
commit;
