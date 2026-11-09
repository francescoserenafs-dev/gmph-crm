-- I riferimenti storici restano come identificatori non risolti: non aggiornare righe o audit delle sessioni.
alter table public.session_extras
  drop constraint if exists session_extras_extra_product_id_fkey;

alter table public.session_package_inclusion_snapshots
  drop constraint if exists session_package_inclusion_snapshots_package_inclusion_id_fkey,
  drop constraint if exists session_package_inclusion_snapshots_extra_product_id_fkey;

-- Un prodotto rimosso non deve restare nelle configurazioni dei pacchetti futuri.
alter table public.session_package_inclusions
  drop constraint if exists session_package_inclusions_extra_product_id_fkey,
  add constraint session_package_inclusions_extra_product_id_fkey
    foreign key (extra_product_id) references public.extra_products(id) on delete cascade;