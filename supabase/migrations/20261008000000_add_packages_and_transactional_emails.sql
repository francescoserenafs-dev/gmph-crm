-- Pacchetti per tipo di servizio (N pacchetti : 1 servizio), dati di consegna sulla sessione,
-- modelli email modificabili e registro delle email transazionali inviate.
-- non ancora caricata (credo)

create table public.session_packages (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  included_photos integer not null default 0 check (included_photos >= 0),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_type_id, name)
);

create index session_packages_service_idx on public.session_packages (service_type_id, sort_order);

create trigger session_packages_set_updated_at before update on public.session_packages for each row execute function public.set_updated_at();
create trigger session_packages_audit after insert or update or delete on public.session_packages for each row execute function public.record_audit_log();

alter table public.session_packages enable row level security;

-- included_photos null = usa il default del pacchetto.
alter table public.sessions
  add column package_id uuid references public.session_packages(id) on delete restrict,
  add column included_photos integer check (included_photos >= 0),
  add column proofs_gallery_url text check (proofs_gallery_url is null or proofs_gallery_url ~ '^https://');

create index sessions_package_idx on public.sessions (package_id) where package_id is not null;

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  subject text not null check (char_length(subject) between 1 and 200),
  body_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_templates_set_updated_at before update on public.email_templates for each row execute function public.set_updated_at();
create trigger email_templates_audit after insert or update or delete on public.email_templates for each row execute function public.record_audit_log();

alter table public.email_templates enable row level security;

insert into public.email_templates (code, name, subject, body_html) values (
  'proofs',
  'Invio provini',
  'I tuoi provini sono pronti, {{nome}}!',
  '<p>Ciao {{nome}},</p>'
  || '<p>i provini della tua sessione <strong>{{servizio}}</strong> del {{data_sessione}} sono pronti!</p>'
  || '<p>{{link_gallery}}</p>'
  || '<p>Il tuo pacchetto <strong>{{pacchetto}}</strong> comprende <strong>{{foto_incluse}} foto</strong>: scegli le tue preferite direttamente nella gallery e io mi occupero della post-produzione.</p>'
  || '<p>{{contenuto_pacchetto}}</p>'
  || '{{extra}}'
  || '<p>Se hai domande, rispondi pure a questa email.</p>'
  || '<p>Un abbraccio,<br>Giulia</p>'
);

create table public.session_emails (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  template_code text not null,
  to_email text not null,
  subject text not null,
  body_html text not null,
  provider_message_id text,
  sent_at timestamptz not null default now()
);

create index session_emails_session_idx on public.session_emails (session_id, sent_at desc);

alter table public.session_emails enable row level security;
