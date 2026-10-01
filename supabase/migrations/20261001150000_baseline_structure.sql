-- CRM Pakora — faithful structural baseline captured during stabilization.
-- Represents the verified production structure from SUPABASE_LIVE_AUDIT.md
-- (2026-09-30), supplemented by SUPABASE_BASELINE_METADATA.md (2026-10-01).
-- Evidence commit: 136575abda2cf4f4669c2108dc57ac967f4d72ec.
--
-- FOR RECONSTRUCTION OF A FRESH SUPABASE ENVIRONMENT ONLY.
-- MUST NOT BE EXECUTED AGAINST THE EXISTING POPULATED PRODUCTION DATABASE.
-- Production brownfield migration-history adoption is deferred to Phase 3F;
-- this file does not create, repair or write any migration-history object.
-- Operational catalog rows are deliberately excluded: they belong to Phase 3C.
-- Corrective migrations are deliberately excluded; observed behavior is retained.
--
-- T0 = 20261001150000 (allocated UTC version, 2026-10-01 15:00:00).
-- Phase 3B-1 verified that supabase_migrations and its history table were absent:
-- there are no documented remote versions with which this T0 conflicts.
-- Reserve T1 = 20261001150001 for Phase 3C catalogs; no T1 file is created here.
-- Recheck remote history only in the separately authorized Phase 3F adoption.
--
-- Authoring and reconciliation were static only. THIS SQL HAS NOT BEEN EXECUTED.
-- Actual clean reconstruction, catalog loading and acceptance remain deferred.


-- ============================================================================
-- Preconditions / extensions
-- ============================================================================

-- Expects PostgreSQL 17 (live: 17.6), a normal Supabase environment with
-- public, extensions, auth.users(id), auth.uid() and provider roles already present.
-- Run the future reconstruction as postgres with the bootstrap privileges needed
-- for the application Auth trigger and default ACLs of postgres/supabase_admin.
-- Those provider roles, schemas, memberships and Auth tables are NOT created here.
-- Keep application traffic and Auth signups disabled until reconstruction is done.
-- Existing application objects are an error, not an upsert/replay target.
BEGIN;
SET LOCAL search_path = "$user", public, extensions;

DO $preconditions$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Baseline requires the existing postgres role as current_user';
  END IF;
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Baseline requires PostgreSQL 17; validate other versions separately';
  END IF;
END;
$preconditions$;

-- Only the two extensions inspected in the evidence, in their verified schema.
-- IF NOT EXISTS accommodates provider bootstrap; the assertions reject mismatches
-- rather than moving/upgrading/replacing an existing extension or its internals.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions VERSION '1.3';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions VERSION '1.1';

