-- CRM Pakora public schema baseline.
--
-- Provenance: generated from read-only pg_catalog / information_schema queries
-- against production project nauqpgsspwfqkxidenkx on 2026-07-28.
-- This file contains schema only. It intentionally contains no production rows.
-- Apply only to the empty, explicitly verified CRM staging project.

begin;

set local search_path = public, extensions, pg_catalog;
set local check_function_bodies = off;

do $preflight$
declare
  unexpected_object text;
begin
  select format('%s %I.%I',
    case c.relkind when 'r' then 'table' when 'p' then 'partitioned table' else 'relation' end,
    n.nspname,
    c.relname
  )
  into unexpected_object
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname = any (array[
      'abandonados',
      'asistente_whatsapp_config',
      'comentarios',
      'costeos',
      'dropi_sessions',
      'dropkiller_config',
      'dropkiller_products_daily',
      'dropkiller_saved_products',
      'notifications',
      'orders',
      'profiles',
      'push_subscriptions',
      'shopify_webhook_events',
      'status_catalog',
      'status_history',
      'task_handling_events',
      'tasks',
      'wallet_movement_catalog',
      'wallet_movements',
      'whatsapp_mensajes_entrantes',
      'whatsapp_mensajes_salientes'
    ])
  order by c.relname
  limit 1;

  if unexpected_object is not null then
    raise exception 'CRM schema baseline requires an empty target; found %', unexpected_object;
  end if;

  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = any (array[
        'categoria_estado_enum',
        'estado_abandonado_enum',
        'estado_crm_enum',
        'estado_tarea_enum',
        'notificacion_tipo_enum',
        'pais_enum',
        'role_enum',
        'tipo_movimiento_wallet_enum',
        'tipo_tarea_enum'
      ])
  ) then
    raise exception 'CRM schema baseline requires an empty target; a CRM enum already exists';
  end if;
end
$preflight$;

create type public.categoria_estado_enum as enum (
  'nuevo',
  'confirmado',
  'guia_generada',
  'en_ruta',
  'novedad',
  'proximo_a_llegar',
  'entregado',
  'cancelado',
  'devolucion',
  'sin_clasificar',
  'en_reparto',
  'recoger_oficina',
  'intento_fallido'
);

create type public.estado_abandonado_enum as enum (
  'nuevo',
  'contactado',
  'recuperado',
  'descartado'
);

create type public.estado_crm_enum as enum (
  'nuevo',
  'en_ruta',
  'entregado',
  'cancelado',
  'devolucion'
);

create type public.estado_tarea_enum as enum (
  'pendiente',
  'en_progreso',
  'completada',
  'cancelada'
);

create type public.notificacion_tipo_enum as enum (
  'tarea_urgente_asignada',
  'tarea_vencida',
  'pedido_nuevo',
  'novedad',
  'pedido_entregado',
  'pedido_devolucion',
  'pedido_en_reparto'
);

create type public.pais_enum as enum ('CO', 'MX');
create type public.role_enum as enum ('admin');

create type public.tipo_movimiento_wallet_enum as enum (
  'ganancia',
  'costo_flete',
  'devolucion_flete',
  'indemnizacion',
  'comision_referido',
  'retiro',
  'recarga',
  'correccion',
  'fulfillment',
  'software',
  'otro'
);

create type public.tipo_tarea_enum as enum (
  'llamar_confirmacion',
  'notificar_guia',
  'presionar_entrega',
  'notificar_proximo_llegar',
  'resolver_novedad'
);

create table public.abandonados (
  id bigint generated always as identity not null,
  pais public.pais_enum not null,
  codigo_externo text not null,
  nombre text,
  apellido text,
  telefono text,
  direccion text,
  ciudad text,
  departamento text,
  nombre_producto text,
  precio numeric(12,2),
  fecha_abandono date,
  estado public.estado_abandonado_enum default 'nuevo'::public.estado_abandonado_enum not null,
  sincronizado_en timestamp with time zone default now() not null
);

create table public.asistente_whatsapp_config (
  id bigint generated always as identity not null,
  reglas text default ''::text not null,
  updated_at timestamp with time zone default now() not null,
  updated_por text
);

