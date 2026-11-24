with ordered_stages as (
  select id, code, row_number() over (order by sort_order, code) as current_position
  from public.session_stages
  where code <> 'photos_imported'
), positioned_stages as (
  select id, current_position::numeric as position_key
  from ordered_stages
  union all
  select imported.id, completed.current_position + 0.5
  from public.session_stages imported
  cross join ordered_stages completed
  where imported.code = 'photos_imported'
    and completed.code = 'completed'
), renumbered_stages as (
  select id, row_number() over (order by position_key)::integer as sort_order
  from positioned_stages
)
update public.session_stages stage
set sort_order = renumbered_stages.sort_order
from renumbered_stages
where stage.id = renumbered_stages.id;