DO $extension_expectations$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND e.extversion = '1.3'
      AND n.nspname = 'extensions'
      AND pg_catalog.pg_get_userbyid(e.extowner) = 'postgres'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'uuid-ossp' AND e.extversion = '1.1'
      AND n.nspname = 'extensions'
      AND pg_catalog.pg_get_userbyid(e.extowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Extension version/schema/owner differs from the verified baseline';
  END IF;
END;
$extension_expectations$;

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE public.categoria_estado_enum AS ENUM (
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

CREATE TYPE public.estado_abandonado_enum AS ENUM (
  'nuevo',
  'contactado',
  'recuperado',
  'descartado'
);

CREATE TYPE public.estado_crm_enum AS ENUM (
  'nuevo',
  'en_ruta',
  'entregado',
  'cancelado',
  'devolucion'
);

CREATE TYPE public.estado_tarea_enum AS ENUM (
  'pendiente',
  'en_progreso',
  'completada',
  'cancelada'
);

CREATE TYPE public.notificacion_tipo_enum AS ENUM (
  'tarea_urgente_asignada',
  'tarea_vencida',
  'pedido_nuevo',
  'novedad',
  'pedido_entregado',
  'pedido_devolucion',
  'pedido_en_reparto'
);

CREATE TYPE public.pais_enum AS ENUM (
  'CO',
  'MX'
);

CREATE TYPE public.role_enum AS ENUM (
  'admin'
);

CREATE TYPE public.tipo_movimiento_wallet_enum AS ENUM (
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

CREATE TYPE public.tipo_tarea_enum AS ENUM (
  'llamar_confirmacion',
  'notificar_guia',
  'presionar_entrega',
  'notificar_proximo_llegar',
  'resolver_novedad'
);

-- ============================================================================
-- Tables
-- ============================================================================

-- Column order, types, precision, nullability and defaults follow Phase 2.
-- SEQUENCE NAME deterministically names each identity-created sequence; no
-- redundant CREATE SEQUENCE is needed. The bigint column fixes sequence type.
-- Structural START is not a copy of a production sequence position: no setval,
-- RESTART or nextval is used. Phase 3C will handle explicit catalog IDs separately.

CREATE TABLE public.abandonados (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.abandonados_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  pais pais_enum NOT NULL,
  codigo_externo text NOT NULL,
  nombre text NULL,
  apellido text NULL,
  telefono text NULL,
  direccion text NULL,
  ciudad text NULL,
  departamento text NULL,
  nombre_producto text NULL,
  precio numeric(12,2) NULL,
  fecha_abandono date NULL,
  estado estado_abandonado_enum NOT NULL DEFAULT 'nuevo'::estado_abandonado_enum,
  sincronizado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.asistente_whatsapp_config (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.asistente_whatsapp_config_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  reglas text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_por text NULL
);

CREATE TABLE public.comentarios (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.comentarios_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  order_id bigint NOT NULL,
  comentario text NOT NULL,
  origen text NOT NULL DEFAULT 'sheet'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.costeos (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.costeos_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  pais pais_enum NOT NULL,
  nombre_producto text NOT NULL,
  precio_proveedor numeric(12,2) NOT NULL DEFAULT 0,
  flete_base numeric(12,2) NOT NULL DEFAULT 0,
  tasa_efectividad numeric(5,4) NOT NULL DEFAULT 0.75,
  costos_administrativos numeric(12,2) NOT NULL DEFAULT 0,
  fullfilment numeric(12,2) NOT NULL DEFAULT 0,
  cpa_ads numeric(12,2) NOT NULL DEFAULT 0,
  cpa_manual boolean NOT NULL DEFAULT false,
  tasa_cancelacion numeric(5,4) NOT NULL DEFAULT 0,
  precio_venta numeric(12,2) NOT NULL DEFAULT 0,
  importe_gastado numeric(12,2) NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  precio_comparacion numeric(12,2) NULL,
  cpa_porcentaje_objetivo numeric(5,2) NOT NULL DEFAULT 20
);

CREATE TABLE public.dropi_sessions (
  pais text NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.dropkiller_config (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.dropkiller_config_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  platform text NOT NULL,
  country_code text NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.dropkiller_products_daily (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.dropkiller_products_daily_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  external_id text NOT NULL,
  platform text NOT NULL,
  country_code text NOT NULL,
  nombre_producto text NOT NULL,
  sale_price numeric(12,2) NULL,
  suggested_price numeric(12,2) NULL,
  stock integer NULL,
  total_sold_units integer NULL,
  sold_units_last_7_days integer NULL,
  sold_units_last_30_days integer NULL,
  history_30d jsonb NULL,
  captured_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  dropkiller_uuid text NULL,
  providers_count integer NULL,
  primary_image_url text NULL
);

CREATE TABLE public.dropkiller_saved_products (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.dropkiller_saved_products_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  external_id text NOT NULL,
  dropkiller_uuid text NULL,
  country_code text NOT NULL,
  nombre_producto text NOT NULL,
  sale_price numeric(12,2) NULL,
  primary_image_url text NULL,
  sold_units_last_7_days integer NULL,
  sold_units_last_30_days integer NULL,
  total_sold_units integer NULL,
  providers_count integer NULL,
  notas text NULL,
  saved_by uuid NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.internal_messages (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.internal_messages_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  remitente_id uuid NOT NULL,
  destinatario_id uuid NOT NULL,
  mensaje text NOT NULL,
  leido boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.meta_campaigns (
  id text NOT NULL,
  ad_account_id text NOT NULL,
  nombre text NOT NULL,
  estado text NOT NULL,
  objetivo text NULL,
  pais text NULL,
  moneda text NULL,
  actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
  producto_base text NULL,
  autopause_limite_gasto numeric(14,2) NULL,
  autopause_desde date NULL,
  autopause_hasta date NULL,
  autopause_activa boolean NOT NULL DEFAULT false,
  autopause_ultima_revision timestamp with time zone NULL,
  autopause_pausada_por_regla boolean NOT NULL DEFAULT false
);

CREATE TABLE public.notifications (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  user_id uuid NOT NULL,
  tipo notificacion_tipo_enum NOT NULL,
  titulo text NOT NULL,
  mensaje text NULL,
  order_id bigint NULL,
  task_id bigint NULL,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.orders_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  pais pais_enum NOT NULL,
  id_orden_shopify text NULL,
  numero_orden text NULL,
  fecha date NULL,
  nombre text NULL,
  apellido text NULL,
  telefono text NULL,
  direccion text NULL,
  barrio_referencia text NULL,
  ciudad text NULL,
  departamento text NULL,
  nombre_producto text NULL,
  cantidad integer NULL DEFAULT 1,
  precio numeric(12,2) NULL,
  total numeric(12,2) NULL,
  notas_pedido text NULL,
  id_orden_dropi bigint NULL,
  estado_dropi text NULL,
  guia_envio text NULL,
  transportadora text NULL,
  fecha_entrega_real timestamp with time zone NULL,
  estado_crm estado_crm_enum NOT NULL DEFAULT 'nuevo'::estado_crm_enum,
  activo boolean NOT NULL DEFAULT true,
  nivel_riesgo text NULL,
  total_pedidos_cliente integer NULL DEFAULT 0,
  pedidos_entregados_cliente integer NULL DEFAULT 0,
  pedidos_devueltos_cliente integer NULL DEFAULT 0,
  costo_producto numeric(12,2) NULL DEFAULT 0,
  costo_envio numeric(12,2) NULL DEFAULT 0,
  comision_cod numeric(12,2) NULL DEFAULT 0,
  valor_liquidado numeric(12,2) NULL,
  fecha_liquidacion timestamp with time zone NULL,
  estado_liquidacion text NULL,
  costo_devolucion numeric(12,2) NULL,
  ganancia_esperada numeric(12,2) NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tarea_generada_para_estado text NULL,
  monto_a_ganar numeric(12,2) NULL,
  codigo_postal text NULL,
  colonia text NULL,
  numero_interior text NULL,
  punto_referencia text NULL,
  pausar_tareas_automaticas boolean NOT NULL DEFAULT false
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  nombre text NULL,
  role role_enum NOT NULL DEFAULT 'admin'::role_enum,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  telegram_chat_id text NULL,
  titulo text NULL
);

CREATE TABLE public.push_subscriptions (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.push_subscriptions_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone NULL
);

CREATE TABLE public.shopify_webhook_events (
  webhook_id text NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.status_catalog (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.status_catalog_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  estado text NOT NULL,
  transportadora text NULL,
  categoria categoria_estado_enum NOT NULL DEFAULT 'sin_clasificar'::categoria_estado_enum,
  activo boolean NOT NULL DEFAULT true,
  notas text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.status_history (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.status_history_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  order_id bigint NOT NULL,
  estado text NOT NULL,
  categoria categoria_estado_enum NULL,
  transportadora text NULL,
  novedad text NULL,
  notas text NULL,
  registrado_en timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.task_handling_events (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.task_handling_events_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  task_id bigint NOT NULL,
  usuario text NOT NULL,
  opened_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tasks_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  order_id bigint NOT NULL,
  tipo tipo_tarea_enum NOT NULL,
  titulo text NOT NULL,
  descripcion text NULL,
  estado estado_tarea_enum NOT NULL DEFAULT 'pendiente'::estado_tarea_enum,
  intento_numero integer NOT NULL DEFAULT 1,
  fecha_limite timestamp with time zone NULL,
  creado_por text NOT NULL DEFAULT 'automatico'::text,
  completado_en timestamp with time zone NULL,
  completado_por text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  asignado_a uuid NULL,
  notas_completado text NULL,
  snoozed_until timestamp with time zone NULL,
  resultado text NULL
);

CREATE TABLE public.wallet_movement_catalog (
  identification_code text NOT NULL,
  nombre text NOT NULL,
  categoria tipo_movimiento_wallet_enum NOT NULL DEFAULT 'otro'::tipo_movimiento_wallet_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_movements (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_movements_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  pais pais_enum NOT NULL,
  id_movimiento_dropi bigint NOT NULL,
  wallet_id bigint NULL,
  order_id bigint NULL,
  id_orden_dropi bigint NULL,
  identification_code text NULL,
  tipo text NOT NULL,
  amount numeric(12,2) NOT NULL,
  previous_amount numeric(12,2) NULL,
  description text NULL,
  guia_envio text NULL,
  registrado_en timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_mensajes_entrantes (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.whatsapp_mensajes_entrantes_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  order_id bigint NULL,
  telefono_origen text NOT NULL,
  mensaje_cliente text NOT NULL,
  sugerencia_ia text NULL,
  recibido_en timestamp with time zone NOT NULL DEFAULT now(),
  procesado boolean NOT NULL DEFAULT false
);

CREATE TABLE public.whatsapp_mensajes_salientes (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.whatsapp_mensajes_salientes_id_seq
    START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
    CACHE 1 NO CYCLE
  ),
  order_id bigint NULL,
  telefono_destino text NOT NULL,
  mensaje_enviado text NOT NULL,
  enviado_por text NULL,
  enviado_en timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- Constraints
-- ============================================================================

-- 23 primary keys + 10 UNIQUE constraints + 1 CHECK; the first 33 create indexes.
-- UNIQUE retains default NULL-distinct semantics, including status_catalog.
-- Definitions from pg_get_constraintdef retain the observed default immediacy.

ALTER TABLE ONLY public.abandonados
  ADD CONSTRAINT abandonados_pais_codigo_externo_key UNIQUE (pais, codigo_externo);

ALTER TABLE ONLY public.abandonados
  ADD CONSTRAINT abandonados_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.asistente_whatsapp_config
  ADD CONSTRAINT asistente_whatsapp_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.comentarios
  ADD CONSTRAINT comentarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.costeos
  ADD CONSTRAINT costeos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dropi_sessions
  ADD CONSTRAINT dropi_sessions_pkey PRIMARY KEY (pais);

ALTER TABLE ONLY public.dropkiller_config
  ADD CONSTRAINT dropkiller_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dropkiller_config
  ADD CONSTRAINT dropkiller_config_platform_country_code_key UNIQUE (platform, country_code);

ALTER TABLE ONLY public.dropkiller_products_daily
  ADD CONSTRAINT dropkiller_products_daily_external_id_captured_at_key UNIQUE (external_id, captured_at);

ALTER TABLE ONLY public.dropkiller_products_daily
  ADD CONSTRAINT dropkiller_products_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dropkiller_saved_products
  ADD CONSTRAINT dropkiller_saved_products_external_id_country_code_key UNIQUE (external_id, country_code);

ALTER TABLE ONLY public.dropkiller_saved_products
  ADD CONSTRAINT dropkiller_saved_products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.internal_messages
  ADD CONSTRAINT internal_messages_check CHECK (remitente_id <> destinatario_id);

ALTER TABLE ONLY public.internal_messages
  ADD CONSTRAINT internal_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meta_campaigns
  ADD CONSTRAINT meta_campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
  ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
  ADD CONSTRAINT orders_id_orden_dropi_key UNIQUE (id_orden_dropi);

ALTER TABLE ONLY public.orders
  ADD CONSTRAINT orders_id_orden_shopify_key UNIQUE (id_orden_shopify);

ALTER TABLE ONLY public.orders
  ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

ALTER TABLE ONLY public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopify_webhook_events
  ADD CONSTRAINT shopify_webhook_events_pkey PRIMARY KEY (webhook_id);

ALTER TABLE ONLY public.status_catalog
  ADD CONSTRAINT status_catalog_estado_transportadora_key UNIQUE (estado, transportadora);

ALTER TABLE ONLY public.status_catalog
  ADD CONSTRAINT status_catalog_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.status_history
  ADD CONSTRAINT status_history_order_id_estado_registrado_en_key UNIQUE (order_id, estado, registrado_en);

ALTER TABLE ONLY public.status_history
  ADD CONSTRAINT status_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.task_handling_events
  ADD CONSTRAINT task_handling_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks
  ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.wallet_movement_catalog
  ADD CONSTRAINT wallet_movement_catalog_pkey PRIMARY KEY (identification_code);

ALTER TABLE ONLY public.wallet_movements
  ADD CONSTRAINT wallet_movements_pais_id_movimiento_dropi_key UNIQUE (pais, id_movimiento_dropi);

ALTER TABLE ONLY public.wallet_movements
  ADD CONSTRAINT wallet_movements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_mensajes_entrantes
  ADD CONSTRAINT whatsapp_mensajes_entrantes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.whatsapp_mensajes_salientes
  ADD CONSTRAINT whatsapp_mensajes_salientes_pkey PRIMARY KEY (id);

-- ============================================================================
-- Foreign keys
-- ============================================================================

-- All target public tables and their keys now exist. auth.users is a Supabase
-- prerequisite, not an application table to recreate. Omitted ON UPDATE/DELETE
-- and deferrability clauses retain the defaults in the captured definitions.

ALTER TABLE ONLY public.comentarios
  ADD CONSTRAINT comentarios_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.costeos
  ADD CONSTRAINT costeos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dropkiller_saved_products
  ADD CONSTRAINT dropkiller_saved_products_saved_by_fkey FOREIGN KEY (saved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.internal_messages
  ADD CONSTRAINT internal_messages_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.internal_messages
  ADD CONSTRAINT internal_messages_remitente_id_fkey FOREIGN KEY (remitente_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
  ADD CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
  ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.status_history
  ADD CONSTRAINT status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.task_handling_events
  ADD CONSTRAINT task_handling_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
  ADD CONSTRAINT tasks_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
  ADD CONSTRAINT tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.wallet_movements
  ADD CONSTRAINT wallet_movements_identification_code_fkey FOREIGN KEY (identification_code) REFERENCES wallet_movement_catalog(identification_code);

ALTER TABLE ONLY public.wallet_movements
  ADD CONSTRAINT wallet_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.whatsapp_mensajes_entrantes
  ADD CONSTRAINT whatsapp_mensajes_entrantes_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.whatsapp_mensajes_salientes
  ADD CONSTRAINT whatsapp_mensajes_salientes_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes
-- ============================================================================

-- 33 explicit indexes + 33 PK/UNIQUE-backed indexes = 66 total.
-- The partial unique task index is an index, not an extra UNIQUE constraint.

CREATE INDEX idx_abandonados_estado ON public.abandonados USING btree (pais, estado);

CREATE INDEX idx_abandonados_telefono ON public.abandonados USING btree (telefono);

CREATE INDEX idx_comentarios_order ON public.comentarios USING btree (order_id);

CREATE INDEX idx_costeos_pais ON public.costeos USING btree (pais);

CREATE INDEX idx_dropkiller_daily_captured ON public.dropkiller_products_daily USING btree (captured_at DESC);

CREATE INDEX idx_dropkiller_daily_external ON public.dropkiller_products_daily USING btree (external_id, captured_at DESC);

CREATE INDEX idx_internal_messages_conversacion ON public.internal_messages USING btree (LEAST(remitente_id, destinatario_id), GREATEST(remitente_id, destinatario_id), created_at DESC);

CREATE INDEX idx_meta_campaigns_estado ON public.meta_campaigns USING btree (estado);

CREATE INDEX idx_meta_campaigns_pais ON public.meta_campaigns USING btree (pais);

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (leida = false);

CREATE INDEX idx_orders_activo ON public.orders USING btree (activo) WHERE (activo = true);

CREATE INDEX idx_orders_estado_crm ON public.orders USING btree (estado_crm);

CREATE INDEX idx_orders_estado_dropi ON public.orders USING btree (estado_dropi);

CREATE INDEX idx_orders_fecha ON public.orders USING btree (fecha);

CREATE INDEX idx_orders_nombre_apellido ON public.orders USING btree (nombre, apellido);

CREATE INDEX idx_orders_numero_orden ON public.orders USING btree (numero_orden);

CREATE INDEX idx_orders_pais ON public.orders USING btree (pais);

CREATE INDEX idx_orders_reconciliacion_pendiente ON public.orders USING btree (id) WHERE ((activo = true) AND (tarea_generada_para_estado IS DISTINCT FROM estado_dropi));

CREATE INDEX idx_orders_telefono ON public.orders USING btree (telefono);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);

CREATE INDEX idx_status_history_order ON public.status_history USING btree (order_id);

CREATE INDEX idx_task_handling_events_task ON public.task_handling_events USING btree (task_id, opened_at DESC);

CREATE INDEX idx_tasks_asignado_a ON public.tasks USING btree (asignado_a) WHERE (asignado_a IS NOT NULL);

CREATE INDEX idx_tasks_estado ON public.tasks USING btree (estado);

CREATE INDEX idx_tasks_fecha_limite ON public.tasks USING btree (fecha_limite);

CREATE INDEX idx_tasks_order ON public.tasks USING btree (order_id);

CREATE INDEX idx_tasks_snoozed_until ON public.tasks USING btree (snoozed_until) WHERE (snoozed_until IS NOT NULL);

CREATE UNIQUE INDEX uq_tasks_order_tipo_abierta ON public.tasks USING btree (order_id, tipo) WHERE (estado = ANY (ARRAY['pendiente'::estado_tarea_enum, 'en_progreso'::estado_tarea_enum]));

CREATE INDEX idx_wallet_movements_code ON public.wallet_movements USING btree (identification_code);

CREATE INDEX idx_wallet_movements_order ON public.wallet_movements USING btree (order_id);

CREATE INDEX idx_wallet_movements_pais_fecha ON public.wallet_movements USING btree (pais, registrado_en);

CREATE INDEX idx_whatsapp_mensajes_order ON public.whatsapp_mensajes_entrantes USING btree (order_id, recibido_en DESC);

CREATE INDEX idx_whatsapp_mensajes_salientes_telefono ON public.whatsapp_mensajes_salientes USING btree (telefono_destino, enviado_en DESC);

-- ============================================================================
-- Functions
-- ============================================================================

-- Exact pg_get_functiondef text from Phase 2; only the terminating statement
-- semicolon is appended. Omitted volatility/security attributes use PostgreSQL
-- defaults (VOLATILE / INVOKER), as corroborated by Phase 3B-1.
-- The local session search_path above resolves unqualified names at creation;
-- it does not add proconfig to the 12 functions whose verified proconfig is NULL.
-- The scored base precedes its wrapper. No function is invoked by this migration.

CREATE OR REPLACE FUNCTION public.customer_directory_v1(p_query text DEFAULT NULL::text, p_pais pais_enum DEFAULT NULL::pais_enum, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(pais pais_enum, telefono text, nombre text, apellido text, ultimo_pedido_fecha date, pedidos_pakora bigint, nivel_riesgo text, total_pedidos_cliente integer, pedidos_entregados_cliente integer, pedidos_devueltos_cliente integer, total_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with base as (
    select
      o.pais,
      o.telefono,
      o.nombre,
      o.apellido,
      o.fecha,
      o.created_at,
      o.nivel_riesgo,
      o.total_pedidos_cliente,
      o.pedidos_entregados_cliente,
      o.pedidos_devueltos_cliente,
      row_number() over (
        partition by o.pais, o.telefono
        order by o.fecha desc nulls last, o.created_at desc
      ) as rn
    from orders o
    where o.telefono is not null
      and (p_pais is null or o.pais = p_pais)
      and (
        p_query is null
        or o.nombre ilike '%' || p_query || '%'
        or o.apellido ilike '%' || p_query || '%'
        or o.telefono ilike '%' || p_query || '%'
      )
  ),
  latest as (
    select * from base where rn = 1
  ),
  counts as (
    select pais, telefono, count(*) as pedidos_pakora
    from orders
    where telefono is not null
    group by pais, telefono
  )
  select
    l.pais,
    l.telefono,
    l.nombre,
    l.apellido,
    l.fecha as ultimo_pedido_fecha,
    c.pedidos_pakora,
    l.nivel_riesgo::text,
    l.total_pedidos_cliente,
    l.pedidos_entregados_cliente,
    l.pedidos_devueltos_cliente,
    count(*) over () as total_count
  from latest l
  join counts c on c.pais = l.pais and c.telefono = l.telefono
  order by l.fecha desc nulls last, l.created_at desc
  limit p_limit offset p_offset;
$function$;

CREATE OR REPLACE FUNCTION public.dinero_en_la_calle()
 RETURNS TABLE(pais pais_enum, nombre_producto text, pedidos_por_entregar bigint, dinero_en_la_calle numeric)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.dropkiller_sweet_spot_candidates_scored_v3()
 RETURNS TABLE(external_id text, platform text, country_code text, nombre_producto text, sale_price numeric, suggested_price numeric, stock integer, total_sold_units integer, sold_units_last_7_days integer, sold_units_last_30_days integer, captured_at date, ritmo_reciente numeric, percentil_ritmo numeric, dias_con_venta_7d integer, tercio1_promedio numeric, tercio2_promedio numeric, tercio3_promedio numeric, tendencia_ratio numeric, cumple_banda_sweet_spot boolean, cumple_consistencia boolean, cumple_tendencia_ascendente boolean, es_sweet_spot boolean)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.dropkiller_sweet_spot_candidates()
 RETURNS TABLE(external_id text, platform text, country_code text, nombre_producto text, sale_price numeric, suggested_price numeric, stock integer, total_sold_units integer, sold_units_last_7_days integer, sold_units_last_30_days integer, captured_at date, ritmo_reciente numeric, percentil_ritmo numeric, dias_con_venta_7d integer, tercio1_promedio numeric, tercio2_promedio numeric, tercio3_promedio numeric, tendencia_ratio numeric, cumple_banda_sweet_spot boolean, cumple_consistencia boolean, cumple_tendencia_ascendente boolean, es_sweet_spot boolean, dropkiller_uuid text, providers_count integer, primary_image_url text)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.is_authenticated_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and activo = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.product_order_summary()
 RETURNS TABLE(pais pais_enum, nombre_producto text, total bigint, pendientes bigint, confirmados bigint, en_transito bigint, entregados bigint, cancelados bigint, devoluciones bigint, confirmados_alguna_vez bigint, pct_confirmacion numeric, pct_cancelacion numeric, pct_entrega numeric, pct_devolucion numeric)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.reporte_semanal(p_date_from date, p_date_to date)
 RETURNS TABLE(pais pais_enum, pedidos_nuevos bigint, confirmados bigint, cancelados bigint, entregas bigint, devoluciones bigint)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.task_completions_by_user(p_date_from date, p_date_to date)
 RETURNS TABLE(usuario text, tipo text, tareas_completadas bigint)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.task_handling_time_by_user(p_date_from date, p_date_to date)
 RETURNS TABLE(usuario text, tareas_medidas bigint, minutos_promedio numeric)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.wallet_daily_summary(p_date_from date, p_date_to date)
 RETURNS TABLE(pais pais_enum, dia date, entradas numeric, salidas numeric, neto numeric)
 LANGUAGE sql
 STABLE
AS $function$
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

CREATE OR REPLACE FUNCTION public.wallet_summary(p_date_from date, p_date_to date)
 RETURNS TABLE(pais pais_enum, categoria tipo_movimiento_wallet_enum, tipo text, total numeric)
 LANGUAGE sql
 STABLE
AS $function$
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

-- ============================================================================
-- Trigger functions and triggers
-- ============================================================================

-- The INSERT inside handle_new_user is the exact existing trigger body, not
-- seed/business data executed by this migration. update_updated_at is retained
-- even though no observed trigger references it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_wallet_movement_order_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE TRIGGER trg_costeos_updated_at BEFORE UPDATE ON costeos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_status_catalog_updated_at BEFORE UPDATE ON status_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_wallet_movement_catalog_updated_at BEFORE UPDATE ON wallet_movement_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_wallet_movements_resolve_order BEFORE INSERT ON wallet_movements FOR EACH ROW EXECUTE FUNCTION resolve_wallet_movement_order_id();

CREATE TRIGGER trg_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- RLS
-- ============================================================================

-- All 23 tables: enabled, never forced (23/23 ENABLE, 0/23 FORCE).

ALTER TABLE public.abandonados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandonados NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.asistente_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistente_whatsapp_config NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.costeos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dropi_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropi_sessions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dropkiller_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropkiller_config NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dropkiller_products_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropkiller_products_daily NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dropkiller_saved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropkiller_saved_products NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.shopify_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_webhook_events NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.status_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_catalog NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.task_handling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_handling_events NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wallet_movement_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_movement_catalog NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_movements NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_mensajes_entrantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensajes_entrantes NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_mensajes_salientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensajes_salientes NO FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies
-- ============================================================================

-- Exact policy names, commands, role targets and expressions from Phase 2.
-- An absent WITH CHECK remains absent, including its existing fallback semantics.
-- dropi_sessions and shopify_webhook_events deliberately receive no policies.

CREATE POLICY "authenticated users can read abandonados" ON public.abandonados
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can update abandonados" ON public.abandonados
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can read config" ON public.asistente_whatsapp_config
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can update config" ON public.asistente_whatsapp_config
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can read comentarios" ON public.comentarios
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write comentarios" ON public.comentarios
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read costeos" ON public.costeos
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write costeos" ON public.costeos
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read dropkiller_config" ON public.dropkiller_config
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can read dropkiller_products_daily" ON public.dropkiller_products_daily
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can read saved products" ON public.dropkiller_saved_products
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write saved products" ON public.dropkiller_saved_products
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "users can mark received messages as read" ON public.internal_messages
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = destinatario_id))
  WITH CHECK ((auth.uid() = destinatario_id));

CREATE POLICY "users can read their own conversations" ON public.internal_messages
  AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = remitente_id) OR (auth.uid() = destinatario_id)));

CREATE POLICY "users can send messages as themselves" ON public.internal_messages
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = remitente_id) AND is_authenticated_active_user()));

CREATE POLICY "authenticated users can read meta campaigns" ON public.meta_campaigns
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can update meta campaigns" ON public.meta_campaigns
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "users read own notifications" ON public.notifications
  AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "users update own notifications" ON public.notifications
  AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "authenticated users can read orders" ON public.orders
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write orders" ON public.orders
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read all active profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY "users manage own push subscriptions" ON public.push_subscriptions
  AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "authenticated users can read status_catalog" ON public.status_catalog
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write status_catalog" ON public.status_catalog
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read status_history" ON public.status_history
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write status_history" ON public.status_history
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can insert handling events" ON public.task_handling_events
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read handling events" ON public.task_handling_events
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can read tasks" ON public.tasks
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write tasks" ON public.tasks
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read wallet_movement_catalog" ON public.wallet_movement_catalog
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write wallet_movement_catalog" ON public.wallet_movement_catalog
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read wallet_movements" ON public.wallet_movements
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can write wallet_movements" ON public.wallet_movements
  AS PERMISSIVE FOR ALL TO public
  USING (is_authenticated_active_user())
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read whatsapp messages" ON public.whatsapp_mensajes_entrantes
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

CREATE POLICY "authenticated users can insert sent messages" ON public.whatsapp_mensajes_salientes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_authenticated_active_user());

CREATE POLICY "authenticated users can read sent messages" ON public.whatsapp_mensajes_salientes
  AS PERMISSIVE FOR SELECT TO public
  USING (is_authenticated_active_user());

-- ============================================================================
-- Grants / ACL
-- ============================================================================

-- Object-specific ACLs: Phase 3B-1 is authoritative for the eight PostgreSQL 17
-- table privileges, including MAINTAIN omitted by the Phase 2 information_schema
-- view. No grant options or privileges for an unobserved role are introduced.
-- Explicit object lists avoid changing provider/extension objects in the schema.
-- The fresh target must not carry additional unverified ACL/default-ACL entries.
-- Schema CREATE belongs only to pg_database_owner in the observed direct ACL;
-- remove an older bootstrap's direct CREATE for these other observed grantees.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT CREATE, USAGE ON SCHEMA public TO pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.abandonados TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.asistente_whatsapp_config TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.comentarios TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.costeos TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.dropi_sessions TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.dropkiller_config TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.dropkiller_products_daily TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.dropkiller_saved_products TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.internal_messages TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.meta_campaigns TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.notifications TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.orders TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.profiles TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.push_subscriptions TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.shopify_webhook_events TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.status_catalog TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.status_history TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.task_handling_events TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.tasks TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.wallet_movement_catalog TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.wallet_movements TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.whatsapp_mensajes_entrantes TO postgres, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.whatsapp_mensajes_salientes TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.abandonados_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.asistente_whatsapp_config_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.comentarios_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.costeos_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.dropkiller_config_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.dropkiller_products_daily_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.dropkiller_saved_products_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.internal_messages_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.notifications_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.orders_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.push_subscriptions_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.status_catalog_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.status_history_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.task_handling_events_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.tasks_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.wallet_movements_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.whatsapp_mensajes_entrantes_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.whatsapp_mensajes_salientes_id_seq
  TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.customer_directory_v1(text, pais_enum, integer, integer)
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.dinero_en_la_calle()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.dropkiller_sweet_spot_candidates()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.dropkiller_sweet_spot_candidates_scored_v3()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_authenticated_active_user()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.product_order_summary()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reporte_semanal(date, date)
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.resolve_wallet_movement_order_id()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_updated_at()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.task_completions_by_user(date, date)
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.task_handling_time_by_user(date, date)
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at()
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.wallet_daily_summary(date, date)
  TO PUBLIC, postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.wallet_summary(date, date)
  TO PUBLIC, postgres, anon, authenticated, service_role;

-- Six verified per-schema default ACL entries (three per grantor), distinct
-- from the explicit object ACLs above. No global default ACL was supplied as
-- evidence: do not invent a global REVOKE or a per-schema PUBLIC function grant.
-- Absence of PUBLIC in a per-schema function default is NOT a global revocation;
-- PostgreSQL combines per-schema grants with global/built-in defaults.
-- T0 reproduces only the three postgres entries. The three supabase_admin
-- entries are provider prerequisites for later reconstruction validation.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES
  TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, UPDATE, USAGE ON SEQUENCES
  TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Verified expected provider state for supabase_admin IN SCHEMA public:
-- TABLES: INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--   for postgres, anon, authenticated, service_role.
-- SEQUENCES: SELECT, UPDATE, USAGE
--   for postgres, anon, authenticated, service_role.
-- FUNCTIONS: EXECUTE
--   for postgres, anon, authenticated, service_role; no per-schema PUBLIC grant.
-- T0 does not attempt to mutate these provider-owned defaults.
-- Phase 3E must verify that a fresh Supabase destination already provides these
-- three expected per-schema entries. A mismatch must fail validation rather
-- than being silently fixed by T0; do not alter provider role membership.

-- ============================================================================
-- Ownership / final structural assertions
-- ============================================================================

-- No provider roles are created or altered. Explicit owners for application
-- objects preserve SECURITY DEFINER behavior. Identity sequences were created by
-- postgres; ALTER TABLE OWNER also preserves their tied ownership automatically.
-- No independent ALTER SEQUENCE OWNER / OWNED BY rewrite is needed for identities.

ALTER SCHEMA public OWNER TO pg_database_owner;

ALTER TABLE public.abandonados OWNER TO postgres;

ALTER TABLE public.asistente_whatsapp_config OWNER TO postgres;

ALTER TABLE public.comentarios OWNER TO postgres;

ALTER TABLE public.costeos OWNER TO postgres;

ALTER TABLE public.dropi_sessions OWNER TO postgres;

ALTER TABLE public.dropkiller_config OWNER TO postgres;

ALTER TABLE public.dropkiller_products_daily OWNER TO postgres;

ALTER TABLE public.dropkiller_saved_products OWNER TO postgres;

ALTER TABLE public.internal_messages OWNER TO postgres;

ALTER TABLE public.meta_campaigns OWNER TO postgres;

ALTER TABLE public.notifications OWNER TO postgres;

ALTER TABLE public.orders OWNER TO postgres;

ALTER TABLE public.profiles OWNER TO postgres;

ALTER TABLE public.push_subscriptions OWNER TO postgres;

ALTER TABLE public.shopify_webhook_events OWNER TO postgres;

ALTER TABLE public.status_catalog OWNER TO postgres;

ALTER TABLE public.status_history OWNER TO postgres;

ALTER TABLE public.task_handling_events OWNER TO postgres;

ALTER TABLE public.tasks OWNER TO postgres;

ALTER TABLE public.wallet_movement_catalog OWNER TO postgres;

ALTER TABLE public.wallet_movements OWNER TO postgres;

ALTER TABLE public.whatsapp_mensajes_entrantes OWNER TO postgres;

ALTER TABLE public.whatsapp_mensajes_salientes OWNER TO postgres;

ALTER TYPE public.categoria_estado_enum OWNER TO postgres;

ALTER TYPE public.estado_abandonado_enum OWNER TO postgres;

ALTER TYPE public.estado_crm_enum OWNER TO postgres;

ALTER TYPE public.estado_tarea_enum OWNER TO postgres;

ALTER TYPE public.notificacion_tipo_enum OWNER TO postgres;

ALTER TYPE public.pais_enum OWNER TO postgres;

ALTER TYPE public.role_enum OWNER TO postgres;

ALTER TYPE public.tipo_movimiento_wallet_enum OWNER TO postgres;

ALTER TYPE public.tipo_tarea_enum OWNER TO postgres;

ALTER FUNCTION public.customer_directory_v1(text, pais_enum, integer, integer) OWNER TO postgres;

ALTER FUNCTION public.dinero_en_la_calle() OWNER TO postgres;

ALTER FUNCTION public.dropkiller_sweet_spot_candidates() OWNER TO postgres;

ALTER FUNCTION public.dropkiller_sweet_spot_candidates_scored_v3() OWNER TO postgres;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

ALTER FUNCTION public.is_authenticated_active_user() OWNER TO postgres;

ALTER FUNCTION public.product_order_summary() OWNER TO postgres;

ALTER FUNCTION public.reporte_semanal(date, date) OWNER TO postgres;

ALTER FUNCTION public.resolve_wallet_movement_order_id() OWNER TO postgres;

ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

ALTER FUNCTION public.task_completions_by_user(date, date) OWNER TO postgres;

ALTER FUNCTION public.task_handling_time_by_user(date, date) OWNER TO postgres;

ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

ALTER FUNCTION public.wallet_daily_summary(date, date) OWNER TO postgres;

ALTER FUNCTION public.wallet_summary(date, date) OWNER TO postgres;

-- Static reconciliation checklist against Phase 2 + Phase 3B-1:
-- [x] 9 enums: exact names, labels and label order.
-- [x] 23 tables / 244 columns: names, order, types, nullability and defaults.
-- [x] 18 ALWAYS identities / sequences: names and all structural parameters.
-- [x] 52 constraints: 23 PK + 10 UNIQUE + 1 CHECK + 18 FK, exact definitions.
-- [x] 66 expected indexes: 33 implicit + 33 explicit, exact names/definitions;
--     34 unique overall, including 1 partial unique; 6 partial overall.
-- [x] 15 functions: 11 non-trigger + 4 trigger; literal captured definitions.
-- [x] 7 public triggers + 1 application trigger on auth.users.
-- [x] 23 RLS-enabled tables, 0 forced; 39 policies, exact expressions/targets.
-- [x] Object ownership/ACL; 3 postgres default-ACL entries reproduced by T0.
-- [x] 3 supabase_admin default-ACL entries retained as provider prerequisites
--     for later Phase 3E reconstruction validation, not mutated by T0.
-- These are static source assertions, NOT results of a database reconstruction.
-- Catalog/business tables remain empty; no sequence runtime position is restored.
-- Actual definition/ACL equivalence and fresh reconstruction must be validated
-- in a later authorized phase. Database Reproducibility is NOT yet satisfied.
COMMIT;
