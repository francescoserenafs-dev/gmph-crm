alter type public.payment_category add value if not exists 'voucher_redemption';

create or replace function public.validate_voucher_redemption()
returns trigger
language plpgsql
as $$
declare
  voucher public.gift_vouchers;
  session_record public.sessions;
  voucher_method_code text;
  existing_payment_count integer;
begin
  select code into voucher_method_code from public.payment_methods where id = new.payment_method_id;

  if new.applied_voucher_id is null then
    if voucher_method_code = 'gift_voucher' then
      raise exception 'A gift voucher payment must reference an applied voucher.';
    end if;
    return new;
  end if;

  if voucher_method_code <> 'gift_voucher' or new.category <> 'voucher_redemption' then
    raise exception 'A redeemed voucher requires the gift_voucher method and voucher_redemption category.';
  end if;

  select * into voucher from public.gift_vouchers where id = new.applied_voucher_id for update;
  select * into session_record from public.sessions where id = new.session_id;
  select count(*) into existing_payment_count from public.payments where session_id = new.session_id;

  if voucher.status <> 'active' or voucher.expires_at <= now() then
    raise exception 'The gift voucher is not active or has expired.';
  end if;

  if voucher.voucher_type = 'service' then
    if voucher.service_type_id <> session_record.service_type_id then
      raise exception 'The service voucher is not valid for this session type.';
    end if;
    if existing_payment_count > 0 or new.amount_cents <> session_record.agreed_price_cents then
      raise exception 'A service voucher must fully pay a session with no existing payments.';
    end if;
  elsif new.amount_cents <> voucher.value_cents then
    raise exception 'A value voucher must be used in full.';
  end if;

  update public.gift_vouchers
  set status = 'redeemed', redeemed_session_id = new.session_id, redeemed_at = new.paid_at
  where id = voucher.id;

  return new;
end;
$$;

create function public.reactivate_deleted_voucher_payment()
returns trigger
language plpgsql
as $$
begin
  if old.applied_voucher_id is not null then
    update public.gift_vouchers
    set status = 'active', redeemed_session_id = null, redeemed_at = null
    where id = old.applied_voucher_id;
  end if;
  return old;
end;
$$;

create trigger payments_reactivate_voucher_after_delete
after delete on public.payments
for each row
execute function public.reactivate_deleted_voucher_payment();