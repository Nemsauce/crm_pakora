-- Run manually in the Supabase SQL Editor after deploying the sync changes.
-- This migration does not alter the v3 scoring body. It preserves that function
-- as the scored base and exposes the original RPC name through a thin wrapper
-- that adds dropkiller_uuid from the exact snapshot selected by the base RPC.

begin;

do $migration$
declare
  current_function regprocedure :=
    to_regprocedure('public.dropkiller_sweet_spot_candidates()');
  scored_function regprocedure :=
    to_regprocedure('public.dropkiller_sweet_spot_candidates_scored_v3()');
  base_result text;
  wrapper_result text;
begin
  if current_function is null and scored_function is null then
    raise exception 'dropkiller_sweet_spot_candidates() does not exist';
  end if;

  if current_function is not null
    and position(
      'dropkiller_uuid' in pg_get_function_result(current_function)
    ) > 0
  then
    raise notice 'dropkiller_sweet_spot_candidates() already returns dropkiller_uuid';
    return;
  end if;

  if scored_function is null then
    base_result := pg_get_function_result(current_function);

    alter function public.dropkiller_sweet_spot_candidates()
      rename to dropkiller_sweet_spot_candidates_scored_v3;
  else
    base_result := pg_get_function_result(scored_function);

    if current_function is not null then
      drop function public.dropkiller_sweet_spot_candidates();
    end if;
  end if;

  wrapper_result := regexp_replace(
    base_result,
    '\)$',
    ', dropkiller_uuid text)'
  );

  if wrapper_result = base_result then
    raise exception 'Could not extend the RPC return signature';
  end if;

  execute format(
    $create_function$
      create function public.dropkiller_sweet_spot_candidates()
      returns %s
      language sql
      stable
      security invoker
      set search_path = ''
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

comment on function public.dropkiller_sweet_spot_candidates() is
  'v3 scoring preserved; adds dropkiller_uuid from the selected latest snapshot.';

grant execute on function public.dropkiller_sweet_spot_candidates()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
