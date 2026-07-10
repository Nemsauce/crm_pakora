-- Run manually in the Supabase SQL Editor.
-- Replaces only the public wrapper; the scored v3 base remains untouched.

begin;

do $migration$
declare
  wrapper_function regprocedure :=
    to_regprocedure('public.dropkiller_sweet_spot_candidates()');
  wrapper_result text;
begin
  if wrapper_function is null then
    raise exception 'dropkiller_sweet_spot_candidates() does not exist';
  end if;

  wrapper_result := pg_get_function_result(wrapper_function);

  if position('dropkiller_uuid' in wrapper_result) = 0 then
    raise exception 'dropkiller_sweet_spot_candidates() does not return dropkiller_uuid';
  end if;

  execute format(
    $create_function$
      create or replace function public.dropkiller_sweet_spot_candidates()
      returns %s
      language sql
      stable
      security invoker
      as $wrapper$
        select
          candidates.*,
          snapshot.dropkiller_uuid
        from public.dropkiller_sweet_spot_candidates_scored_v3() as candidates
        left join public.dropkiller_products_daily as snapshot
          on snapshot.external_id = candidates.external_id
          and snapshot.captured_at = candidates.captured_at
      $wrapper$
    $create_function$,
    wrapper_result
  );
end
$migration$;

alter function public.dropkiller_sweet_spot_candidates()
  reset search_path;

comment on function public.dropkiller_sweet_spot_candidates() is
  'v3 scoring preserved; adds dropkiller_uuid from the selected latest snapshot.';

grant execute on function public.dropkiller_sweet_spot_candidates()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- Verification: this must return rows without a relation-does-not-exist error.
select *
from public.dropkiller_sweet_spot_candidates()
limit 5;
