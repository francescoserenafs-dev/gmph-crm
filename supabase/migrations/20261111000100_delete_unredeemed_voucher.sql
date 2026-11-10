create or replace function public.delete_unredeemed_voucher(p_voucher_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  target_voucher public.gift_vouchers%rowtype;
begin
  select * into target_voucher
  from public.gift_vouchers
  where id = p_voucher_id
  for update;

  if not found then
    return false;
  end if;

  if target_voucher.status = 'redeemed'
    or target_voucher.redeemed_session_id is not null
    or target_voucher.redeemed_at is not null
    or exists (select 1 from public.payments where applied_voucher_id = p_voucher_id)
  then
    raise exception 'Il buono e gia stato riscattato e non puo essere eliminato.';
  end if;

  delete from public.payments where voucher_id = p_voucher_id;
  delete from public.gift_vouchers where id = p_voucher_id;

  return true;
end;
$$;

revoke all on function public.delete_unredeemed_voucher(uuid) from public, anon, authenticated;
grant execute on function public.delete_unredeemed_voucher(uuid) to service_role;