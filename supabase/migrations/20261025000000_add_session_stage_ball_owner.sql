alter table public.session_stages
  add column ball_owner text not null default 'you'
  constraint session_stages_ball_owner_check
  check (ball_owner in ('you', 'client', 'none'));

update public.session_stages
set ball_owner = case code
  when 'proofs_sent' then 'client'
  when 'awaiting_print_selection' then 'client'
  when 'delivered' then 'none'
  when 'prints_completed' then 'none'
  when 'cancelled' then 'none'
  else 'you'
end;