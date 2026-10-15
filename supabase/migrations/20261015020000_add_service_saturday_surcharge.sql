alter table public.service_types
  add column saturday_surcharge_cents integer not null default 0
  check (saturday_surcharge_cents >= 0);

update public.service_types
set saturday_surcharge_cents = case name
  when 'Famiglia' then 1500
  when 'Maternità' then 1500
  when 'Ritratto' then 1500
  when 'Mini Sessione Autunno' then 1500
  when 'Mini Sessione Natale' then 2500
  else 0
end;