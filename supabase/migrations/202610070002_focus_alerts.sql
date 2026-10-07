begin;
-- Only focus sessions change; task estimates retain their five-minute minimum.
alter table public.focus_sessions drop constraint focus_sessions_target_minutes_check;
alter table public.focus_sessions add constraint focus_sessions_target_minutes_check
 check (target_minutes between 2 and 480);
commit;
