-- Payments can now be recorded without requiring a specific time.
-- Add paid_date as DATE (date only) and make paid_at nullable.
alter table public.payments
  add column paid_date date,
  alter column paid_at drop not null;

-- If paid_at was set (by default now()), derive paid_date from it
update public.payments
set paid_date = paid_at::date
where paid_at is not null;

-- Add constraint: at least one of paid_at or paid_date must be provided
alter table public.payments
  add constraint payments_paid_date_or_time_check check (
    paid_date is not null or paid_at is not null
  );
