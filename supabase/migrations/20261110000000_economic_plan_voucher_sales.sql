-- Piano vendite buoni regalo: previsione separata dal valore servizi pianificato (non vi si somma mai).
-- Si salvano solo ticket medio buono (sul piano) e numero di buoni previsti per mese; i valori sono derivati dall'applicazione.
-- Migrazione additiva: nessun dato esistente viene modificato, nessun valore viene pre-compilato.

alter table public.annual_economic_plans
  add column if not exists planned_voucher_ticket_cents integer not null default 0 check (planned_voucher_ticket_cents >= 0);

create table if not exists public.economic_plan_monthly_voucher_targets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.annual_economic_plans(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  target_count integer not null default 0 check (target_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, month)
);

drop trigger if exists economic_plan_monthly_voucher_targets_set_updated_at on public.economic_plan_monthly_voucher_targets;
create trigger economic_plan_monthly_voucher_targets_set_updated_at before update on public.economic_plan_monthly_voucher_targets for each row execute function public.set_updated_at();
drop trigger if exists economic_plan_monthly_voucher_targets_audit on public.economic_plan_monthly_voucher_targets;
create trigger economic_plan_monthly_voucher_targets_audit after insert or update or delete on public.economic_plan_monthly_voucher_targets for each row execute function public.record_audit_log();
alter table public.economic_plan_monthly_voucher_targets enable row level security;

-- Salvataggio atomico unico: servizi, distribuzione sessioni e piano buoni nella stessa transazione.
drop function if exists public.save_economic_plan(integer, boolean, text, jsonb, jsonb);

create or replace function public.save_economic_plan(
  p_year integer,
  p_create boolean,
  p_notes text,
  p_services jsonb,
  p_service_months jsonb,
  p_voucher_ticket_cents integer,
  p_voucher_months jsonb
)
returns uuid
language plpgsql
as $$
declare
  target_plan_id uuid;
begin
  if jsonb_typeof(p_services) <> 'array' or jsonb_typeof(p_service_months) <> 'array' or jsonb_typeof(p_voucher_months) <> 'array' then
    raise exception 'Invalid plan payload.' using errcode = '22023';
  end if;

  if p_create then
    insert into public.annual_economic_plans (year, notes, planned_voucher_ticket_cents)
    values (p_year, p_notes, p_voucher_ticket_cents)
    returning id into target_plan_id;
  else
    select id into target_plan_id from public.annual_economic_plans where year = p_year for update;
    if not found then
      raise exception 'Economic plan not found.' using errcode = 'P0002';
    end if;
    update public.annual_economic_plans
    set notes = p_notes,
        planned_voucher_ticket_cents = p_voucher_ticket_cents
    where id = target_plan_id;
  end if;

  -- La rimozione di un servizio dal piano elimina anche la sua distribuzione (FK in cascade), mai il servizio dal catalogo.
  delete from public.economic_plan_service_targets
  where plan_id = target_plan_id
    and service_type_id not in (
      select service.service_type_id from jsonb_to_recordset(p_services) as service(service_type_id uuid)
    );

  insert into public.economic_plan_service_targets (plan_id, service_type_id, planned_ticket_cents)
  select target_plan_id, service.service_type_id, service.planned_ticket_cents
  from jsonb_to_recordset(p_services) as service(service_type_id uuid, planned_ticket_cents integer)
  on conflict (plan_id, service_type_id) do update
  set planned_ticket_cents = excluded.planned_ticket_cents;

  delete from public.economic_plan_monthly_service_targets where plan_id = target_plan_id;
  insert into public.economic_plan_monthly_service_targets (plan_id, service_type_id, month, target_sessions)
  select target_plan_id, entry.service_type_id, entry.month, entry.target_sessions
  from jsonb_to_recordset(p_service_months) as entry(service_type_id uuid, month integer, target_sessions integer);

  delete from public.economic_plan_monthly_voucher_targets where plan_id = target_plan_id;
  insert into public.economic_plan_monthly_voucher_targets (plan_id, month, target_count)
  select target_plan_id, entry.month, entry.target_count
  from jsonb_to_recordset(p_voucher_months) as entry(month integer, target_count integer);

  return target_plan_id;
end;
$$;

revoke execute on function public.save_economic_plan(integer, boolean, text, jsonb, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_economic_plan(integer, boolean, text, jsonb, jsonb, integer, jsonb) to service_role;

comment on column public.app_settings.annual_budget_cents is 'Legacy: non piu usato dal CRM. Il riferimento annuale e il valore servizi pianificato del Piano Economico.';
