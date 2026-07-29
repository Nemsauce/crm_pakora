-- Canonical, data-free catalog fingerprint used to compare CRM production and
-- staging. The E2E marker table is excluded because it is staging-only.

with catalog_items as (
  select
    'tables'::text as category,
    c.relname as object_name,
    concat_ws(
      '|',
      c.relkind,
      c.relpersistence,
      c.relrowsecurity,
      c.relforcerowsecurity,
      c.relreplident,
      pg_get_userbyid(c.relowner),
      coalesce(c.relacl::text, '')
    ) as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname <> 'e2e_environment_guard'

  union all

  select
    'columns',
    c.relname || '.' || lpad(a.attnum::text, 4, '0') || '.' || a.attname,
    concat_ws(
      '|',
      a.attname,
      format_type(a.atttypid, a.atttypmod),
      a.attnotnull,
      a.attidentity,
      a.attgenerated,
      coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
      a.attcollation
    )
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname <> 'e2e_environment_guard'
    and a.attnum > 0
    and not a.attisdropped

  union all

  select
    'enums',
    t.typname || '.' || lpad(e.enumsortorder::text, 4, '0'),
    e.enumlabel
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'

  union all

  select
    'constraints',
    c.relname || '.' || con.conname,
    concat_ws(
      '|',
      con.contype,
      pg_get_constraintdef(con.oid, true),
      con.condeferrable,
      con.condeferred,
      con.convalidated
    )
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname <> 'e2e_environment_guard'

  union all

  select
    'functions',
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    concat_ws(
      '|',
      pg_get_functiondef(p.oid),
      p.prosecdef,
      p.provolatile,
      p.proparallel,
      coalesce(p.proconfig::text, ''),
      pg_get_userbyid(p.proowner),
      coalesce(p.proacl::text, '')
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'

  union all

  select
    'indexes',
    c.relname || '.' || i.relname,
    pg_get_indexdef(ix.indexrelid)
  from pg_index ix
  join pg_class c on c.oid = ix.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_class i on i.oid = ix.indexrelid
  left join pg_constraint con on con.conindid = ix.indexrelid
  where n.nspname = 'public'
    and c.relname <> 'e2e_environment_guard'
    and con.oid is null

  union all

  select
    'triggers',
    n.nspname || '.' || c.relname || '.' || t.tgname,
    pg_get_triggerdef(t.oid, true)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))

  union all

  select
    'policies',
    tablename || '.' || policyname,
    concat_ws('|', permissive, roles::text, cmd, coalesce(qual, ''), coalesce(with_check, ''))
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'e2e_environment_guard'

  union all

  select
    'publication',
    pubname || '.' || tablename,
    schemaname
  from pg_publication_tables
  where schemaname = 'public'
    and tablename <> 'e2e_environment_guard'
)
select
  category,
  count(*) as object_count,
  md5(
    string_agg(
      object_name || E'\n' || definition,
      E'\n--\n'
      order by object_name
    )
  ) as digest
from catalog_items
group by category
order by category;
