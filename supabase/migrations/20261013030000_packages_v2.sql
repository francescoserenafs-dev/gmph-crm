-- Pacchetti V2: prezzo e durata a catalogo, inclusioni strutturate e snapshot immutabile sulla sessione.

alter table public.session_packages
  add column price_cents integer check (price_cents >= 0),
  add column duration_minutes integer check (duration_minutes > 0);

create table public.session_package_inclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.session_packages(id) on delete cascade,
  extra_product_id uuid not null references public.extra_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, extra_product_id)
);

create index session_package_inclusions_package_idx on public.session_package_inclusions (package_id, sort_order);

create trigger session_package_inclusions_set_updated_at before update on public.session_package_inclusions for each row execute function public.set_updated_at();
create trigger session_package_inclusions_audit after insert or update or delete on public.session_package_inclusions for each row execute function public.record_audit_log();
alter table public.session_package_inclusions enable row level security;

alter table public.sessions
  add column package_name_snapshot text,
  add column package_price_cents_snapshot integer check (package_price_cents_snapshot >= 0),
  add column package_duration_minutes_snapshot integer check (package_duration_minutes_snapshot > 0),
  add column package_included_photos_snapshot integer check (package_included_photos_snapshot >= 0),
  add column package_description_snapshot text;

-- Unico backfill possibile per eventuali sessioni gia collegate: dati ATTUALI del catalogo, non quelli originari.
update public.sessions session
set package_name_snapshot = package.name,
    package_price_cents_snapshot = package.price_cents,
    package_duration_minutes_snapshot = package.duration_minutes,
    package_included_photos_snapshot = package.included_photos,
    package_description_snapshot = package.description
from public.session_packages package
where session.package_id = package.id and session.package_name_snapshot is null;

alter table public.sessions
  add constraint sessions_package_snapshot_consistent check ((package_id is null) = (package_name_snapshot is null));

-- Nessuna FK obbligatoria verso il catalogo: lo snapshot resta leggibile anche se catalogo o inclusioni cambiano.
create table public.session_package_inclusion_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  package_inclusion_id uuid references public.session_package_inclusions(id) on delete set null,
  extra_product_id uuid references public.extra_products(id) on delete set null,
  product_name_snapshot text not null,
  category_snapshot text check (category_snapshot in ('digital', 'print', 'album', 'other')),
  quantity integer not null check (quantity > 0),
  unit_cost_cents_snapshot integer check (unit_cost_cents_snapshot >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index session_package_inclusion_snapshots_session_idx on public.session_package_inclusion_snapshots (session_id, sort_order);

create trigger session_package_inclusion_snapshots_audit after insert or update or delete on public.session_package_inclusion_snapshots for each row execute function public.record_audit_log();
alter table public.session_package_inclusion_snapshots enable row level security;

-- Applica, sostituisce o rimuove (p_package_id null) il pacchetto di una sessione in un'unica transazione.
-- Prezzo, durata e foto vengono aggiornati solo se passati; rimuovendo il pacchetto restano invariati.
create function public.apply_session_package(
  p_session_id uuid,
  p_package_id uuid,
  p_agreed_price_cents integer default null,
  p_duration_minutes integer default null,
  p_included_photos integer default null
)
returns void
language plpgsql
as $$
declare
  session_record public.sessions;
  package_record public.session_packages;
begin
  select * into session_record from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found.';
  end if;

  delete from public.session_package_inclusion_snapshots where session_id = p_session_id;

  if p_package_id is null then
    update public.sessions
    set included_photos = coalesce(included_photos, package_included_photos_snapshot),
        package_id = null,
        package_name_snapshot = null,
        package_price_cents_snapshot = null,
        package_duration_minutes_snapshot = null,
        package_included_photos_snapshot = null,
        package_description_snapshot = null
    where id = p_session_id;
    return;
  end if;

  select * into package_record from public.session_packages where id = p_package_id;
  if not found then
    raise exception 'Package not found.';
  end if;
  if package_record.service_type_id <> session_record.service_type_id then
    raise exception 'The package does not belong to the session service.';
  end if;

  update public.sessions
  set package_id = package_record.id,
      package_name_snapshot = package_record.name,
      package_price_cents_snapshot = package_record.price_cents,
      package_duration_minutes_snapshot = package_record.duration_minutes,
      package_included_photos_snapshot = package_record.included_photos,
      package_description_snapshot = package_record.description,
      agreed_price_cents = coalesce(p_agreed_price_cents, agreed_price_cents),
      duration_minutes = coalesce(p_duration_minutes, duration_minutes),
      included_photos = coalesce(p_included_photos, included_photos)
  where id = p_session_id;

  insert into public.session_package_inclusion_snapshots
    (session_id, package_inclusion_id, extra_product_id, product_name_snapshot, category_snapshot, quantity, unit_cost_cents_snapshot, sort_order)
  select p_session_id, inclusion.id, product.id, product.name, product.category, inclusion.quantity, product.unit_cost_cents, inclusion.sort_order
  from public.session_package_inclusions inclusion
  join public.extra_products product on product.id = inclusion.extra_product_id
  where inclusion.package_id = package_record.id;
end;
$$;

revoke execute on function public.apply_session_package(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_session_package(uuid, uuid, integer, integer, integer) to service_role;
