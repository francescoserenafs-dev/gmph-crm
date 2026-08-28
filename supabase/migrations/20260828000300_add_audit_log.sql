create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_fields jsonb,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);

create function public.record_audit_log()
returns trigger
language plpgsql
as $$
declare
  ignored_keys text[] := array['updated_at', 'created_at'];
  changed jsonb := '{}'::jsonb;
  key text;
begin
  if tg_op = 'UPDATE' then
    for key in select jsonb_object_keys(to_jsonb(new)) loop
      if key = any(ignored_keys) then continue; end if;
      if to_jsonb(new)->key is distinct from to_jsonb(old)->key then
        changed := changed || jsonb_build_object(key, jsonb_build_object('from', to_jsonb(old)->key, 'to', to_jsonb(new)->key));
      end if;
    end loop;
    if changed = '{}'::jsonb then return new; end if;
    insert into public.audit_log (table_name, record_id, action, changed_fields, old_data, new_data)
    values (tg_table_name, new.id, 'update', changed, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, new_data)
    values (tg_table_name, new.id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_data)
    values (tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create trigger clients_audit after insert or update or delete on public.clients for each row execute function public.record_audit_log();
create trigger sessions_audit after insert or update or delete on public.sessions for each row execute function public.record_audit_log();
create trigger gift_vouchers_audit after insert or update or delete on public.gift_vouchers for each row execute function public.record_audit_log();
create trigger payments_audit after insert or update or delete on public.payments for each row execute function public.record_audit_log();
