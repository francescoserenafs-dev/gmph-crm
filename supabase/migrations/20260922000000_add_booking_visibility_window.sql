-- Finestra indipendente per la pubblicazione della pagina di prenotazione.
alter table public.booking_event_types
  add column visibility_start_date date,
  add column visibility_end_date date;

update public.booking_event_types
set visibility_start_date = window_start_date,
    visibility_end_date = window_end_date
where visibility_start_date is null
   or visibility_end_date is null;

alter table public.booking_event_types
  alter column visibility_start_date set not null,
  alter column visibility_end_date set not null,
  add constraint booking_event_types_visibility_window_valid
    check (visibility_end_date >= visibility_start_date);

create index booking_event_types_visibility_idx
  on public.booking_event_types (is_active, visibility_start_date, visibility_end_date);