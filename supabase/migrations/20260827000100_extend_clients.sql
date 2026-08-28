alter table public.clients
  alter column email set not null,
  add column birth_date date,
  add column is_archived boolean not null default false,
  add column privacy_consent_granted_at timestamptz,
  add column privacy_consent_revoked_at timestamptz,
  add column image_consent_granted_at timestamptz,
  add column image_consent_revoked_at timestamptz,
  add constraint clients_privacy_consent_dates_check check (
    privacy_consent_revoked_at is null
    or (
      privacy_consent_granted_at is not null
      and privacy_consent_revoked_at >= privacy_consent_granted_at
    )
  ),
  add constraint clients_image_consent_dates_check check (
    image_consent_revoked_at is null
    or (
      image_consent_granted_at is not null
      and image_consent_revoked_at >= image_consent_granted_at
    )
  );

create unique index clients_email_unique_idx on public.clients (lower(email));
create index clients_active_name_idx on public.clients (last_name, first_name) where not is_archived;