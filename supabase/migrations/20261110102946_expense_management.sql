create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  kind text not null check (kind in ('operating', 'tax_contribution')),
  is_marketing boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_marketing or kind = 'operating')
);
create unique index expense_categories_name_idx on public.expense_categories (lower(name));
create unique index expense_categories_marketing_idx on public.expense_categories (is_marketing) where is_marketing;

insert into public.expense_categories (name, kind, is_marketing, sort_order) values
  ('Software e abbonamenti', 'operating', false, 10),
  ('Sito, dominio e hosting', 'operating', false, 20),
  ('Commercialista e assicurazioni', 'operating', false, 30),
  ('Marketing e pubblicità', 'operating', true, 40),
  ('Materiali, packaging e cancelleria', 'operating', false, 50),
  ('Attrezzatura e acquisti', 'operating', false, 60),
  ('Altro', 'operating', false, 70),
  ('Imposte e contributi', 'tax_contribution', false, 80);

create table public.recurring_expense_rules (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(btrim(description)) between 1 and 200),
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  supplier text check (length(supplier) <= 200),
  net_amount_cents integer not null check (net_amount_cents between 0 and 1000000000),
  vat_amount_cents integer not null default 0 check (vat_amount_cents between 0 and 1000000000),
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  start_date date not null check (start_date between date '2000-01-01' and date '2100-12-31'),
  end_date date check (end_date between start_date and date '2100-12-31'),
  is_active boolean not null default true,
  marketing_service_type_id uuid references public.service_types(id) on delete restrict,
  marketing_campaign_year integer check (marketing_campaign_year between 2000 and 2100),
  notes text check (length(notes) <= 2000),
  processed_through date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_amount_cents + vat_amount_cents between 1 and 1000000000),
  check ((marketing_service_type_id is null) = (marketing_campaign_year is null))
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(btrim(description)) between 1 and 200),
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  category_name_snapshot text not null,
  category_kind_snapshot text not null check (category_kind_snapshot in ('operating', 'tax_contribution')),
  category_is_marketing_snapshot boolean not null,
  supplier text check (length(supplier) <= 200),
  paid_date date not null check (paid_date between date '2000-01-01' and date '2100-12-31'),
  net_amount_cents integer not null check (net_amount_cents between 0 and 1000000000),
  vat_amount_cents integer not null default 0 check (vat_amount_cents between 0 and 1000000000),
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  payment_method_name_snapshot text not null,
  notes text check (length(notes) <= 2000),
  marketing_service_type_id uuid references public.service_types(id) on delete restrict,
  marketing_campaign_year integer check (marketing_campaign_year between 2000 and 2100),
  marketing_service_name_snapshot text,
  recurring_rule_id uuid references public.recurring_expense_rules(id) on delete restrict,
  recurring_occurrence_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_amount_cents + vat_amount_cents between 1 and 1000000000),
  check ((marketing_service_type_id is null) = (marketing_campaign_year is null)),
  check (marketing_service_type_id is null or (category_is_marketing_snapshot and category_kind_snapshot = 'operating')),
  check ((recurring_rule_id is null) = (recurring_occurrence_date is null)),
  unique (recurring_rule_id, recurring_occurrence_date)
);
create index expenses_paid_date_idx on public.expenses (paid_date, id);
create index expenses_category_idx on public.expenses (expense_category_id);
create index expenses_payment_method_idx on public.expenses (payment_method_id);
create index expenses_marketing_idx on public.expenses (marketing_campaign_year, marketing_service_type_id) where marketing_service_type_id is not null;

create function public.validate_expense_category()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.kind is distinct from old.kind or new.is_marketing is distinct from old.is_marketing then
    raise exception 'Il tipo della categoria non puo essere modificato.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.validate_expense_references()
returns trigger language plpgsql set search_path = public as $$
declare
  category public.expense_categories;
  method public.payment_methods;
  service public.service_types;
  generated_expense boolean := false;
