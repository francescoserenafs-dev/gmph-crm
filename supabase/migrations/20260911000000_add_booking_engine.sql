-- Booking engine: tipi di evento prenotabili pubblicamente, regole di disponibilita' ed eccezioni.

create table public.booking_event_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_minutes integer not null default 30 check (buffer_minutes >= 0),
  location text,
  weekday_price_cents integer not null default 0 check (weekday_price_cents >= 0),
  weekend_price_cents integer not null default 0 check (weekend_price_cents >= 0),
  show_price boolean not null default true,
  window_start_date date not null,
  window_end_date date not null,
  min_notice_hours integer not null default 24 check (min_notice_hours >= 0),
  max_bookings_per_day integer check (max_bookings_per_day > 0),
  max_bookings_total integer check (max_bookings_total > 0),
  ask_image_consent boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_event_types_window_valid check (window_end_date >= window_start_date)
);

create index booking_event_types_active_idx on public.booking_event_types (is_active, window_start_date);

-- weekday segue la convenzione JS: 0 = domenica ... 6 = sabato
create table public.booking_availability_rules (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_availability_rules_range_valid check (end_time > start_time),
  constraint booking_availability_rules_unique unique (event_type_id, weekday, start_time, end_time)
);

create index booking_availability_rules_event_idx on public.booking_availability_rules (event_type_id, weekday);

-- Eccezione su una data specifica: chiude la giornata oppure ne ridefinisce completamente le fasce.
create table public.booking_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,
  exception_date date not null,
  is_closed boolean not null default false,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_availability_exceptions_shape check (
    (is_closed and start_time is null and end_time is null)
    or (not is_closed and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index booking_availability_exceptions_event_idx on public.booking_availability_exceptions (event_type_id, exception_date);
create unique index booking_availability_exceptions_closed_idx
  on public.booking_availability_exceptions (event_type_id, exception_date)
  where is_closed;

alter table public.sessions
  add column booking_event_type_id uuid references public.booking_event_types(id) on delete set null,
  add column booked_online_at timestamptz;

create index sessions_booking_event_type_idx on public.sessions (booking_event_type_id, scheduled_at);

create trigger booking_event_types_set_updated_at before update on public.booking_event_types for each row execute function public.set_updated_at();
create trigger booking_availability_rules_set_updated_at before update on public.booking_availability_rules for each row execute function public.set_updated_at();
create trigger booking_availability_exceptions_set_updated_at before update on public.booking_availability_exceptions for each row execute function public.set_updated_at();

create trigger booking_event_types_audit after insert or update or delete on public.booking_event_types for each row execute function public.record_audit_log();

alter table public.booking_event_types enable row level security;
alter table public.booking_availability_rules enable row level security;
alter table public.booking_availability_exceptions enable row level security;
