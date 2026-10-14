-- Distribuzione mensile delle sessioni target per servizio del Piano Economico.
-- Dato di pianificazione: non ricalcola i target in euro.

create table public.economic_plan_monthly_service_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.annual_economic_plans(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  month integer not null check (month between 1 and 12),
  target_sessions integer not null default 0 check (target_sessions >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, service_type_id, month),
  -- La distribuzione esiste solo per servizi presenti nel piano e sparisce con loro.
  foreign key (plan_id, service_type_id) references public.economic_plan_service_targets(plan_id, service_type_id) on delete cascade
);

create trigger economic_plan_monthly_service_targets_set_updated_at before update on public.economic_plan_monthly_service_targets for each row execute function public.set_updated_at();
create trigger economic_plan_monthly_service_targets_audit after insert or update or delete on public.economic_plan_monthly_service_targets for each row execute function public.record_audit_log();
alter table public.economic_plan_monthly_service_targets enable row level security;

-- Seed distribuzione 2027 solo se il piano 2027 non ha ancora alcuna distribuzione (mai sovrascrivere modifiche manuali).
-- Battesimo resta volutamente non distribuito. Servizi assenti dal piano 2027 vengono saltati.
do $$
declare
  plan_2027 uuid;
begin
  select id into plan_2027 from public.annual_economic_plans where year = 2027;
  if plan_2027 is null or exists (select 1 from public.economic_plan_monthly_service_targets where plan_id = plan_2027) then
    return;
  end if;

  insert into public.economic_plan_monthly_service_targets (plan_id, service_type_id, month, target_sessions)
  select plan_2027, target.service_type_id, distribution.month, distribution.sessions[distribution.month]
  from (values
    ('Famiglia', array[0, 0, 3, 3, 3, 0, 0, 0, 3, 3, 0, 0]),
    ('Maternità', array[1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0]),
    ('Kids', array[0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 0, 0]),
    ('Ritratto', array[1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
    ('Mini Sessione Festa della Mamma', array[0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0]),
    ('Mini Sessione Autunno', array[0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 0, 0]),
    ('Mini Sessione Natale', array[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 0])
  ) as planned(service_name, sessions)
  join public.service_types service on service.name = planned.service_name
  join public.economic_plan_service_targets target on target.plan_id = plan_2027 and target.service_type_id = service.id
  cross join lateral (select generate_series(1, 12) as month, planned.sessions) as distribution;
end;
$$;

-- Il salvataggio atomico include ora la distribuzione mensile: nuova firma, la precedente viene sostituita.
drop function public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb);

create function public.save_economic_plan(
  p_year integer,
  p_create boolean,
  p_annual_target_cents integer,
  p_expected_uplift_cents integer,
  p_notes text,
  p_monthly jsonb,
  p_services jsonb,
  p_service_months jsonb
)
returns uuid
language plpgsql
as $$
declare
  target_plan_id uuid;
begin
  if jsonb_typeof(p_monthly) <> 'array' or jsonb_typeof(p_services) <> 'array' or jsonb_typeof(p_service_months) <> 'array' then
    raise exception 'Invalid plan payload.' using errcode = '22023';
  end if;

  if (select count(distinct (entry->>'month')::integer) from jsonb_array_elements(p_monthly) entry) <> 12
    or jsonb_array_length(p_monthly) <> 12 then
    raise exception 'Exactly 12 distinct monthly targets are required.' using errcode = '22023';
  end if;

  if p_create then
    insert into public.annual_economic_plans (year, annual_target_cents, expected_uplift_cents, notes)
    values (p_year, p_annual_target_cents, p_expected_uplift_cents, p_notes)
    returning id into target_plan_id;
  else
    select id into target_plan_id from public.annual_economic_plans where year = p_year for update;
    if not found then
      raise exception 'Economic plan not found.' using errcode = 'P0002';
    end if;
    update public.annual_economic_plans
    set annual_target_cents = p_annual_target_cents,
        expected_uplift_cents = p_expected_uplift_cents,
        notes = p_notes
    where id = target_plan_id;
  end if;

  insert into public.economic_plan_monthly_targets (plan_id, month, target_cents)
  select target_plan_id, monthly.month, monthly.target_cents
  from jsonb_to_recordset(p_monthly) as monthly(month integer, target_cents integer)
  on conflict (plan_id, month) do update set target_cents = excluded.target_cents;

  -- La rimozione di un servizio elimina anche la sua distribuzione (FK in cascade).
  delete from public.economic_plan_service_targets
  where plan_id = target_plan_id
    and service_type_id not in (
      select service.service_type_id from jsonb_to_recordset(p_services) as service(service_type_id uuid)
    );

  insert into public.economic_plan_service_targets (plan_id, service_type_id, target_sessions, target_value_cents)
  select target_plan_id, service.service_type_id, service.target_sessions, service.target_value_cents
  from jsonb_to_recordset(p_services) as service(service_type_id uuid, target_sessions integer, target_value_cents integer)
  on conflict (plan_id, service_type_id) do update
  set target_sessions = excluded.target_sessions,
      target_value_cents = excluded.target_value_cents;

  delete from public.economic_plan_monthly_service_targets where plan_id = target_plan_id;
  insert into public.economic_plan_monthly_service_targets (plan_id, service_type_id, month, target_sessions)
  select target_plan_id, entry.service_type_id, entry.month, entry.target_sessions
  from jsonb_to_recordset(p_service_months) as entry(service_type_id uuid, month integer, target_sessions integer);

  return target_plan_id;
end;
$$;

revoke execute on function public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb, jsonb) to service_role;
