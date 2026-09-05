alter table public.calendly_event_type_map
  add column agreed_price_cents integer not null default 0 check (agreed_price_cents >= 0);
