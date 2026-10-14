-- Salvataggio atomico del Piano Economico: piano, 12 target mensili e target servizio in un'unica transazione.
-- Qualsiasi errore (vincoli, FK, dati non validi) annulla l'intera operazione. Seed e dati esistenti invariati.
create function public.save_economic_plan(
  p_year integer,
  p_create boolean,
  p_annual_target_cents integer,
  p_expected_uplift_cents integer,
  p_notes text,
  p_monthly jsonb,
  p_services jsonb
)
returns uuid
language plpgsql
as $$
declare
  target_plan_id uuid;
begin
  if jsonb_typeof(p_monthly) <> 'array' or jsonb_typeof(p_services) <> 'array' then
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

  return target_plan_id;
end;
$$;

revoke execute on function public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_economic_plan(integer, boolean, integer, integer, text, jsonb, jsonb) to service_role;
