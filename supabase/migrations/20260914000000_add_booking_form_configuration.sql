-- Configurazione per evento dei campi mostrati nel form pubblico.

alter table public.booking_event_types
  add column form_fields jsonb not null default '{
    "firstName": {"enabled": true, "required": true},
    "lastName": {"enabled": true, "required": true},
    "email": {"enabled": true, "required": true},
    "phone": {"enabled": false, "required": false},
    "birthDate": {"enabled": false, "required": false},
    "participantsCount": {"enabled": false, "required": false},
    "notes": {"enabled": false, "required": false}
  }'::jsonb;

alter table public.sessions
  add column participants_count integer check (participants_count > 0);