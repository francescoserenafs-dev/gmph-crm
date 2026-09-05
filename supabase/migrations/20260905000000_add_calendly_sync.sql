alter table public.app_settings
  add column calendly_last_sync_at timestamptz;

alter table public.sessions
  add column calendly_event_uri text;

create unique index sessions_calendly_event_uri_unique_idx on public.sessions (calendly_event_uri) where calendly_event_uri is not null;

create table public.calendly_event_type_map (
  id uuid primary key default gen_random_uuid(),
  calendly_event_type_uri text not null unique,
  calendly_event_type_name text not null,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger calendly_event_type_map_set_updated_at before update on public.calendly_event_type_map for each row execute function public.set_updated_at();

alter table public.calendly_event_type_map enable row level security;
