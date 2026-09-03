alter table public.app_settings
  add column mailerlite_transactional_group_id text,
  add column mailerlite_marketing_group_id text,
  add column mailerlite_last_sync_at timestamptz;

alter table public.clients
  add column mailerlite_subscriber_id text,
  add column mailerlite_sync_status text not null default 'pending' check (mailerlite_sync_status in ('pending', 'synced', 'error')),
  add column mailerlite_synced_at timestamptz,
  add column mailerlite_last_error text;

create index clients_mailerlite_subscriber_id_idx on public.clients (mailerlite_subscriber_id);