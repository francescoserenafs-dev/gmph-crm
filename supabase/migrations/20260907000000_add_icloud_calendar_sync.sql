alter table public.sessions
  add column icloud_event_url text;

create unique index sessions_icloud_event_url_unique_idx on public.sessions (icloud_event_url) where icloud_event_url is not null;
