-- Piani economici annuali indipendenti: target annuale, mensile e per servizio, modificabili dal CRM.
-- Non sostituisce app_settings.annual_budget_cents (budget della Home), che resta invariato.

create table public.annual_economic_plans (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique check (year between 2000 and 2100),
  annual_target_cents integer not null default 0 check (annual_target_cents >= 0),
  expected_uplift_cents integer not null default 0 check (expected_uplift_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.economic_plan_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.annual_economic_plans(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  target_cents integer not null default 0 check (target_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, month)
);

create table public.economic_plan_service_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.annual_economic_plans(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  target_sessions integer not null default 0 check (target_sessions >= 0),
  target_value_cents integer not null default 0 check (target_value_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, service_type_id)
);

create index economic_plan_service_targets_service_idx on public.economic_plan_service_targets (service_type_id);

create trigger annual_economic_plans_set_updated_at before update on public.annual_economic_plans for each row execute function public.set_updated_at();
create trigger economic_plan_monthly_targets_set_updated_at before update on public.economic_plan_monthly_targets for each row execute function public.set_updated_at();
create trigger economic_plan_service_targets_set_updated_at before update on public.economic_plan_service_targets for each row execute function public.set_updated_at();
create trigger annual_economic_plans_audit after insert or update or delete on public.annual_economic_plans for each row execute function public.record_audit_log();
create trigger economic_plan_monthly_targets_audit after insert or update or delete on public.economic_plan_monthly_targets for each row execute function public.record_audit_log();
create trigger economic_plan_service_targets_audit after insert or update or delete on public.economic_plan_service_targets for each row execute function public.record_audit_log();

alter table public.annual_economic_plans enable row level security;
alter table public.economic_plan_monthly_targets enable row level security;
alter table public.economic_plan_service_targets enable row level security;

-- Seed 2027 solo alla prima creazione: se il piano esiste gia non viene toccato.
-- I servizi sono collegati per nome reale; un servizio assente viene saltato, non creato.
do $$
declare
  new_plan_id uuid;
begin
  if exists (select 1 from public.annual_economic_plans where year = 2027) then
    return;
  end if;

  insert into public.annual_economic_plans (year, annual_target_cents, expected_uplift_cents, notes)
  values (2027, 1500000, 76500, 'Piano economico centrale GMPH 2027')
  returning id into new_plan_id;

  insert into public.economic_plan_monthly_targets (plan_id, month, target_cents)
  select new_plan_id, monthly.month, monthly.target_cents
  from (values
    (1, 45000), (2, 45000), (3, 120000), (4, 200000), (5, 180000), (6, 120000),
    (7, 100000), (8, 0), (9, 150000), (10, 170000), (11, 370000), (12, 0)
  ) as monthly(month, target_cents);

  insert into public.economic_plan_service_targets (plan_id, service_type_id, target_sessions, target_value_cents)
  select new_plan_id, service.id, planned.target_sessions, planned.target_value_cents
  from (values
    ('Famiglia', 15, 360000),
    ('Maternità', 10, 230000),
    ('Kids', 8, 100000),
    ('Ritratto', 6, 120000),
    ('Mini Sessione Natale', 25, 337500),
    ('Mini Sessione Autunno', 8, 96000),
    ('Mini Sessione Festa della Mamma', 6, 75000),
    ('Battesimo', 3, 105000)
  ) as planned(service_name, target_sessions, target_value_cents)
  join public.service_types service on service.name = planned.service_name;
end;
$$;
