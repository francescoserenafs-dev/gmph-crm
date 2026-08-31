-- Image-usage consent moves from the client record to each individual session.
alter table public.sessions
  add column image_consent_granted_at timestamptz,
  add column image_consent_revoked_at timestamptz,
  add constraint sessions_image_consent_dates_check check (
    image_consent_revoked_at is null
    or (
      image_consent_granted_at is not null
      and image_consent_revoked_at >= image_consent_granted_at
    )
  );

-- Remove consent fields from clients table
alter table public.clients
  drop column if exists image_consent_granted_at,
  drop column if exists image_consent_revoked_at;
