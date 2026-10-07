begin;
alter table public.tasks add column scheduled_date date, add column deleted_at timestamptz;
alter table public.notes add column deleted_at timestamptz;
alter table public.tasks add constraint tasks_owner_identity unique (id,user_id);

create table public.captures (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 text text not null check (char_length(trim(text)) between 1 and 2000),
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 converted_at timestamptz,
 converted_task_id uuid,
 foreign key (converted_task_id,user_id) references public.tasks(id,user_id) on delete set null (converted_task_id)
);
create table public.focus_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 task_id uuid,
 target_minutes integer not null check (target_minutes between 5 and 480),
 elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 86400),
 running_since timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default clock_timestamp(),
 check (completed_at is null or running_since is null),
 foreign key (task_id,user_id) references public.tasks(id,user_id) on delete set null (task_id)
);
create unique index focus_one_active_per_owner on public.focus_sessions(user_id) where completed_at is null;
create index captures_owner_created on public.captures(user_id,created_at desc);
create index tasks_owner_planned on public.tasks(user_id,scheduled_date) where deleted_at is null;
alter table public.captures enable row level security;
alter table public.focus_sessions enable row level security;
create policy own_captures on public.captures for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_focus on public.focus_sessions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.captures,public.focus_sessions from anon;
grant select,insert,update,delete on public.captures,public.focus_sessions to authenticated;

-- Invoker rights preserve RLS. The locked capture makes conversion atomic and retry-safe.
create function public.convert_capture(p_capture_id uuid,p_task jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare capture public.captures; task public.tasks;
begin
 select * into capture from public.captures where id=p_capture_id and user_id=auth.uid() for update;
 if not found or capture.deleted_at is not null then raise exception 'Capture unavailable'; end if;
 if capture.converted_at is not null then
  select * into task from public.tasks where id=capture.converted_task_id;
  if not found then raise exception 'Converted task unavailable'; end if;
 else
  insert into public.tasks(id,user_id,title,project,priority,due_date,minutes,completed,note_id,scheduled_date)
  values ((p_task->>'id')::uuid,auth.uid(),p_task->>'title',p_task->>'project',p_task->>'priority',
   nullif(p_task->>'due_date','')::date,(p_task->>'minutes')::integer,false,
   nullif(p_task->>'note_id','')::uuid,nullif(p_task->>'scheduled_date','')::date) returning * into task;
  update public.captures set converted_at=clock_timestamp(),converted_task_id=task.id where id=capture.id returning * into capture;
 end if;
 return jsonb_build_object('task',to_jsonb(task),'capture',to_jsonb(capture));
end $$;

-- Timestamps come from the database, so refreshes and background tabs do not lose time.
create function public.control_focus(p_id uuid,p_action text,p_task_id uuid default null,p_target_minutes integer default 25,p_expected_updated_at timestamptz default null)
returns setof public.focus_sessions language plpgsql security invoker set search_path = '' as $$
declare session public.focus_sessions; stamp timestamptz := clock_timestamp(); elapsed integer;
begin
 if p_action='start' then
  select * into session from public.focus_sessions where id=p_id and user_id=auth.uid();
  if found then return next session; return; end if;
  if p_task_id is not null and not exists(select 1 from public.tasks where id=p_task_id and user_id=auth.uid() and deleted_at is null and not completed) then
   raise exception 'Task unavailable';
  end if;
  insert into public.focus_sessions(id,user_id,task_id,target_minutes,running_since)
   values(p_id,auth.uid(),p_task_id,p_target_minutes,stamp) returning * into session;
 else
  select * into session from public.focus_sessions where id=p_id and user_id=auth.uid() for update;
  if not found or session.completed_at is not null then raise exception 'Session unavailable'; end if;
  if p_expected_updated_at is distinct from session.updated_at then raise exception 'Session changed; reload'; end if;
  elapsed := least(86400,session.elapsed_seconds + case when session.running_since is null then 0
    else greatest(0,floor(extract(epoch from stamp-session.running_since))::integer) end);
  if p_action='pause' and session.running_since is not null then
   update public.focus_sessions set elapsed_seconds=elapsed,running_since=null,updated_at=stamp where id=p_id returning * into session;
  elsif p_action='resume' and session.running_since is null then
   update public.focus_sessions set running_since=stamp,updated_at=stamp where id=p_id returning * into session;
  elsif p_action='finish' then
   update public.focus_sessions set elapsed_seconds=elapsed,running_since=null,completed_at=stamp,updated_at=stamp where id=p_id returning * into session;
  else raise exception 'Invalid timer action'; end if;
 end if;
 return next session;
end $$;
revoke all on function public.convert_capture(uuid,jsonb) from public,anon;
revoke all on function public.control_focus(uuid,text,uuid,integer,timestamptz) from public,anon;
grant execute on function public.convert_capture(uuid,jsonb) to authenticated;
grant execute on function public.control_focus(uuid,text,uuid,integer,timestamptz) to authenticated;
commit;
