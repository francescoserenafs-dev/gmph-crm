-- Upsell nel checkout prenotazioni: pacchetti add-on (foto digitali / stampe) per evento + caparra fissa.

alter table public.booking_event_types
  add column addons_digital_mode text not null default 'single' check (addons_digital_mode in ('single', 'multiple')),
  add column addons_print_mode text not null default 'multiple' check (addons_print_mode in ('single', 'multiple')),
  add column deposit_cents integer not null default 0 check (deposit_cents >= 0);

create table public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,
  category text not null check (category in ('digital', 'print')),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  max_quantity integer check (max_quantity > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_addons_event_idx on public.booking_addons (event_type_id, category, sort_order);

create trigger booking_addons_set_updated_at before update on public.booking_addons for each row execute function public.set_updated_at();
create trigger booking_addons_audit after insert or update or delete on public.booking_addons for each row execute function public.record_audit_log();

alter table public.booking_addons enable row level security;

-- Gli add-on scelti nel checkout diventano righe extra: non mappano un service_type e hanno una quantita'.
alter table public.session_extras
  alter column service_type_id drop not null,
  add column quantity integer not null default 1 check (quantity > 0),
  add column booking_addon_id uuid references public.booking_addons(id) on delete set null;

-- Snapshot della caparra richiesta al momento della prenotazione (0 = nessuna caparra).
alter table public.sessions
  add column deposit_cents integer not null default 0 check (deposit_cents >= 0);

-- Il dovuto della sessione ora considera la quantita' degli extra (price_cents * quantity).
create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
as $$
declare
  amount_due_cents integer;
  amount_paid_cents integer;
  extras_cents integer;
begin
  if new.session_id is not null then
    select agreed_price_cents into amount_due_cents from public.sessions where id = new.session_id;
    select coalesce(sum(price_cents * quantity), 0) into extras_cents from public.session_extras where session_id = new.session_id;
    amount_due_cents := amount_due_cents + extras_cents;
    select coalesce(sum(amount_cents), 0) into amount_paid_cents
    from public.payments
    where session_id = new.session_id and id <> new.id;
  else
    select purchase_price_cents into amount_due_cents from public.gift_vouchers where id = new.voucher_id;
    select coalesce(sum(amount_cents), 0) into amount_paid_cents
    from public.payments
    where voucher_id = new.voucher_id and id <> new.id;
  end if;

  if amount_paid_cents + new.amount_cents > amount_due_cents then
    raise exception 'Payment exceeds the remaining amount due.';
  end if;

  return new;
end;
$$;
