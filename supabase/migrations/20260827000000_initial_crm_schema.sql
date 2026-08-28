create extension if not exists pgcrypto;

create type public.voucher_type as enum ('service', 'value');
create type public.voucher_status as enum ('active', 'redeemed', 'expired', 'cancelled');
create type public.payment_category as enum ('deposit', 'balance', 'full_payment', 'voucher_purchase');

create table public.app_settings (
  id boolean primary key default true check (id),
  currency_code char(3) not null default 'EUR',
  voucher_validity_months integer not null default 12 check (voucher_validity_months between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  suggested_price_cents integer check (suggested_price_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[a-z0-9_]+$')
);

create table public.session_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[a-z0-9_]+$')
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  service_name text not null,
  scheduled_at timestamptz not null,
  agreed_price_cents integer not null check (agreed_price_cents >= 0),
  current_stage_id uuid not null references public.session_stages(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_stage_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  stage_id uuid not null references public.session_stages(id) on delete restrict,
  stage_name text not null,
  changed_at timestamptz not null default now(),
  notes text
);

create table public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  voucher_type public.voucher_type not null,
  purchaser_client_id uuid not null references public.clients(id) on delete restrict,
  recipient_client_id uuid references public.clients(id) on delete set null,
  service_type_id uuid references public.service_types(id) on delete restrict,
  service_name text,
  value_cents integer,
  purchase_price_cents integer not null check (purchase_price_cents >= 0),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.voucher_status not null default 'active',
  redeemed_session_id uuid unique references public.sessions(id) on delete restrict,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (voucher_type = 'service' and service_type_id is not null and service_name is not null and value_cents is null)
    or (voucher_type = 'value' and service_type_id is null and service_name is null and value_cents is not null and value_cents > 0)
  ),
  check ((status = 'redeemed') = (redeemed_session_id is not null)),
  check ((status = 'redeemed') = (redeemed_at is not null))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete restrict,
  voucher_id uuid references public.gift_vouchers(id) on delete restrict,
  applied_voucher_id uuid references public.gift_vouchers(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  payment_method_name text not null,
  category public.payment_category not null,
  amount_cents integer not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((session_id is not null) <> (voucher_id is not null)),
  check (applied_voucher_id is null or session_id is not null),
  check (
    (voucher_id is not null and category = 'voucher_purchase' and applied_voucher_id is null)
    or (session_id is not null and category <> 'voucher_purchase')
  )
);

create index sessions_scheduled_at_idx on public.sessions (scheduled_at);
create index sessions_client_id_idx on public.sessions (client_id);
create index session_stage_history_session_id_idx on public.session_stage_history (session_id, changed_at desc);
create index gift_vouchers_status_expires_at_idx on public.gift_vouchers (status, expires_at);
create index payments_session_id_idx on public.payments (session_id);
create index payments_voucher_id_idx on public.payments (voucher_id);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.snapshot_session_stage()
returns trigger
language plpgsql
as $$
begin
  select name into new.stage_name from public.session_stages where id = new.stage_id;
  return new;
end;
$$;

create function public.snapshot_payment_method()
returns trigger
language plpgsql
as $$
begin
  select name into new.payment_method_name from public.payment_methods where id = new.payment_method_id;
  return new;
end;
$$;

create function public.set_voucher_expiry()
returns trigger
language plpgsql
as $$
declare
  validity_months integer;
begin
  select voucher_validity_months into validity_months from public.app_settings where id = true;
  new.expires_at = new.purchased_at + make_interval(months => coalesce(validity_months, 12));
  return new;
end;
$$;

create function public.validate_payment_amount()
returns trigger
language plpgsql
as $$
declare
  amount_due_cents integer;
  amount_paid_cents integer;
begin
  if new.session_id is not null then
    select agreed_price_cents into amount_due_cents from public.sessions where id = new.session_id;
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

create function public.validate_voucher_redemption()
returns trigger
language plpgsql
as $$
declare
  voucher public.gift_vouchers;
  session_record public.sessions;
  voucher_method_code text;
begin
  select code into voucher_method_code from public.payment_methods where id = new.payment_method_id;

  if new.applied_voucher_id is null then
    if voucher_method_code = 'gift_voucher' then
      raise exception 'A gift voucher payment must reference an applied voucher.';
    end if;
    return new;
  end if;

  if voucher_method_code <> 'gift_voucher' then
    raise exception 'Only the gift_voucher payment method may apply a voucher.';
  end if;

  select * into voucher from public.gift_vouchers where id = new.applied_voucher_id for update;
  select * into session_record from public.sessions where id = new.session_id;

  if voucher.status <> 'active' or voucher.expires_at <= now() then
    raise exception 'The gift voucher is not active or has expired.';
  end if;

  if voucher.voucher_type = 'service' and voucher.service_type_id <> session_record.service_type_id then
    raise exception 'The service voucher is not valid for this session type.';
  end if;

  if new.amount_cents > session_record.agreed_price_cents then
    raise exception 'Voucher contribution cannot exceed the session price.';
  end if;

  update public.gift_vouchers
  set status = 'redeemed', redeemed_session_id = new.session_id, redeemed_at = new.paid_at
  where id = voucher.id;

  return new;
end;
$$;

create function public.record_session_stage_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.current_stage_id is distinct from old.current_stage_id then
    insert into public.session_stage_history (session_id, stage_id, stage_name)
    select new.id, id, name from public.session_stages where id = new.current_stage_id;
  end if;
  return new;
end;
$$;

create trigger app_settings_set_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger service_types_set_updated_at before update on public.service_types for each row execute function public.set_updated_at();
create trigger payment_methods_set_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger session_stages_set_updated_at before update on public.session_stages for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions for each row execute function public.set_updated_at();
create trigger gift_vouchers_set_updated_at before update on public.gift_vouchers for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger session_stage_history_snapshot before insert on public.session_stage_history for each row execute function public.snapshot_session_stage();
create trigger payments_snapshot_method before insert on public.payments for each row execute function public.snapshot_payment_method();
create trigger gift_vouchers_set_expiry before insert on public.gift_vouchers for each row execute function public.set_voucher_expiry();
create trigger payments_validate_amount before insert or update on public.payments for each row execute function public.validate_payment_amount();
create trigger payments_validate_voucher before insert on public.payments for each row execute function public.validate_voucher_redemption();
create trigger sessions_record_stage after insert or update of current_stage_id on public.sessions for each row execute function public.record_session_stage_change();

insert into public.app_settings (id) values (true);

insert into public.payment_methods (code, name, is_system, sort_order) values
  ('cash', 'Contanti', false, 10),
  ('paypal', 'PayPal', false, 20),
  ('wise', 'Wise', false, 30),
  ('gift_voucher', 'Buono regalo', true, 40);

insert into public.session_stages (code, name, sort_order) values
  ('booked', 'Prenotata', 10),
  ('completed', 'Sessione svolta', 20),
  ('payment_received', 'Pagamento ricevuto', 30),
  ('proofs_sent', 'Provini inviati', 40),
  ('selection_received', 'Selezione ricevuta', 50),
  ('delivered', 'Foto finali consegnate', 60),
  ('cancelled', 'Annullata', 70);

alter table public.app_settings enable row level security;
alter table public.clients enable row level security;
alter table public.service_types enable row level security;
alter table public.payment_methods enable row level security;
alter table public.session_stages enable row level security;
alter table public.sessions enable row level security;
alter table public.session_stage_history enable row level security;
alter table public.gift_vouchers enable row level security;
alter table public.payments enable row level security;