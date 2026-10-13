-- Catalogo extra configurabile + snapshot economico sulle vendite (session_extras).
-- session_extras.service_name resta lo snapshot del nome; line_total_cents diventa il totale autorevole della riga.

create table public.extra_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('digital', 'print', 'album', 'other')),
  pricing_mode text not null default 'unit' check (pricing_mode in ('unit', 'tiered')),
  unit_price_cents integer check (unit_price_cents >= 0),
  unit_cost_cents integer check (unit_cost_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extra_products_unit_requires_price check (pricing_mode <> 'unit' or unit_price_cents is not null)
);

create index extra_products_active_idx on public.extra_products (is_active, sort_order);

-- Contiguita e non sovrapposizione degli scaglioni sono validate dall'API.
create table public.extra_product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  extra_product_id uuid not null references public.extra_products(id) on delete cascade,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (extra_product_id, min_quantity)
);

create trigger extra_products_set_updated_at before update on public.extra_products for each row execute function public.set_updated_at();
create trigger extra_product_price_tiers_set_updated_at before update on public.extra_product_price_tiers for each row execute function public.set_updated_at();
create trigger extra_products_audit after insert or update or delete on public.extra_products for each row execute function public.record_audit_log();
create trigger extra_product_price_tiers_audit after insert or update or delete on public.extra_product_price_tiers for each row execute function public.record_audit_log();

alter table public.extra_products enable row level security;
alter table public.extra_product_price_tiers enable row level security;

alter table public.session_extras
  add column extra_product_id uuid references public.extra_products(id) on delete restrict,
  add column category_snapshot text check (category_snapshot in ('digital', 'print', 'album', 'other')),
  add column unit_cost_cents integer check (unit_cost_cents >= 0),
  add column line_total_cents integer check (line_total_cents >= 0);

-- Backfill: il valore economico storico resta identico (price_cents * quantity).
update public.session_extras set line_total_cents = price_cents * quantity where line_total_cents is null;

update public.session_extras extra
set category_snapshot = addon.category
from public.booking_addons addon
where extra.booking_addon_id = addon.id and extra.category_snapshot is null;

-- Gli insert che non indicano il totale (es. codice precedente) ricadono sulla formula legacy.
create function public.default_session_extra_line_total()
returns trigger
language plpgsql
as $$
begin
  if new.line_total_cents is null then
    new.line_total_cents := new.price_cents * new.quantity;
  end if;
  return new;
end;
$$;

create trigger session_extras_default_line_total before insert or update on public.session_extras for each row execute function public.default_session_extra_line_total();

alter table public.session_extras alter column line_total_cents set not null;

-- Il dovuto della sessione usa ora il totale riga. Resto invariato rispetto a 20261010000000.
create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
as $$
declare
  amount_due_cents integer;
  amount_paid_cents integer;
  extras_cents integer;
begin
  if tg_op = 'UPDATE'
    and new.amount_cents <= old.amount_cents
    and new.session_id is not distinct from old.session_id
    and new.voucher_id is not distinct from old.voucher_id then
    return new;
  end if;

  if new.session_id is not null then
    select agreed_price_cents into amount_due_cents from public.sessions where id = new.session_id;
    select coalesce(sum(line_total_cents), 0) into extras_cents from public.session_extras where session_id = new.session_id;
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

-- Stessa logica di 20260921000000; cambia solo il dovuto, ora coerente con validate_payment_amount.
create or replace function public.validate_voucher_redemption()
returns trigger
language plpgsql
as $$
declare
  voucher public.gift_vouchers;
  session_record public.sessions;
  voucher_method_code text;
  voucher_credit_cents integer;
  session_due_cents integer;
  amount_paid_cents integer;
  expected_amount_cents integer;
begin
  select code into voucher_method_code from public.payment_methods where id = new.payment_method_id;

  if new.applied_voucher_id is null then
    if voucher_method_code = 'gift_voucher' then
      raise exception 'A gift voucher payment must reference an applied voucher.';
    end if;
    if new.voucher_unused_cents <> 0 then
      raise exception 'Only a gift voucher payment may have an unused voucher amount.';
    end if;
    return new;
  end if;

  if voucher_method_code <> 'gift_voucher' or new.category <> 'voucher_redemption' then
    raise exception 'A redeemed voucher requires the gift_voucher method and voucher_redemption category.';
  end if;

  select * into voucher from public.gift_vouchers where id = new.applied_voucher_id for update;
  select * into session_record from public.sessions where id = new.session_id;

  if voucher.status <> 'active' or voucher.expires_at <= now() then
    raise exception 'The gift voucher is not active or has expired.';
  end if;

  voucher_credit_cents := case
    when voucher.voucher_type = 'value' then voucher.value_cents
    else voucher.purchase_price_cents
  end;
  select session_record.agreed_price_cents + coalesce(sum(line_total_cents), 0)
  into session_due_cents
  from public.session_extras
  where session_id = new.session_id;
  select coalesce(sum(amount_cents), 0)
  into amount_paid_cents
  from public.payments
  where session_id = new.session_id and id <> new.id;

  if amount_paid_cents >= session_due_cents then
    raise exception 'The session is already fully paid.';
  end if;

  expected_amount_cents := least(voucher_credit_cents, session_due_cents - amount_paid_cents);
  if new.amount_cents <> expected_amount_cents
    or new.voucher_unused_cents <> voucher_credit_cents - expected_amount_cents then
    raise exception 'Voucher contribution must match the remaining session balance.';
  end if;

  update public.gift_vouchers
  set status = 'redeemed', redeemed_session_id = new.session_id, redeemed_at = coalesce(new.paid_at, new.paid_date::timestamptz)
  where id = voucher.id;

  return new;
end;
$$;

-- Catalogo iniziale modificabile dal CRM.
with digital as (
  insert into public.extra_products (name, category, pricing_mode, sort_order)
  values ('Foto digitali extra', 'digital', 'tiered', 10)
  returning id
)
insert into public.extra_product_price_tiers (extra_product_id, min_quantity, max_quantity, unit_price_cents, sort_order)
select digital.id, tier.min_quantity, tier.max_quantity, tier.unit_price_cents, tier.sort_order
from digital, (values (1, 5, 800, 10), (6, 10, 600, 20), (11, null::integer, 500, 30)) as tier(min_quantity, max_quantity, unit_price_cents, sort_order);

insert into public.extra_products (name, category, pricing_mode, unit_price_cents, sort_order)
values ('Altro', 'other', 'unit', 0, 1000);
