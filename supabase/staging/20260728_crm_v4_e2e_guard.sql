-- Staging-only infrastructure for CRM Pakora v4 E2E.
--
-- NEVER apply this file to production. It is intentionally kept outside
-- supabase/migrations so normal migration workflows cannot promote it.

begin;

set local search_path = public, pg_catalog;

create table if not exists public.e2e_environment_guard (
  id text primary key,
  project_ref text default 'qmpcthkbrckjeedbxgkw'::text not null,
  environment_name text default 'CRM staging'::text not null,
  contract_version text default 'crm-pakora-v4-g0-v1'::text not null,
  fixture_version text,
  fixture_operational_date date,
  fixture_digest text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint e2e_environment_guard_project_ref_check
    check (project_ref = 'qmpcthkbrckjeedbxgkw'),
  constraint e2e_environment_guard_environment_check
    check (environment_name = 'CRM staging'),
  constraint e2e_environment_guard_contract_check
    check (contract_version = 'crm-pakora-v4-g0-v1')
);

do $guard_shape$
declare
  actual_columns text[];
begin
  select array_agg(a.attname order by a.attnum)
  into actual_columns
  from pg_attribute a
  where a.attrelid = 'public.e2e_environment_guard'::regclass
    and a.attnum > 0
    and not a.attisdropped;

  if actual_columns is distinct from array[
    'id',
    'project_ref',
    'environment_name',
    'contract_version',
    'fixture_version',
    'fixture_operational_date',
    'fixture_digest',
    'created_at',
    'updated_at'
  ]::text[] then
    raise exception 'Unexpected e2e_environment_guard shape: %', actual_columns;
  end if;
end
$guard_shape$;

alter table public.e2e_environment_guard enable row level security;
alter table public.e2e_environment_guard force row level security;

revoke all privileges on table public.e2e_environment_guard from public;
revoke all privileges on table public.e2e_environment_guard from anon;
revoke all privileges on table public.e2e_environment_guard from authenticated;
revoke all privileges on table public.e2e_environment_guard from service_role;
grant select, insert, update on table public.e2e_environment_guard to service_role;

insert into public.e2e_environment_guard (
  id,
  project_ref,
  environment_name,
  contract_version
)
values (
  'crm_v4_e2e',
  'qmpcthkbrckjeedbxgkw',
  'CRM staging',
  'crm-pakora-v4-g0-v1'
)
on conflict (id) do update
set
  project_ref = excluded.project_ref,
  environment_name = excluded.environment_name,
  contract_version = excluded.contract_version,
  updated_at = now();

comment on table public.e2e_environment_guard is
  'Staging-only identity marker for fail-closed CRM v4 E2E runs. Never create in production.';

commit;
