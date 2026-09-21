alter table public.payments
  add column voucher_unused_cents integer not null default 0 check (voucher_unused_cents >= 0);

-- Normalize previous voucher redemptions that were recorded above the session balance.
with voucher_payment_context as (
  select
    payment.id,
    payment.amount_cents,
    greatest(
      session.agreed_price_cents
        + coalesce((select sum(extra.price_cents) from public.session_extras extra where extra.session_id = session.id), 0)
        - coalesce((select sum(other.amount_cents) from public.payments other where other.session_id = session.id and other.id <> payment.id), 0),
      0
    ) as remaining_before_voucher_cents
  from public.payments payment
  join public.sessions session on session.id = payment.session_id
  where payment.applied_voucher_id is not null
)
update public.payments payment
set
  amount_cents = context.remaining_before_voucher_cents,
  voucher_unused_cents = context.amount_cents - context.remaining_before_voucher_cents
from voucher_payment_context context
where payment.id = context.id
  and context.remaining_before_voucher_cents > 0
  and context.amount_cents > context.remaining_before_voucher_cents;

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
  select session_record.agreed_price_cents + coalesce(sum(price_cents), 0)
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