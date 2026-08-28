alter table public.app_settings
  add column annual_budget_cents integer not null default 0 check (annual_budget_cents >= 0);
