-- Cognome facoltativo sul lead: "name" resta il Nome obbligatorio, i lead esistenti restano validi.
alter table public.leads
  add column last_name text check (last_name is null or char_length(btrim(last_name)) > 0);
