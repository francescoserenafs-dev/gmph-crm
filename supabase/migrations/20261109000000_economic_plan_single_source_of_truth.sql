-- Piano Economico con una sola fonte di verita: per servizio si salvano solo ticket medio pianificato
-- (extra inclusi) e sessioni dei 12 mesi. Sessioni totali, valori per servizio, fatturato mensile e annuale
-- sono sempre calcolati dall'applicazione (computePlanTotals) e non vengono piu salvati.
-- Tocca solo le tabelle del Piano Economico: catalogo servizi, pacchetti/listini, sessioni e clienti restano invariati.

-- 1. Reset voluto del Piano 2027: riparte vuoto, senza convertire i valori precedenti (il piano resta, vuoto).
delete from public.economic_plan_service_targets
where plan_id in (select id from public.annual_economic_plans where year = 2027);

update public.annual_economic_plans set notes = null where year = 2027;

-- 2. Rimozione dei campi economici manuali o derivati.
drop function if exists public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb, jsonb);

drop table public.economic_plan_monthly_targets;

alter table public.annual_economic_plans
  drop column annual_target_cents,
  drop column expected_uplift_cents;

alter table public.economic_plan_service_targets
  drop column target_sessions,
  drop column target_value_cents;

alter table public.economic_plan_service_targets
  rename column planned_base_ticket_cents to planned_ticket_cents;

-- 3. Salvataggio atomico dei soli dati canonici.
create function public.save_economic_plan(
  p_year integer,
  p_create boolean,
  p_notes text,
  p_services jsonb,
  p_service_months jsonb
)
returns uuid
language plpgsql
as $$
declare
  target_plan_id uuid;
begin
  if jsonb_typeof(p_services) <> 'array' or jsonb_typeof(p_service_months) <> 'array' then
    raise exception 'Invalid plan payload.' using errcode = '22023';
  end if;

  if p_create then
    insert into public.annual_economic_plans (year, notes)
    values (p_year, p_notes)
    returning id into target_plan_id;
  else
    select id into target_plan_id from public.annual_economic_plans where year = p_year for update;
    if not found then
      raise exception 'Economic plan not found.' using errcode = 'P0002';
    end if;
    update public.annual_economic_plans set notes = p_notes where id = target_plan_id;
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

  return target_plan_id;
end;
$$;

revoke execute on function public.save_economic_plan(integer, boolean, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_economic_plan(integer, boolean, text, jsonb, jsonb) to service_role;
