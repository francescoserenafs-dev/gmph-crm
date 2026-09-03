alter table public.payments
  add column if not exists voucher_overage_confirmed boolean not null default false;

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

  if not (new.applied_voucher_id is not null and new.voucher_overage_confirmed)
    and amount_paid_cents + new.amount_cents > amount_due_cents then
    raise exception 'Payment exceeds the remaining amount due.';
  end if;

  return new;
end;
$$;