create table public.comentarios (
  id bigint generated always as identity not null,
  order_id bigint not null,
  comentario text not null,
  origen text default 'sheet'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.costeos (
  id bigint generated always as identity not null,
  pais public.pais_enum not null,
  nombre_producto text not null,
  precio_proveedor numeric(12,2) default 0 not null,
  flete_base numeric(12,2) default 0 not null,
  tasa_efectividad numeric(5,4) default 0.75 not null,
  costos_administrativos numeric(12,2) default 0 not null,
  fullfilment numeric(12,2) default 0 not null,
  cpa_ads numeric(12,2) default 0 not null,
  cpa_manual boolean default false not null,
  tasa_cancelacion numeric(5,4) default 0 not null,
  precio_venta numeric(12,2) default 0 not null,
  importe_gastado numeric(12,2),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid,
  precio_comparacion numeric(12,2),
  cpa_porcentaje_objetivo numeric(5,2) default 20 not null
);

create table public.dropi_sessions (
  pais text not null,
  token text not null,
  expires_at timestamp with time zone not null,
  updated_at timestamp with time zone default now() not null
);

create table public.dropkiller_config (
  id bigint generated always as identity not null,
  platform text not null,
  country_code text not null,
  activo boolean default true not null
);

create table public.dropkiller_products_daily (
  id bigint generated always as identity not null,
  external_id text not null,
  platform text not null,
  country_code text not null,
  nombre_producto text not null,
  sale_price numeric(12,2),
  suggested_price numeric(12,2),
  stock integer,
  total_sold_units integer,
  sold_units_last_7_days integer,
  sold_units_last_30_days integer,
  history_30d jsonb,
  captured_at date default current_date not null,
  created_at timestamp with time zone default now() not null,
  dropkiller_uuid text,
  providers_count integer,
  primary_image_url text
);

create table public.dropkiller_saved_products (
  id bigint generated always as identity not null,
  external_id text not null,
  dropkiller_uuid text,
  country_code text not null,
  nombre_producto text not null,
  sale_price numeric(12,2),
  primary_image_url text,
  sold_units_last_7_days integer,
  sold_units_last_30_days integer,
  total_sold_units integer,
  providers_count integer,
  notas text,
  saved_by uuid,
  saved_at timestamp with time zone default now() not null
);

create table public.notifications (
  id bigint generated always as identity not null,
  user_id uuid not null,
  tipo public.notificacion_tipo_enum not null,
  titulo text not null,
  mensaje text,
  order_id bigint,
  task_id bigint,
  leida boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.orders (
  id bigint generated always as identity not null,
  pais public.pais_enum not null,
  id_orden_shopify text,
  numero_orden text,
  fecha date,
  nombre text,
  apellido text,
  telefono text,
  direccion text,
  barrio_referencia text,
  ciudad text,
  departamento text,
  nombre_producto text,
  cantidad integer default 1,
  precio numeric(12,2),
  total numeric(12,2),
  notas_pedido text,
  id_orden_dropi bigint,
  estado_dropi text,
  guia_envio text,
  transportadora text,
  fecha_entrega_real timestamp with time zone,
  estado_crm public.estado_crm_enum default 'nuevo'::public.estado_crm_enum not null,
  activo boolean default true not null,
  nivel_riesgo text,
  total_pedidos_cliente integer default 0,
  pedidos_entregados_cliente integer default 0,
  pedidos_devueltos_cliente integer default 0,
  costo_producto numeric(12,2) default 0,
  costo_envio numeric(12,2) default 0,
  comision_cod numeric(12,2) default 0,
  valor_liquidado numeric(12,2),
  fecha_liquidacion timestamp with time zone,
  estado_liquidacion text,
  costo_devolucion numeric(12,2),
  ganancia_esperada numeric(12,2),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  tarea_generada_para_estado text,
  monto_a_ganar numeric(12,2),
  codigo_postal text,
  colonia text,
  numero_interior text
);

create table public.profiles (
  id uuid not null,
  email text not null,
  nombre text,
  role public.role_enum default 'admin'::public.role_enum not null,
  activo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  telegram_chat_id text,
  titulo text
);

create table public.push_subscriptions (
  id bigint generated always as identity not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now() not null,
  last_used_at timestamp with time zone
);

create table public.shopify_webhook_events (
  webhook_id text not null,
  received_at timestamp with time zone default now() not null
);

create table public.status_catalog (
  id bigint generated always as identity not null,
  estado text not null,
  transportadora text,
  categoria public.categoria_estado_enum default 'sin_clasificar'::public.categoria_estado_enum not null,
  activo boolean default true not null,
  notas text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.status_history (
  id bigint generated always as identity not null,
  order_id bigint not null,
  estado text not null,
  categoria public.categoria_estado_enum,
  transportadora text,
  novedad text,
  notas text,
  registrado_en timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

create table public.task_handling_events (
  id bigint generated always as identity not null,
  task_id bigint not null,
  usuario text not null,
  opened_at timestamp with time zone default now() not null
);

create table public.tasks (
  id bigint generated always as identity not null,
  order_id bigint not null,
  tipo public.tipo_tarea_enum not null,
  titulo text not null,
  descripcion text,
  estado public.estado_tarea_enum default 'pendiente'::public.estado_tarea_enum not null,
  intento_numero integer default 1 not null,
  fecha_limite timestamp with time zone,
  creado_por text default 'automatico'::text not null,
  completado_en timestamp with time zone,
  completado_por text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  asignado_a uuid,
  notas_completado text,
  snoozed_until timestamp with time zone,
  resultado text
);

create table public.wallet_movement_catalog (
  identification_code text not null,
  nombre text not null,
  categoria public.tipo_movimiento_wallet_enum default 'otro'::public.tipo_movimiento_wallet_enum not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.wallet_movements (
  id bigint generated always as identity not null,
  pais public.pais_enum not null,
  id_movimiento_dropi bigint not null,
  wallet_id bigint,
  order_id bigint,
  id_orden_dropi bigint,
  identification_code text,
  tipo text not null,
  amount numeric(12,2) not null,
  previous_amount numeric(12,2),
  description text,
  guia_envio text,
  registrado_en timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

create table public.whatsapp_mensajes_entrantes (
  id bigint generated always as identity not null,
  order_id bigint,
  telefono_origen text not null,
  mensaje_cliente text not null,
  sugerencia_ia text,
  recibido_en timestamp with time zone default now() not null,
  procesado boolean default false not null
);

create table public.whatsapp_mensajes_salientes (
  id bigint generated always as identity not null,
  order_id bigint,
  telefono_destino text not null,
  mensaje_enviado text not null,
  enviado_por text,
  enviado_en timestamp with time zone default now() not null
);

alter table only public.abandonados add constraint abandonados_pkey primary key (id);
alter table only public.asistente_whatsapp_config add constraint asistente_whatsapp_config_pkey primary key (id);
alter table only public.comentarios add constraint comentarios_pkey primary key (id);
alter table only public.costeos add constraint costeos_pkey primary key (id);
alter table only public.dropi_sessions add constraint dropi_sessions_pkey primary key (pais);
alter table only public.dropkiller_config add constraint dropkiller_config_pkey primary key (id);
alter table only public.dropkiller_products_daily add constraint dropkiller_products_daily_pkey primary key (id);
alter table only public.dropkiller_saved_products add constraint dropkiller_saved_products_pkey primary key (id);
alter table only public.notifications add constraint notifications_pkey primary key (id);
alter table only public.orders add constraint orders_pkey primary key (id);
alter table only public.profiles add constraint profiles_pkey primary key (id);
alter table only public.push_subscriptions add constraint push_subscriptions_pkey primary key (id);
alter table only public.shopify_webhook_events add constraint shopify_webhook_events_pkey primary key (webhook_id);
alter table only public.status_catalog add constraint status_catalog_pkey primary key (id);
alter table only public.status_history add constraint status_history_pkey primary key (id);
alter table only public.task_handling_events add constraint task_handling_events_pkey primary key (id);
alter table only public.tasks add constraint tasks_pkey primary key (id);
alter table only public.wallet_movement_catalog add constraint wallet_movement_catalog_pkey primary key (identification_code);
alter table only public.wallet_movements add constraint wallet_movements_pkey primary key (id);
alter table only public.whatsapp_mensajes_entrantes add constraint whatsapp_mensajes_entrantes_pkey primary key (id);
alter table only public.whatsapp_mensajes_salientes add constraint whatsapp_mensajes_salientes_pkey primary key (id);

alter table only public.abandonados add constraint abandonados_pais_codigo_externo_key unique (pais, codigo_externo);
alter table only public.dropkiller_config add constraint dropkiller_config_platform_country_code_key unique (platform, country_code);
alter table only public.dropkiller_products_daily add constraint dropkiller_products_daily_external_id_captured_at_key unique (external_id, captured_at);
alter table only public.dropkiller_saved_products add constraint dropkiller_saved_products_external_id_country_code_key unique (external_id, country_code);
alter table only public.orders add constraint orders_id_orden_dropi_key unique (id_orden_dropi);
alter table only public.orders add constraint orders_id_orden_shopify_key unique (id_orden_shopify);
alter table only public.push_subscriptions add constraint push_subscriptions_endpoint_key unique (endpoint);
alter table only public.status_catalog add constraint status_catalog_estado_transportadora_key unique (estado, transportadora);
alter table only public.status_history add constraint status_history_order_id_estado_registrado_en_key unique (order_id, estado, registrado_en);
alter table only public.wallet_movements add constraint wallet_movements_pais_id_movimiento_dropi_key unique (pais, id_movimiento_dropi);

alter table only public.comentarios add constraint comentarios_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table only public.costeos add constraint costeos_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
alter table only public.dropkiller_saved_products add constraint dropkiller_saved_products_saved_by_fkey foreign key (saved_by) references public.profiles(id) on delete set null;
alter table only public.notifications add constraint notifications_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table only public.notifications add constraint notifications_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
alter table only public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table only public.push_subscriptions add constraint push_subscriptions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.status_history add constraint status_history_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table only public.task_handling_events add constraint task_handling_events_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;
alter table only public.tasks add constraint tasks_asignado_a_fkey foreign key (asignado_a) references public.profiles(id) on delete set null;
alter table only public.tasks add constraint tasks_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade;
alter table only public.wallet_movements add constraint wallet_movements_identification_code_fkey foreign key (identification_code) references public.wallet_movement_catalog(identification_code);
alter table only public.wallet_movements add constraint wallet_movements_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;
alter table only public.whatsapp_mensajes_entrantes add constraint whatsapp_mensajes_entrantes_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;
alter table only public.whatsapp_mensajes_salientes add constraint whatsapp_mensajes_salientes_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;

create or replace function public.dinero_en_la_calle()
returns table(pais public.pais_enum, nombre_producto text, pedidos_por_entregar bigint, dinero_en_la_calle numeric)
language sql
stable
as $function$
  select
    o.pais,
    trim(split_part(trim(o.nombre_producto), ':', 1)) as nombre_producto,
    count(*) as pedidos_por_entregar,
    coalesce(sum(o.monto_a_ganar), 0) as dinero_en_la_calle
  from orders o
  left join status_catalog sc
    on sc.estado = o.estado_dropi
    and (sc.transportadora = o.transportadora or (sc.transportadora is null and o.transportadora is null))
  where o.nombre_producto is not null
    and coalesce(sc.categoria::text, 'sin_clasificar') not in ('nuevo', 'entregado', 'cancelado', 'devolucion')
  group by o.pais, trim(split_part(trim(o.nombre_producto), ':', 1))
  order by o.pais, dinero_en_la_calle desc;
$function$;

create or replace function public.dropkiller_sweet_spot_candidates_scored_v3()
returns table(
  external_id text,
  platform text,
  country_code text,
  nombre_producto text,
  sale_price numeric,
  suggested_price numeric,
  stock integer,
  total_sold_units integer,
  sold_units_last_7_days integer,
  sold_units_last_30_days integer,
  captured_at date,
  ritmo_reciente numeric,
  percentil_ritmo numeric,
  dias_con_venta_7d integer,
  tercio1_promedio numeric,
  tercio2_promedio numeric,
  tercio3_promedio numeric,
  tendencia_ratio numeric,
  cumple_banda_sweet_spot boolean,
  cumple_consistencia boolean,
  cumple_tendencia_ascendente boolean,
  es_sweet_spot boolean
)
language sql
stable
as $function$
  with latest as (
    select distinct on (external_id)
      external_id, platform, country_code, nombre_producto,
      sale_price, suggested_price, stock, total_sold_units,
      sold_units_last_7_days, sold_units_last_30_days,
      history_30d, captured_at
    from dropkiller_products_daily
    order by external_id, captured_at desc
  ),
  rated as (
    select
      *,
      round(sold_units_last_7_days::numeric / 7, 2) as ritmo_reciente_calc,
      percent_rank() over (
        partition by country_code
        order by sold_units_last_7_days::numeric / 7
      )::numeric as percentil_ritmo_calc
    from latest
  ),
  history_calc as (
    select
      r.*,
      (
        select count(*)
        from jsonb_array_elements(r.history_30d) h
        where (h->>'d')::date > (r.captured_at - interval '7 days')::date
          and coalesce((h->>'u')::numeric, 0) > 0
      ) as dias_con_venta_7d_calc,
      (
        select avg(coalesce((h->>'u')::numeric, 0))
        from jsonb_array_elements(r.history_30d) h
        where (h->>'d')::date <= (r.captured_at - interval '20 days')::date
      ) as tercio1_calc,
      (
        select avg(coalesce((h->>'u')::numeric, 0))
        from jsonb_array_elements(r.history_30d) h
        where (h->>'d')::date > (r.captured_at - interval '20 days')::date
          and (h->>'d')::date <= (r.captured_at - interval '10 days')::date
      ) as tercio2_calc,
      (
        select avg(coalesce((h->>'u')::numeric, 0))
        from jsonb_array_elements(r.history_30d) h
        where (h->>'d')::date > (r.captured_at - interval '10 days')::date
      ) as tercio3_calc
    from rated r
  )
  select
    external_id, platform, country_code, nombre_producto,
    sale_price, suggested_price, stock, total_sold_units,
    sold_units_last_7_days, sold_units_last_30_days, captured_at,
    ritmo_reciente_calc as ritmo_reciente,
    round(percentil_ritmo_calc, 3) as percentil_ritmo,
    dias_con_venta_7d_calc as dias_con_venta_7d,
    round(tercio1_calc, 2) as tercio1_promedio,
    round(tercio2_calc, 2) as tercio2_promedio,
    round(tercio3_calc, 2) as tercio3_promedio,
    round(
      case when coalesce(tercio1_calc, 0) > 0
        then tercio3_calc / tercio1_calc
        else null
      end, 2
    ) as tendencia_ratio,
    (percentil_ritmo_calc between 0.50 and 0.85) as cumple_banda_sweet_spot,
    -- umbral subido: 10/día * 7 = 70/semana (antes 6/día = 42/semana)
    (dias_con_venta_7d_calc >= 5 and sold_units_last_7_days >= 70) as cumple_consistencia,
    (coalesce(tercio1_calc, 0) > 0 and tercio3_calc > tercio1_calc) as cumple_tendencia_ascendente,
    (
      (percentil_ritmo_calc between 0.50 and 0.85)
      and (dias_con_venta_7d_calc >= 5 and sold_units_last_7_days >= 70)
      and (coalesce(tercio1_calc, 0) > 0 and tercio3_calc > tercio1_calc)
    ) as es_sweet_spot
  from history_calc
  order by es_sweet_spot desc, tendencia_ratio desc nulls last;
$function$;

create or replace function public.dropkiller_sweet_spot_candidates()
returns table(
  external_id text,
  platform text,
  country_code text,
  nombre_producto text,
  sale_price numeric,
  suggested_price numeric,
  stock integer,
  total_sold_units integer,
  sold_units_last_7_days integer,
  sold_units_last_30_days integer,
  captured_at date,
  ritmo_reciente numeric,
  percentil_ritmo numeric,
  dias_con_venta_7d integer,
  tercio1_promedio numeric,
  tercio2_promedio numeric,
  tercio3_promedio numeric,
  tendencia_ratio numeric,
  cumple_banda_sweet_spot boolean,
  cumple_consistencia boolean,
  cumple_tendencia_ascendente boolean,
  es_sweet_spot boolean,
  dropkiller_uuid text,
  providers_count integer,
  primary_image_url text
)
language sql
stable
as $function$
  select
    candidates.*,
    snapshot.dropkiller_uuid,
    snapshot.providers_count,
    snapshot.primary_image_url
  from dropkiller_sweet_spot_candidates_scored_v3() as candidates
  left join dropkiller_products_daily as snapshot
    on snapshot.external_id = candidates.external_id
    and snapshot.captured_at = candidates.captured_at
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$function$;

create or replace function public.is_authenticated_active_user()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and activo = true
  );
$function$;

create or replace function public.product_order_summary()
returns table(
  pais public.pais_enum,
  nombre_producto text,
  total bigint,
  pendientes bigint,
  confirmados bigint,
  en_transito bigint,
  entregados bigint,
  cancelados bigint,
  devoluciones bigint,
  confirmados_alguna_vez bigint,
  pct_confirmacion numeric,
  pct_cancelacion numeric,
  pct_entrega numeric,
  pct_devolucion numeric
)
language sql
stable
as $function$
  with base as (
    select
      o.id,
      o.pais,
      trim(split_part(trim(o.nombre_producto), ':', 1)) as nombre_producto,
      coalesce(sc.categoria::text, 'sin_clasificar') as categoria,
      exists (
        select 1 from status_history sh
        where sh.order_id = o.id and sh.estado = 'PENDIENTE'
      ) as paso_por_pendiente
    from orders o
    left join status_catalog sc
      on sc.estado = o.estado_dropi
      and (sc.transportadora = o.transportadora or (sc.transportadora is null and o.transportadora is null))
    where o.nombre_producto is not null
  )
  select
    pais,
    nombre_producto,
    count(*) as total,
    count(*) filter (where categoria = 'nuevo') as pendientes,
    count(*) filter (where categoria = 'confirmado') as confirmados,
    count(*) filter (where categoria not in ('nuevo', 'confirmado', 'entregado', 'cancelado', 'devolucion')) as en_transito,
    count(*) filter (where categoria = 'entregado') as entregados,
    count(*) filter (where categoria = 'cancelado') as cancelados,
    count(*) filter (where categoria = 'devolucion') as devoluciones,
    count(*) filter (where paso_por_pendiente) as confirmados_alguna_vez,
    round(100.0 * count(*) filter (where paso_por_pendiente) / nullif(count(*), 0), 1) as pct_confirmacion,
    round(100.0 * count(*) filter (where categoria = 'cancelado') / nullif(count(*), 0), 1) as pct_cancelacion,
    round(100.0 * count(*) filter (where categoria = 'entregado') / nullif(count(*) filter (where paso_por_pendiente), 0), 1) as pct_entrega,
    round(100.0 * count(*) filter (where categoria = 'devolucion') / nullif(count(*) filter (where paso_por_pendiente), 0), 1) as pct_devolucion
  from base
  group by pais, nombre_producto
  order by pais, total desc;
$function$;

create or replace function public.reporte_semanal(p_date_from date, p_date_to date)
returns table(
  pais public.pais_enum,
  pedidos_nuevos bigint,
  confirmados bigint,
  cancelados bigint,
  entregas bigint,
  devoluciones bigint
)
language sql
stable
as $function$
  with cohort as (
    select
      o.id,
      o.pais,
      exists (
        select 1 from status_history sh
        where sh.order_id = o.id and sh.estado = 'PENDIENTE'
      ) as fue_confirmado,
      coalesce(sc.categoria::text, 'sin_clasificar') as categoria_actual
    from orders o
    left join status_catalog sc
      on sc.estado = o.estado_dropi
      and (sc.transportadora = o.transportadora or (sc.transportadora is null and o.transportadora is null))
    where o.fecha >= p_date_from and o.fecha <= p_date_to
  ),
  eventos as (
    select
      o.pais,
      coalesce(sc.categoria::text, 'sin_clasificar') as categoria,
      sh.order_id
    from status_history sh
    join orders o on o.id = sh.order_id
    left join status_catalog sc
      on sc.estado = sh.estado
      and (sc.transportadora = sh.transportadora or (sc.transportadora is null and sh.transportadora is null))
    where sh.registrado_en::date >= p_date_from and sh.registrado_en::date <= p_date_to
  )
  select
    p.pais,
    coalesce((select count(*) from cohort c where c.pais = p.pais), 0) as pedidos_nuevos,
    coalesce((select count(*) from cohort c where c.pais = p.pais and c.fue_confirmado), 0) as confirmados,
    coalesce((select count(*) from cohort c where c.pais = p.pais and c.categoria_actual = 'cancelado'), 0) as cancelados,
    coalesce((select count(distinct e.order_id) from eventos e where e.pais = p.pais and e.categoria = 'entregado'), 0) as entregas,
    coalesce((select count(distinct e.order_id) from eventos e where e.pais = p.pais and e.categoria = 'devolucion'), 0) as devoluciones
  from (select unnest(enum_range(null::pais_enum)) as pais) p;
$function$;

create or replace function public.resolve_wallet_movement_order_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.order_id is null and new.id_orden_dropi is not null then
    select id into new.order_id
    from orders
    where id_orden_dropi = new.id_orden_dropi
    limit 1;
  end if;
  return new;
end;
$function$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.task_completions_by_user(p_date_from date, p_date_to date)
returns table(usuario text, tipo text, tareas_completadas bigint)
language sql
stable
as $function$
  select
    t.completado_por as usuario,
    t.tipo::text as tipo,
    count(*) as tareas_completadas
  from tasks t
  where t.estado = 'completada'
    and t.completado_en::date >= p_date_from
    and t.completado_en::date <= p_date_to
    and t.completado_por is not null
    and t.completado_por not like 'sistema (%'
  group by t.completado_por, t.tipo
  order by t.completado_por, tareas_completadas desc;
$function$;

create or replace function public.task_handling_time_by_user(p_date_from date, p_date_to date)
returns table(usuario text, tareas_medidas bigint, minutos_promedio numeric)
language sql
stable
as $function$
  with completadas as (
    select
      t.id as task_id,
      t.completado_por as usuario,
      t.completado_en
    from tasks t
    where t.estado = 'completada'
      and t.completado_en::date >= p_date_from
      and t.completado_en::date <= p_date_to
      and t.completado_por is not null
      and t.completado_por not like 'sistema (%'
  ),
  con_apertura as (
    select
      c.task_id,
      c.usuario,
      c.completado_en,
      (
        select max(h.opened_at)
        from task_handling_events h
        where h.task_id = c.task_id
          and h.opened_at <= c.completado_en
      ) as ultima_apertura
    from completadas c
  )
  select
    usuario,
    count(*) filter (where ultima_apertura is not null) as tareas_medidas,
    round(
      avg(extract(epoch from (completado_en - ultima_apertura)) / 60.0)
        filter (where ultima_apertura is not null),
      1
    ) as minutos_promedio
  from con_apertura
  group by usuario
  order by usuario;
$function$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.wallet_daily_summary(p_date_from date, p_date_to date)
returns table(pais public.pais_enum, dia date, entradas numeric, salidas numeric, neto numeric)
language sql
stable
as $function$
  select
    wm.pais,
    wm.registrado_en::date as dia,
    sum(wm.amount) filter (where wm.tipo = 'ENTRADA') as entradas,
    sum(wm.amount) filter (where wm.tipo = 'SALIDA') as salidas,
    coalesce(sum(wm.amount) filter (where wm.tipo = 'ENTRADA'), 0)
      - coalesce(sum(wm.amount) filter (where wm.tipo = 'SALIDA'), 0) as neto
  from wallet_movements wm
  left join wallet_movement_catalog wmc
    on wmc.identification_code = wm.identification_code
  where wm.registrado_en::date >= p_date_from
    and wm.registrado_en::date <= p_date_to
    and coalesce(wmc.categoria, 'otro'::tipo_movimiento_wallet_enum) not in ('recarga', 'retiro')
  group by wm.pais, wm.registrado_en::date
  order by wm.pais, dia;
$function$;

create or replace function public.wallet_summary(p_date_from date, p_date_to date)
returns table(
  pais public.pais_enum,
  categoria public.tipo_movimiento_wallet_enum,
  tipo text,
  total numeric
)
language sql
stable
as $function$
  select
    wm.pais,
    coalesce(wmc.categoria, 'otro'::tipo_movimiento_wallet_enum) as categoria,
    wm.tipo,
    sum(wm.amount) as total
  from wallet_movements wm
  left join wallet_movement_catalog wmc
    on wmc.identification_code = wm.identification_code
  where wm.registrado_en::date >= p_date_from
    and wm.registrado_en::date <= p_date_to
  group by wm.pais, coalesce(wmc.categoria, 'otro'::tipo_movimiento_wallet_enum), wm.tipo;
$function$;

create index idx_abandonados_estado on public.abandonados using btree (pais, estado);
create index idx_abandonados_telefono on public.abandonados using btree (telefono);
create index idx_comentarios_order on public.comentarios using btree (order_id);
create index idx_costeos_pais on public.costeos using btree (pais);
create index idx_dropkiller_daily_captured on public.dropkiller_products_daily using btree (captured_at desc);
create index idx_dropkiller_daily_external on public.dropkiller_products_daily using btree (external_id, captured_at desc);
create index idx_notifications_user_unread on public.notifications using btree (user_id, created_at desc) where (leida = false);
create index idx_orders_activo on public.orders using btree (activo) where (activo = true);
create index idx_orders_estado_crm on public.orders using btree (estado_crm);
create index idx_orders_estado_dropi on public.orders using btree (estado_dropi);
create index idx_orders_fecha on public.orders using btree (fecha);
create index idx_orders_nombre_apellido on public.orders using btree (nombre, apellido);
create index idx_orders_numero_orden on public.orders using btree (numero_orden);
create index idx_orders_pais on public.orders using btree (pais);
create index idx_orders_reconciliacion_pendiente on public.orders using btree (id) where ((activo = true) and (tarea_generada_para_estado is distinct from estado_dropi));
create index idx_orders_telefono on public.orders using btree (telefono);
create index idx_push_subscriptions_user on public.push_subscriptions using btree (user_id);
create index idx_status_history_order on public.status_history using btree (order_id);
create index idx_task_handling_events_task on public.task_handling_events using btree (task_id, opened_at desc);
create index idx_tasks_asignado_a on public.tasks using btree (asignado_a) where (asignado_a is not null);
create index idx_tasks_estado on public.tasks using btree (estado);
create index idx_tasks_fecha_limite on public.tasks using btree (fecha_limite);
create index idx_tasks_order on public.tasks using btree (order_id);
create index idx_tasks_snoozed_until on public.tasks using btree (snoozed_until) where (snoozed_until is not null);
create unique index uq_tasks_order_tipo_abierta on public.tasks using btree (order_id, tipo) where (estado = any (array['pendiente'::public.estado_tarea_enum, 'en_progreso'::public.estado_tarea_enum]));
create index idx_wallet_movements_code on public.wallet_movements using btree (identification_code);
create index idx_wallet_movements_order on public.wallet_movements using btree (order_id);
create index idx_wallet_movements_pais_fecha on public.wallet_movements using btree (pais, registrado_en);
create index idx_whatsapp_mensajes_order on public.whatsapp_mensajes_entrantes using btree (order_id, recibido_en desc);
create index idx_whatsapp_mensajes_salientes_telefono on public.whatsapp_mensajes_salientes using btree (telefono_destino, enviado_en desc);

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger trg_costeos_updated_at before update on public.costeos for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_status_catalog_updated_at before update on public.status_catalog for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger trg_wallet_movement_catalog_updated_at before update on public.wallet_movement_catalog for each row execute function public.set_updated_at();
create trigger trg_wallet_movements_resolve_order before insert on public.wallet_movements for each row execute function public.resolve_wallet_movement_order_id();

alter table public.abandonados enable row level security;
alter table public.asistente_whatsapp_config enable row level security;
alter table public.comentarios enable row level security;
alter table public.costeos enable row level security;
alter table public.dropi_sessions enable row level security;
alter table public.dropkiller_config enable row level security;
alter table public.dropkiller_products_daily enable row level security;
alter table public.dropkiller_saved_products enable row level security;
alter table public.notifications enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.shopify_webhook_events enable row level security;
alter table public.status_catalog enable row level security;
alter table public.status_history enable row level security;
alter table public.task_handling_events enable row level security;
alter table public.tasks enable row level security;
alter table public.wallet_movement_catalog enable row level security;
alter table public.wallet_movements enable row level security;
alter table public.whatsapp_mensajes_entrantes enable row level security;
alter table public.whatsapp_mensajes_salientes enable row level security;

create policy "authenticated users can read abandonados" on public.abandonados as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can update abandonados" on public.abandonados as permissive for update to public using (public.is_authenticated_active_user());
create policy "authenticated users can read config" on public.asistente_whatsapp_config as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can update config" on public.asistente_whatsapp_config as permissive for update to public using (public.is_authenticated_active_user());
create policy "authenticated users can read comentarios" on public.comentarios as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write comentarios" on public.comentarios as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read costeos" on public.costeos as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write costeos" on public.costeos as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read dropkiller_config" on public.dropkiller_config as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can read dropkiller_products_daily" on public.dropkiller_products_daily as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can read saved products" on public.dropkiller_saved_products as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write saved products" on public.dropkiller_saved_products as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "users read own notifications" on public.notifications as permissive for select to public using ((user_id = auth.uid()));
create policy "users update own notifications" on public.notifications as permissive for update to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "authenticated users can read orders" on public.orders as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write orders" on public.orders as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read all active profiles" on public.profiles as permissive for select to public using (public.is_authenticated_active_user());
create policy "users can update own profile" on public.profiles as permissive for update to public using ((id = auth.uid())) with check ((id = auth.uid()));
create policy "users manage own push subscriptions" on public.push_subscriptions as permissive for all to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "authenticated users can read status_catalog" on public.status_catalog as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write status_catalog" on public.status_catalog as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read status_history" on public.status_history as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write status_history" on public.status_history as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can insert handling events" on public.task_handling_events as permissive for insert to public with check (public.is_authenticated_active_user());
create policy "authenticated users can read handling events" on public.task_handling_events as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can read tasks" on public.tasks as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write tasks" on public.tasks as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read wallet_movement_catalog" on public.wallet_movement_catalog as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write wallet_movement_catalog" on public.wallet_movement_catalog as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read wallet_movements" on public.wallet_movements as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can write wallet_movements" on public.wallet_movements as permissive for all to public using (public.is_authenticated_active_user()) with check (public.is_authenticated_active_user());
create policy "authenticated users can read whatsapp messages" on public.whatsapp_mensajes_entrantes as permissive for select to public using (public.is_authenticated_active_user());
create policy "authenticated users can insert sent messages" on public.whatsapp_mensajes_salientes as permissive for insert to public with check (public.is_authenticated_active_user());
create policy "authenticated users can read sent messages" on public.whatsapp_mensajes_salientes as permissive for select to public using (public.is_authenticated_active_user());

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant usage on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter publication supabase_realtime add table public.notifications;

commit;
