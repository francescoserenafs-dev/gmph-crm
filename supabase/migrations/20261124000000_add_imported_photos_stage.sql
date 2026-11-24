insert into public.session_stages (code, name, sort_order, is_active, ball_owner)
values ('photos_imported', 'Foto importate', 30, true, 'you')
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    ball_owner = excluded.ball_owner;