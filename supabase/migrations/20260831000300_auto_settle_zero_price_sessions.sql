-- Sessions with agreed_price_cents = 0 are automatically settled (no payment required).
-- Add is_settled column and auto-settle sessions with zero price.
alter table public.sessions
  add column is_settled boolean not null default false;

-- Auto-settle any existing sessions with price 0
update public.sessions
set is_settled = true
where agreed_price_cents = 0;

-- Add trigger to auto-settle new sessions with price 0
create or replace function public.auto_settle_zero_price_sessions()
returns trigger
language plpgsql
as $$
begin
  if new.agreed_price_cents = 0 then
    new.is_settled := true;
  end if;
  return new;
end;
$$;

create trigger sessions_auto_settle_zero_price
before insert or update of agreed_price_cents
on public.sessions
for each row
execute function public.auto_settle_zero_price_sessions();
