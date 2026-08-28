alter table public.sessions
  add column duration_minutes integer not null default 60 check (duration_minutes > 0),
  add column location text,
  add column service_detail text;

alter table public.sessions alter column duration_minutes drop default;

insert into public.service_types (name, sort_order) values
  ('Famiglia', 10),
  ('Newborn', 20),
  ('Compleanno', 30),
  ('Maternita', 40),
  ('Altro', 50)
on conflict (name) do nothing;

create function public.validate_session_schedule()
returns trigger
language plpgsql
as $$
declare
  has_overlap boolean;
  is_cancelled boolean;
  is_other_service boolean;
begin
  select code = 'cancelled' into is_cancelled
  from public.session_stages
  where id = new.current_stage_id;

  select name = 'Altro' into is_other_service
  from public.service_types
  where id = new.service_type_id;

  if is_other_service and (new.service_detail is null or btrim(new.service_detail) = '') then
    raise exception 'Sessions in the Altro category require a service detail.';
  end if;

  if not is_other_service and new.service_detail is not null then
    raise exception 'Only sessions in the Altro category may have a service detail.';
  end if;

  if is_cancelled then
    return new;
  end if;

  select exists (
    select 1
    from public.sessions existing_session
    join public.session_stages existing_stage on existing_stage.id = existing_session.current_stage_id
    where existing_session.id <> new.id
      and existing_stage.code <> 'cancelled'
      and existing_session.scheduled_at < new.scheduled_at + make_interval(mins => new.duration_minutes)
      and existing_session.scheduled_at + make_interval(mins => existing_session.duration_minutes) > new.scheduled_at
  ) into has_overlap;

  if has_overlap then
    raise exception 'The session overlaps with an existing scheduled session.';
  end if;

  return new;
end;
$$;

create or replace function public.record_session_stage_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.current_stage_id is distinct from old.current_stage_id then
    insert into public.session_stage_history (session_id, stage_id, stage_name, changed_at)
    select
      new.id,
      id,
      name,
      case when tg_op = 'INSERT' and new.scheduled_at < now() then new.scheduled_at else now() end
    from public.session_stages
    where id = new.current_stage_id;
  end if;
  return new;
end;
$$;

create trigger sessions_validate_schedule
before insert or update of scheduled_at, duration_minutes, service_type_id, service_detail, current_stage_id
on public.sessions
for each row
execute function public.validate_session_schedule();

create index sessions_scheduled_at_duration_idx on public.sessions (scheduled_at, duration_minutes);