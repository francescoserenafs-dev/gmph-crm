-- Buoni: scadenza modificabile in creazione e flag omaggio (buono emesso senza pagamento).

alter table public.gift_vouchers add column is_complimentary boolean not null default false;

-- La validita globale resta il default, ma solo se la scadenza non e stata indicata esplicitamente.
create or replace function public.set_voucher_expiry()
returns trigger
language plpgsql
as $$
declare
  validity_months integer;
begin
  if new.expires_at is not null then
    return new;
  end if;
  select voucher_validity_months into validity_months from public.app_settings where id = true;
  new.expires_at = new.purchased_at + make_interval(months => coalesce(validity_months, 12));
  return new;
end;
$$;
