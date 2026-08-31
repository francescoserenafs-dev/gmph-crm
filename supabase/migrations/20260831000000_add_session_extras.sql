alter table public.service_types add column is_addon boolean not null default false;

create table public.session_extras (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  service_name text not null,
  price_cents integer not null check (price_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger session_extras_set_updated_at before update on public.session_extras for each row execute function public.set_updated_at();
create trigger session_extras_audit after insert or update or delete on public.session_extras for each row execute function public.record_audit_log();

alter table public.session_extras enable row level security;

-- A session's total due now includes any extras attached to it, not just the agreed price.
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
    select coalesce(sum(price_cents), 0) into extras_cents from public.session_extras where session_id = new.session_id;
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
