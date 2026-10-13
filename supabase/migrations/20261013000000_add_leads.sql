-- Lead: richieste commerciali registrate prima della prenotazione.
-- Nessun importo proprio: il valore economico resta sulla sessione collegata.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  status text not null default 'to_handle' check (status in ('to_handle', 'info_sent', 'follow_up', 'booked', 'lost')),
  contact text not null check (char_length(btrim(contact)) > 0),
  source text not null check (source in ('instagram', 'meta_ads', 'google', 'referral', 'existing_client', 'other', 'unknown')),
  requested_period text,
  notes text,
  follow_up_at date,
  lost_reason text check (lost_reason in ('price', 'availability', 'no_response', 'chose_other_photographer', 'postponed', 'service_not_suitable', 'distance', 'other')),
  info_sent_at timestamptz,
  converted_at timestamptz,
  closed_at timestamptz,
  client_id uuid references public.clients(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_follow_up_requires_date check (status <> 'follow_up' or follow_up_at is not null),
  constraint leads_lost_requires_reason check (status <> 'lost' or lost_reason is not null),
  constraint leads_booked_requires_links check (status <> 'booked' or (client_id is not null and session_id is not null))
);

create index leads_status_idx on public.leads (status);
create index leads_service_type_idx on public.leads (service_type_id);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_follow_up_idx on public.leads (follow_up_at) where follow_up_at is not null;

create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger leads_audit after insert or update or delete on public.leads for each row execute function public.record_audit_log();

alter table public.leads enable row level security;
