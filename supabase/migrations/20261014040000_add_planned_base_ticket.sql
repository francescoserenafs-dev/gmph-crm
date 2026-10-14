-- Target per servizio: il ticket medio base pianificato diventa l'input, il valore target ne deriva
-- (target_value_cents = target_sessions * planned_base_ticket_cents), calcolato solo nel DB.

alter table public.economic_plan_service_targets
  add column planned_base_ticket_cents integer not null default 0 check (planned_base_ticket_cents >= 0);

-- Backfill dai target esistenti senza toccare target_sessions ne target_value_cents (2027: tutte divisioni esatte).
update public.economic_plan_service_targets
set planned_base_ticket_cents = case when target_sessions > 0 then round(target_value_cents::numeric / target_sessions)::integer else 0 end;

-- Stessa firma: p_services ora porta planned_base_ticket_cents; un eventuale target_value_cents dal client viene ignorato.
create or replace function public.save_economic_plan(
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

  -- Prodotto in bigint: un valore oltre il limite integer fa fallire (e annullare) l'intero salvataggio.
  insert into public.economic_plan_service_targets (plan_id, service_type_id, target_sessions, planned_base_ticket_cents, target_value_cents)
  select target_plan_id, service.service_type_id, service.target_sessions, service.planned_base_ticket_cents,
    (service.target_sessions::bigint * service.planned_base_ticket_cents)::integer
  from jsonb_to_recordset(p_services) as service(service_type_id uuid, target_sessions integer, planned_base_ticket_cents integer)
  on conflict (plan_id, service_type_id) do update
  set target_sessions = excluded.target_sessions,
      planned_base_ticket_cents = excluded.planned_base_ticket_cents,
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