begin
  if tg_table_name = 'expenses' then
    generated_expense := new.recurring_rule_id is not null;
    if new.paid_date > (now() at time zone 'Europe/Rome')::date then
      raise exception 'Un costo pagato non puo avere una data futura.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' then
      if new.recurring_rule_id is distinct from old.recurring_rule_id or new.recurring_occurrence_date is distinct from old.recurring_occurrence_date then
        raise exception 'L origine della ricorrenza non puo essere modificata.' using errcode = '23514';
      end if;
    end if;
  end if;

  select * into category from public.expense_categories where id = new.expense_category_id;
  select * into method from public.payment_methods where id = new.payment_method_id;
  if category.id is null or method.id is null or method.is_system then
    raise exception 'Categoria o metodo di pagamento non validi.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if not generated_expense and (not category.is_active or not method.is_active) then
      raise exception 'Categoria o metodo disattivati.' using errcode = '23514';
    end if;
  else
    if (new.expense_category_id is distinct from old.expense_category_id and not category.is_active)
      or (new.payment_method_id is distinct from old.payment_method_id and not method.is_active) then
      raise exception 'Categoria o metodo disattivati.' using errcode = '23514';
    end if;
  end if;
  if new.marketing_service_type_id is not null then
    select * into service from public.service_types where id = new.marketing_service_type_id;
    if not category.is_marketing or service.id is null or service.is_addon then
      raise exception 'Attribuzione marketing non valida.' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' then
      if not generated_expense and not service.is_active then
        raise exception 'Servizio marketing disattivato.' using errcode = '23514';
      end if;
    elsif new.marketing_service_type_id is distinct from old.marketing_service_type_id and not service.is_active then
      raise exception 'Servizio marketing disattivato.' using errcode = '23514';
    end if;
  end if;

  if tg_table_name = 'expenses' then
    if tg_op = 'INSERT' then
      new.category_name_snapshot := category.name;
      new.category_kind_snapshot := category.kind;
      new.category_is_marketing_snapshot := category.is_marketing;
      new.payment_method_name_snapshot := method.name;
      new.marketing_service_name_snapshot := service.name;
    else
      new.category_name_snapshot := case when new.expense_category_id is distinct from old.expense_category_id then category.name else old.category_name_snapshot end;
      new.category_kind_snapshot := case when new.expense_category_id is distinct from old.expense_category_id then category.kind else old.category_kind_snapshot end;
      new.category_is_marketing_snapshot := case when new.expense_category_id is distinct from old.expense_category_id then category.is_marketing else old.category_is_marketing_snapshot end;
      new.payment_method_name_snapshot := case when new.payment_method_id is distinct from old.payment_method_id then method.name else old.payment_method_name_snapshot end;
      new.marketing_service_name_snapshot := case when new.marketing_service_type_id is distinct from old.marketing_service_type_id then service.name else old.marketing_service_name_snapshot end;
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_category_validate before update on public.expense_categories for each row execute function public.validate_expense_category();
create trigger expenses_validate before insert or update on public.expenses for each row execute function public.validate_expense_references();
create trigger recurring_expenses_validate before insert or update on public.recurring_expense_rules for each row execute function public.validate_expense_references();

create trigger expense_categories_updated before update on public.expense_categories for each row execute function public.set_updated_at();
create trigger expenses_updated before update on public.expenses for each row execute function public.set_updated_at();
create trigger recurring_expenses_updated before update on public.recurring_expense_rules for each row execute function public.set_updated_at();
create trigger expense_categories_audit after insert or update or delete on public.expense_categories for each row execute function public.record_audit_log();
create trigger expenses_audit after insert or update or delete on public.expenses for each row execute function public.record_audit_log();
create trigger recurring_expenses_audit after insert or update or delete on public.recurring_expense_rules for each row execute function public.record_audit_log();

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expense_rules enable row level security;
revoke all on public.expense_categories, public.expenses, public.recurring_expense_rules from public, anon, authenticated;
grant select, insert, update, delete on public.expense_categories, public.expenses, public.recurring_expense_rules to service_role;

create function public.expense_occurrence_dates(p_start date, p_end date, p_frequency text, p_after date, p_until date)
returns table (occurrence_date date)
language sql immutable set search_path = public as $$
  with step as (
    select case p_frequency when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 end as months
  ), dates as (
    select (p_start + make_interval(months => sequence * step.months))::date as occurrence_date
    from step, generate_series(0, greatest(0, ((extract(year from p_until)::integer - extract(year from p_start)::integer) * 12 + extract(month from p_until)::integer - extract(month from p_start)::integer) / step.months)) sequence
  )
  select occurrence_date from dates
  where occurrence_date <= p_until
    and (p_end is null or occurrence_date <= p_end)
    and (p_after is null or occurrence_date > p_after)
  order by occurrence_date;
$$;

create function public.materialize_due_recurring_expenses(
  p_rule_id uuid default null,
  p_until date default (now() at time zone 'Europe/Rome')::date
)
returns integer language plpgsql set search_path = public as $$
declare
  rule public.recurring_expense_rules;
  inserted_count integer;
  total_count integer := 0;
