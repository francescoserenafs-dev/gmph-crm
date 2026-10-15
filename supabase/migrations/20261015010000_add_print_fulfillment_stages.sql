insert into public.session_stages (code, name, sort_order, is_active)
values
  ('awaiting_print_selection', 'In attesa scelta stampe', 70, true),
  ('print_selection_received', 'Scelta stampe ricevuta', 80, true),
  ('prints_completed', 'Stampe completate', 90, true)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

update public.session_stages
set sort_order = 100
where code = 'cancelled';