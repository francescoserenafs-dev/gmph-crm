do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendly_event_type_map' and column_name = 'agreed_price_cents') then
    alter table public.calendly_event_type_map rename column agreed_price_cents to weekday_price_cents;
  elsif not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendly_event_type_map' and column_name = 'weekday_price_cents') then
    alter table public.calendly_event_type_map add column weekday_price_cents integer not null default 0 check (weekday_price_cents >= 0);
  end if;
end $$;

alter table public.calendly_event_type_map
  add column if not exists weekend_price_cents integer not null default 0 check (weekend_price_cents >= 0);
