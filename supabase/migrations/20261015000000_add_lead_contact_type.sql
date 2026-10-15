alter table public.leads
  add column contact_type text not null default 'new_contact'
  check (contact_type in ('new_contact', 'existing_client'));

alter table public.leads
  add constraint leads_existing_client_requires_client
  check (contact_type is distinct from 'existing_client' or client_id is not null);