begin
  if p_until is null or p_until > (now() at time zone 'Europe/Rome')::date then
    raise exception 'Non e possibile generare costi futuri.' using errcode = '22023';
  end if;
  for rule in select * from public.recurring_expense_rules
    where is_active and (p_rule_id is null or id = p_rule_id)
      and (processed_through is null or processed_through < p_until)
    order by id for update
  loop
    insert into public.expenses (
      description, expense_category_id, supplier, paid_date, net_amount_cents, vat_amount_cents,
      payment_method_id, notes, marketing_service_type_id, marketing_campaign_year,
      recurring_rule_id, recurring_occurrence_date
    )
    select rule.description, rule.expense_category_id, rule.supplier, dates.occurrence_date,
      rule.net_amount_cents, rule.vat_amount_cents, rule.payment_method_id, rule.notes,
      rule.marketing_service_type_id, rule.marketing_campaign_year, rule.id, dates.occurrence_date
    from public.expense_occurrence_dates(rule.start_date, rule.end_date, rule.frequency, rule.processed_through, p_until) dates
    on conflict (recurring_rule_id, recurring_occurrence_date) do nothing;
    get diagnostics inserted_count = row_count;
    total_count := total_count + inserted_count;
    update public.recurring_expense_rules set processed_through = p_until where id = rule.id;
  end loop;
  return total_count;
end;
$$;

create function public.save_recurring_expense_rule(
  p_values jsonb,
  p_id uuid default null,
  p_confirm_count integer default null,
  p_today date default (now() at time zone 'Europe/Rome')::date
)
returns uuid language plpgsql set search_path = public as $$
declare
  input public.recurring_expense_rules;
  target_id uuid;
  due_count integer;
begin
  if p_today is null or p_today > (now() at time zone 'Europe/Rome')::date or jsonb_typeof(p_values) <> 'object' then
    raise exception 'Dati ricorrenza non validi.' using errcode = '22023';
  end if;
  input := jsonb_populate_record(null::public.recurring_expense_rules, p_values);
  if p_id is null then
    select count(*) into due_count from public.expense_occurrence_dates(input.start_date, input.end_date, input.frequency, null, p_today);
    if input.is_active and input.start_date < p_today and due_count > 0 and p_confirm_count is distinct from due_count then
      raise exception 'Conferma richiesta per i costi gia maturati.' using errcode = 'P0001', detail = due_count::text;
    end if;
    insert into public.recurring_expense_rules (
      description, expense_category_id, supplier, net_amount_cents, vat_amount_cents, payment_method_id,
      frequency, start_date, end_date, is_active, marketing_service_type_id, marketing_campaign_year, notes
    ) values (
      input.description, input.expense_category_id, input.supplier, input.net_amount_cents, input.vat_amount_cents,
      input.payment_method_id, input.frequency, input.start_date, input.end_date, input.is_active,
      input.marketing_service_type_id, input.marketing_campaign_year, input.notes
    ) returning id into target_id;
    perform public.materialize_due_recurring_expenses(target_id, p_today);
  else
    select id into target_id from public.recurring_expense_rules where id = p_id for update;
    if not found then raise exception 'Ricorrenza non trovata.' using errcode = 'P0002'; end if;
    perform public.materialize_due_recurring_expenses(target_id, p_today);
    update public.recurring_expense_rules set
      description = input.description, expense_category_id = input.expense_category_id, supplier = input.supplier,
      net_amount_cents = input.net_amount_cents, vat_amount_cents = input.vat_amount_cents,
      payment_method_id = input.payment_method_id, frequency = input.frequency, start_date = input.start_date,
      end_date = input.end_date, is_active = input.is_active, marketing_service_type_id = input.marketing_service_type_id,
      marketing_campaign_year = input.marketing_campaign_year, notes = input.notes, processed_through = p_today
    where id = target_id;
  end if;
  return target_id;
end;
$$;

revoke all on function public.expense_occurrence_dates(date, date, text, date, date) from public, anon, authenticated;
revoke all on function public.materialize_due_recurring_expenses(uuid, date) from public, anon, authenticated;
revoke all on function public.save_recurring_expense_rule(jsonb, uuid, integer, date) from public, anon, authenticated;
grant execute on function public.expense_occurrence_dates(date, date, text, date, date) to service_role;
grant execute on function public.materialize_due_recurring_expenses(uuid, date) to service_role;
grant execute on function public.save_recurring_expense_rule(jsonb, uuid, integer, date) to service_role;