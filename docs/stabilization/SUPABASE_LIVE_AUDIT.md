# Supabase Live Audit — Stabilization Phase 2

## Audit scope and evidence

- **LIVE VERIFIED:** proyecto `nauqpgsspwfqkxidenkx` (`nauqpgsspwfqkxidenkx.supabase.co`), identificado en el dashboard de Supabase como `CRM Personal`, rama `main` marcada `PRODUCTION`; base `postgres`, PostgreSQL `17.6`. La primera consulta de identidad devolvió `2026-09-30 15:27:18.488755 UTC`; las consultas de esta auditoría se realizaron el `2026-09-30` entre aproximadamente `15:27` y `15:55 UTC`.
- **LIVE VERIFIED:** acceso mediante sesión autenticada del Supabase Dashboard SQL Editor. Se ejecutaron exclusivamente consultas `SELECT` a catálogos de PostgreSQL (`pg_class`, `pg_attribute`, `pg_type`, `pg_enum`, `pg_constraint`, `pg_index`, `pg_proc`, `pg_trigger`, `pg_policies`, ACL/roles) y SELECT de filas únicamente en `public.status_catalog` y `public.wallet_movement_catalog`. Ninguna función de negocio fue invocada. No se emitió DDL ni DML, ni se llamó a endpoints de la aplicación. El SQL Editor ejecuta consultas independientes; no se obtuvo un snapshot transaccional único de toda la auditoría.
- **LIVE VERIFIED:** alcance estructural completo de `public` para tablas, vistas, columnas, tipos, constraints, índices, funciones, triggers, RLS/policies y grants; se comprobó además el trigger de `auth.users` que llama a `public.handle_new_user`. No se leyeron filas de usuarios, pedidos, mensajes ni otras tablas operativas.
- **REPOSITORY VERIFIED:** HEAD inicial `bd8ed070ef4b110fe5a9bf67921b502aa369dea5`, con working tree limpio antes de la auditoría. Comparación contra `src/lib/supabase/database.types.ts`, los dos SQL actualmente versionados bajo `supabase/`, `.env.example`, `AGENTS.md`, `DEVELOPMENT_LOG.md` y referencias a `.from(...)`/`.rpc(...)` en `src/` y `mcp-server/src/`. Los archivos del repositorio no se usaron como prueba del estado live.
- **NOT VERIFIED:** otros schemas gestionados por Supabase, excepto la referencia puntual al trigger de `auth.users`; el funcionamiento de RLS bajo JWTs reales, la programación de sincronizaciones, las conexiones de producción y la provisión de MCP. No se hizo generación temporal de tipos porque `supabase` CLI, `psql` y `pg_dump` no estaban disponibles; la comparación de tipos se hizo estructuralmente con el archivo versionado y los metadatos live.

## Executive summary

- **LIVE VERIFIED:** `public` contiene 23 tablas, 0 vistas, 0 vistas materializadas, 244 columnas, 9 enums, 52 constraints, 66 índices, 15 funciones, 7 triggers de tablas `public` y 39 políticas RLS. Se observó además 1 trigger en `auth.users`.
- **DIFFERENCE:** el archivo de tipos versionado no lista 2 tablas (`internal_messages`, `meta_campaigns`), 1 columna (`orders.pausar_tareas_automaticas`) ni 5 funciones live de `public`: 1 RPC de aplicación y 4 funciones de trigger. Los 9 enums live coinciden en valores y orden con el archivo de tipos. No se detectaron otras diferencias obvias de columnas, nulabilidad o tipos escalares en las 21 tablas compartidas.
- **DIFFERENCE:** los dos SQL versionados son parches del wrapper `dropkiller_sweet_spot_candidates`; no son una línea base del esquema ni contienen las filas de los dos catálogos. Por tanto el esquema `public` completo no se puede reconstruir con esos archivos solos.
- **LIVE VERIFIED:** `status_catalog` tiene 185 filas, incluidas 41 `sin_clasificar`, y dos combinaciones genéricas duplicadas con `transportadora IS NULL`; `wallet_movement_catalog` tiene 75 filas, sin códigos duplicados ni códigos nulos/vacíos.

## Live schema inventory

**LIVE VERIFIED — `public`.** Todas las relaciones listadas son tablas ordinarias permanentes (`relkind = r`, `relpersistence = p`). No se encontraron vistas ni vistas materializadas. `NULL` indica columna nullable; `NOT NULL`, no nullable. `IDENTITY a` indica `GENERATED ALWAYS AS IDENTITY`. Se conservan tipos y defaults tal como los reportó PostgreSQL.

### `public.abandonados` — 14 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
pais: pais_enum ; NOT NULL
codigo_externo: text ; NOT NULL
nombre: text ; NULL
apellido: text ; NULL
telefono: text ; NULL
direccion: text ; NULL
ciudad: text ; NULL
departamento: text ; NULL
nombre_producto: text ; NULL
precio: numeric(12,2) ; NULL
fecha_abandono: date ; NULL
estado: estado_abandonado_enum ; NOT NULL; DEFAULT 'nuevo'::estado_abandonado_enum
sincronizado_en: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.asistente_whatsapp_config` — 4 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
reglas: text ; NOT NULL; DEFAULT ''::text
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_por: text ; NULL
```

### `public.comentarios` — 5 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
order_id: bigint ; NOT NULL
comentario: text ; NOT NULL
origen: text ; NOT NULL; DEFAULT 'sheet'::text
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.costeos` — 18 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
pais: pais_enum ; NOT NULL
nombre_producto: text ; NOT NULL
precio_proveedor: numeric(12,2) ; NOT NULL; DEFAULT 0
flete_base: numeric(12,2) ; NOT NULL; DEFAULT 0
tasa_efectividad: numeric(5,4) ; NOT NULL; DEFAULT 0.75
costos_administrativos: numeric(12,2) ; NOT NULL; DEFAULT 0
fullfilment: numeric(12,2) ; NOT NULL; DEFAULT 0
cpa_ads: numeric(12,2) ; NOT NULL; DEFAULT 0
cpa_manual: boolean ; NOT NULL; DEFAULT false
tasa_cancelacion: numeric(5,4) ; NOT NULL; DEFAULT 0
precio_venta: numeric(12,2) ; NOT NULL; DEFAULT 0
importe_gastado: numeric(12,2) ; NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
created_by: uuid ; NULL
precio_comparacion: numeric(12,2) ; NULL
cpa_porcentaje_objetivo: numeric(5,2) ; NOT NULL; DEFAULT 20
```

### `public.dropi_sessions` — 4 columnas

```text
pais: text ; NOT NULL
token: text ; NOT NULL
expires_at: timestamp with time zone ; NOT NULL
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.dropkiller_config` — 4 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
platform: text ; NOT NULL
country_code: text ; NOT NULL
activo: boolean ; NOT NULL; DEFAULT true
```

### `public.dropkiller_products_daily` — 17 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
external_id: text ; NOT NULL
platform: text ; NOT NULL
country_code: text ; NOT NULL
nombre_producto: text ; NOT NULL
sale_price: numeric(12,2) ; NULL
suggested_price: numeric(12,2) ; NULL
stock: integer ; NULL
total_sold_units: integer ; NULL
sold_units_last_7_days: integer ; NULL
sold_units_last_30_days: integer ; NULL
history_30d: jsonb ; NULL
captured_at: date ; NOT NULL; DEFAULT CURRENT_DATE
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
dropkiller_uuid: text ; NULL
providers_count: integer ; NULL
primary_image_url: text ; NULL
```

### `public.dropkiller_saved_products` — 14 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
external_id: text ; NOT NULL
dropkiller_uuid: text ; NULL
country_code: text ; NOT NULL
nombre_producto: text ; NOT NULL
sale_price: numeric(12,2) ; NULL
primary_image_url: text ; NULL
sold_units_last_7_days: integer ; NULL
sold_units_last_30_days: integer ; NULL
total_sold_units: integer ; NULL
providers_count: integer ; NULL
notas: text ; NULL
saved_by: uuid ; NULL
saved_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.internal_messages` — 6 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
remitente_id: uuid ; NOT NULL
destinatario_id: uuid ; NOT NULL
mensaje: text ; NOT NULL
leido: boolean ; NOT NULL; DEFAULT false
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.meta_campaigns` — 15 columnas

```text
id: text ; NOT NULL
ad_account_id: text ; NOT NULL
nombre: text ; NOT NULL
estado: text ; NOT NULL
objetivo: text ; NULL
pais: text ; NULL
moneda: text ; NULL
actualizado_en: timestamp with time zone ; NOT NULL; DEFAULT now()
producto_base: text ; NULL
autopause_limite_gasto: numeric(14,2) ; NULL
autopause_desde: date ; NULL
autopause_hasta: date ; NULL
autopause_activa: boolean ; NOT NULL; DEFAULT false
autopause_ultima_revision: timestamp with time zone ; NULL
autopause_pausada_por_regla: boolean ; NOT NULL; DEFAULT false
```

### `public.notifications` — 9 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
user_id: uuid ; NOT NULL
tipo: notificacion_tipo_enum ; NOT NULL
titulo: text ; NOT NULL
mensaje: text ; NULL
order_id: bigint ; NULL
task_id: bigint ; NULL
leida: boolean ; NOT NULL; DEFAULT false
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.orders` — 45 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
pais: pais_enum ; NOT NULL
id_orden_shopify: text ; NULL
numero_orden: text ; NULL
fecha: date ; NULL
nombre: text ; NULL
apellido: text ; NULL
telefono: text ; NULL
direccion: text ; NULL
barrio_referencia: text ; NULL
ciudad: text ; NULL
departamento: text ; NULL
nombre_producto: text ; NULL
cantidad: integer ; NULL; DEFAULT 1
precio: numeric(12,2) ; NULL
total: numeric(12,2) ; NULL
notas_pedido: text ; NULL
id_orden_dropi: bigint ; NULL
estado_dropi: text ; NULL
guia_envio: text ; NULL
transportadora: text ; NULL
fecha_entrega_real: timestamp with time zone ; NULL
estado_crm: estado_crm_enum ; NOT NULL; DEFAULT 'nuevo'::estado_crm_enum
activo: boolean ; NOT NULL; DEFAULT true
nivel_riesgo: text ; NULL
total_pedidos_cliente: integer ; NULL; DEFAULT 0
pedidos_entregados_cliente: integer ; NULL; DEFAULT 0
pedidos_devueltos_cliente: integer ; NULL; DEFAULT 0
costo_producto: numeric(12,2) ; NULL; DEFAULT 0
costo_envio: numeric(12,2) ; NULL; DEFAULT 0
comision_cod: numeric(12,2) ; NULL; DEFAULT 0
valor_liquidado: numeric(12,2) ; NULL
fecha_liquidacion: timestamp with time zone ; NULL
estado_liquidacion: text ; NULL
costo_devolucion: numeric(12,2) ; NULL
ganancia_esperada: numeric(12,2) ; NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
tarea_generada_para_estado: text ; NULL
monto_a_ganar: numeric(12,2) ; NULL
codigo_postal: text ; NULL
colonia: text ; NULL
numero_interior: text ; NULL
punto_referencia: text ; NULL
pausar_tareas_automaticas: boolean ; NOT NULL; DEFAULT false
```

### `public.profiles` — 9 columnas

```text
id: uuid ; NOT NULL
email: text ; NOT NULL
nombre: text ; NULL
role: role_enum ; NOT NULL; DEFAULT 'admin'::role_enum
activo: boolean ; NOT NULL; DEFAULT true
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
telegram_chat_id: text ; NULL
titulo: text ; NULL
```

### `public.push_subscriptions` — 8 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
user_id: uuid ; NOT NULL
endpoint: text ; NOT NULL
p256dh: text ; NOT NULL
auth: text ; NOT NULL
user_agent: text ; NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
last_used_at: timestamp with time zone ; NULL
```

### `public.shopify_webhook_events` — 2 columnas

```text
webhook_id: text ; NOT NULL
received_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.status_catalog` — 8 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
estado: text ; NOT NULL
transportadora: text ; NULL
categoria: categoria_estado_enum ; NOT NULL; DEFAULT 'sin_clasificar'::categoria_estado_enum
activo: boolean ; NOT NULL; DEFAULT true
notas: text ; NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.status_history` — 9 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
order_id: bigint ; NOT NULL
estado: text ; NOT NULL
categoria: categoria_estado_enum ; NULL
transportadora: text ; NULL
novedad: text ; NULL
notas: text ; NULL
registrado_en: timestamp with time zone ; NOT NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.task_handling_events` — 4 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
task_id: bigint ; NOT NULL
usuario: text ; NOT NULL
opened_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.tasks` — 17 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
order_id: bigint ; NOT NULL
tipo: tipo_tarea_enum ; NOT NULL
titulo: text ; NOT NULL
descripcion: text ; NULL
estado: estado_tarea_enum ; NOT NULL; DEFAULT 'pendiente'::estado_tarea_enum
intento_numero: integer ; NOT NULL; DEFAULT 1
fecha_limite: timestamp with time zone ; NULL
creado_por: text ; NOT NULL; DEFAULT 'automatico'::text
completado_en: timestamp with time zone ; NULL
completado_por: text ; NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
asignado_a: uuid ; NULL
notas_completado: text ; NULL
snoozed_until: timestamp with time zone ; NULL
resultado: text ; NULL
```

### `public.wallet_movement_catalog` — 5 columnas

```text
identification_code: text ; NOT NULL
nombre: text ; NOT NULL
categoria: tipo_movimiento_wallet_enum ; NOT NULL; DEFAULT 'otro'::tipo_movimiento_wallet_enum
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
updated_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.wallet_movements` — 14 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
pais: pais_enum ; NOT NULL
id_movimiento_dropi: bigint ; NOT NULL
wallet_id: bigint ; NULL
order_id: bigint ; NULL
id_orden_dropi: bigint ; NULL
identification_code: text ; NULL
tipo: text ; NOT NULL
amount: numeric(12,2) ; NOT NULL
previous_amount: numeric(12,2) ; NULL
description: text ; NULL
guia_envio: text ; NULL
registrado_en: timestamp with time zone ; NOT NULL
created_at: timestamp with time zone ; NOT NULL; DEFAULT now()
```

### `public.whatsapp_mensajes_entrantes` — 7 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
order_id: bigint ; NULL
telefono_origen: text ; NOT NULL
mensaje_cliente: text ; NOT NULL
sugerencia_ia: text ; NULL
recibido_en: timestamp with time zone ; NOT NULL; DEFAULT now()
procesado: boolean ; NOT NULL; DEFAULT false
```

### `public.whatsapp_mensajes_salientes` — 6 columnas

```text
id: bigint ; NOT NULL; IDENTITY a
order_id: bigint ; NULL
telefono_destino: text ; NOT NULL
mensaje_enviado: text ; NOT NULL
enviado_por: text ; NULL
enviado_en: timestamp with time zone ; NOT NULL; DEFAULT now()
```

**LIVE VERIFIED:** 18 secuencias `public` observadas, todas propiedad de `postgres`: `abandonados_id_seq`, `asistente_whatsapp_config_id_seq`, `comentarios_id_seq`, `costeos_id_seq`, `dropkiller_config_id_seq`, `dropkiller_products_daily_id_seq`, `dropkiller_saved_products_id_seq`, `internal_messages_id_seq`, `notifications_id_seq`, `orders_id_seq`, `push_subscriptions_id_seq`, `status_catalog_id_seq`, `status_history_id_seq`, `task_handling_events_id_seq`, `tasks_id_seq`, `wallet_movements_id_seq`, `whatsapp_mensajes_entrantes_id_seq`, `whatsapp_mensajes_salientes_id_seq`.

**LIVE VERIFIED — extensiones relevantes instaladas:** `pgcrypto` versión `1.3` y `uuid-ossp` versión `1.1`, ambas en el schema `extensions`. No se alteró ninguna extensión. Esta lista corresponde a las extensiones CRM/seguridad seleccionadas para inspección, no a un inventario de todas las extensiones del proyecto.

## Enums and custom types

**LIVE VERIFIED:** nueve enums en `public`; no se encontraron domains en `public`. El orden mostrado es el orden live de `pg_enum.enumsortorder`.

- `categoria_estado_enum`: `nuevo`, `confirmado`, `guia_generada`, `en_ruta`, `novedad`, `proximo_a_llegar`, `entregado`, `cancelado`, `devolucion`, `sin_clasificar`, `en_reparto`, `recoger_oficina`, `intento_fallido`
- `estado_abandonado_enum`: `nuevo`, `contactado`, `recuperado`, `descartado`
- `estado_crm_enum`: `nuevo`, `en_ruta`, `entregado`, `cancelado`, `devolucion`
- `estado_tarea_enum`: `pendiente`, `en_progreso`, `completada`, `cancelada`
- `notificacion_tipo_enum`: `tarea_urgente_asignada`, `tarea_vencida`, `pedido_nuevo`, `novedad`, `pedido_entregado`, `pedido_devolucion`, `pedido_en_reparto`
- `pais_enum`: `CO`, `MX`
- `role_enum`: `admin`
- `tipo_movimiento_wallet_enum`: `ganancia`, `costo_flete`, `devolucion_flete`, `indemnizacion`, `comision_referido`, `retiro`, `recarga`, `correccion`, `fulfillment`, `software`, `otro`
- `tipo_tarea_enum`: `llamar_confirmacion`, `notificar_guia`, `presionar_entrega`, `notificar_proximo_llegar`, `resolver_novedad`

## Constraints and indexes

**LIVE VERIFIED:** 23 primary keys, 18 foreign keys, 10 unique constraints, 1 check constraint y 0 exclusion constraints. Las definiciones siguientes provienen de `pg_get_constraintdef`, no de SQL versionado.

| Tabla | Constraint | Tipo | Columnas | Referencia | Definición live |
| --- | --- | --- | --- | --- | --- |
| abandonados | abandonados_pais_codigo_externo_key | UNIQUE | pais, codigo_externo | — | UNIQUE (pais, codigo_externo) |
| abandonados | abandonados_pkey | PK | id | — | PRIMARY KEY (id) |
| asistente_whatsapp_config | asistente_whatsapp_config_pkey | PK | id | — | PRIMARY KEY (id) |
| comentarios | comentarios_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE |
| comentarios | comentarios_pkey | PK | id | — | PRIMARY KEY (id) |
| costeos | costeos_created_by_fkey | FK | created_by | profiles(id) | FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL |
| costeos | costeos_pkey | PK | id | — | PRIMARY KEY (id) |
| dropi_sessions | dropi_sessions_pkey | PK | pais | — | PRIMARY KEY (pais) |
| dropkiller_config | dropkiller_config_pkey | PK | id | — | PRIMARY KEY (id) |
| dropkiller_config | dropkiller_config_platform_country_code_key | UNIQUE | platform, country_code | — | UNIQUE (platform, country_code) |
| dropkiller_products_daily | dropkiller_products_daily_external_id_captured_at_key | UNIQUE | external_id, captured_at | — | UNIQUE (external_id, captured_at) |
| dropkiller_products_daily | dropkiller_products_daily_pkey | PK | id | — | PRIMARY KEY (id) |
| dropkiller_saved_products | dropkiller_saved_products_external_id_country_code_key | UNIQUE | external_id, country_code | — | UNIQUE (external_id, country_code) |
| dropkiller_saved_products | dropkiller_saved_products_pkey | PK | id | — | PRIMARY KEY (id) |
| dropkiller_saved_products | dropkiller_saved_products_saved_by_fkey | FK | saved_by | profiles(id) | FOREIGN KEY (saved_by) REFERENCES profiles(id) ON DELETE SET NULL |
| internal_messages | internal_messages_check | CHECK | remitente_id, destinatario_id | — | CHECK (remitente_id <> destinatario_id) |
| internal_messages | internal_messages_destinatario_id_fkey | FK | destinatario_id | profiles(id) | FOREIGN KEY (destinatario_id) REFERENCES profiles(id) ON DELETE CASCADE |
| internal_messages | internal_messages_pkey | PK | id | — | PRIMARY KEY (id) |
| internal_messages | internal_messages_remitente_id_fkey | FK | remitente_id | profiles(id) | FOREIGN KEY (remitente_id) REFERENCES profiles(id) ON DELETE CASCADE |
| meta_campaigns | meta_campaigns_pkey | PK | id | — | PRIMARY KEY (id) |
| notifications | notifications_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE |
| notifications | notifications_pkey | PK | id | — | PRIMARY KEY (id) |
| notifications | notifications_task_id_fkey | FK | task_id | tasks(id) | FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE |
| notifications | notifications_user_id_fkey | FK | user_id | profiles(id) | FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE |
| orders | orders_id_orden_dropi_key | UNIQUE | id_orden_dropi | — | UNIQUE (id_orden_dropi) |
| orders | orders_id_orden_shopify_key | UNIQUE | id_orden_shopify | — | UNIQUE (id_orden_shopify) |
| orders | orders_pkey | PK | id | — | PRIMARY KEY (id) |
| profiles | profiles_id_fkey | FK | id | auth.users(id) | FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE |
| profiles | profiles_pkey | PK | id | — | PRIMARY KEY (id) |
| push_subscriptions | push_subscriptions_endpoint_key | UNIQUE | endpoint | — | UNIQUE (endpoint) |
| push_subscriptions | push_subscriptions_pkey | PK | id | — | PRIMARY KEY (id) |
| push_subscriptions | push_subscriptions_user_id_fkey | FK | user_id | profiles(id) | FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE |
| shopify_webhook_events | shopify_webhook_events_pkey | PK | webhook_id | — | PRIMARY KEY (webhook_id) |
| status_catalog | status_catalog_estado_transportadora_key | UNIQUE | estado, transportadora | — | UNIQUE (estado, transportadora) |
| status_catalog | status_catalog_pkey | PK | id | — | PRIMARY KEY (id) |
| status_history | status_history_order_id_estado_registrado_en_key | UNIQUE | order_id, estado, registrado_en | — | UNIQUE (order_id, estado, registrado_en) |
| status_history | status_history_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE |
| status_history | status_history_pkey | PK | id | — | PRIMARY KEY (id) |
| task_handling_events | task_handling_events_pkey | PK | id | — | PRIMARY KEY (id) |
| task_handling_events | task_handling_events_task_id_fkey | FK | task_id | tasks(id) | FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE |
| tasks | tasks_asignado_a_fkey | FK | asignado_a | profiles(id) | FOREIGN KEY (asignado_a) REFERENCES profiles(id) ON DELETE SET NULL |
| tasks | tasks_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE |
| tasks | tasks_pkey | PK | id | — | PRIMARY KEY (id) |
| wallet_movement_catalog | wallet_movement_catalog_pkey | PK | identification_code | — | PRIMARY KEY (identification_code) |
| wallet_movements | wallet_movements_identification_code_fkey | FK | identification_code | wallet_movement_catalog(identification_code) | FOREIGN KEY (identification_code) REFERENCES wallet_movement_catalog(identification_code) |
| wallet_movements | wallet_movements_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL |
| wallet_movements | wallet_movements_pais_id_movimiento_dropi_key | UNIQUE | pais, id_movimiento_dropi | — | UNIQUE (pais, id_movimiento_dropi) |
| wallet_movements | wallet_movements_pkey | PK | id | — | PRIMARY KEY (id) |
| whatsapp_mensajes_entrantes | whatsapp_mensajes_entrantes_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL |
| whatsapp_mensajes_entrantes | whatsapp_mensajes_entrantes_pkey | PK | id | — | PRIMARY KEY (id) |
| whatsapp_mensajes_salientes | whatsapp_mensajes_salientes_order_id_fkey | FK | order_id | orders(id) | FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL |
| whatsapp_mensajes_salientes | whatsapp_mensajes_salientes_pkey | PK | id | — | PRIMARY KEY (id) |

**LIVE VERIFIED:** 66 índices, de los cuales 34 son únicos y 6 tienen predicado parcial. Las expresiones/columnas y predicados constan en la definición PostgreSQL exacta siguiente.

| Tabla | Índice | Único | Primario | Predicado | Definición live |
| --- | --- | --- | --- | --- | --- |
| abandonados | abandonados_pais_codigo_externo_key | sí | no | — | CREATE UNIQUE INDEX abandonados_pais_codigo_externo_key ON public.abandonados USING btree (pais, codigo_externo) |
| abandonados | abandonados_pkey | sí | sí | — | CREATE UNIQUE INDEX abandonados_pkey ON public.abandonados USING btree (id) |
| abandonados | idx_abandonados_estado | no | no | — | CREATE INDEX idx_abandonados_estado ON public.abandonados USING btree (pais, estado) |
| abandonados | idx_abandonados_telefono | no | no | — | CREATE INDEX idx_abandonados_telefono ON public.abandonados USING btree (telefono) |
| asistente_whatsapp_config | asistente_whatsapp_config_pkey | sí | sí | — | CREATE UNIQUE INDEX asistente_whatsapp_config_pkey ON public.asistente_whatsapp_config USING btree (id) |
| comentarios | comentarios_pkey | sí | sí | — | CREATE UNIQUE INDEX comentarios_pkey ON public.comentarios USING btree (id) |
| comentarios | idx_comentarios_order | no | no | — | CREATE INDEX idx_comentarios_order ON public.comentarios USING btree (order_id) |
| costeos | costeos_pkey | sí | sí | — | CREATE UNIQUE INDEX costeos_pkey ON public.costeos USING btree (id) |
| costeos | idx_costeos_pais | no | no | — | CREATE INDEX idx_costeos_pais ON public.costeos USING btree (pais) |
| dropi_sessions | dropi_sessions_pkey | sí | sí | — | CREATE UNIQUE INDEX dropi_sessions_pkey ON public.dropi_sessions USING btree (pais) |
| dropkiller_config | dropkiller_config_pkey | sí | sí | — | CREATE UNIQUE INDEX dropkiller_config_pkey ON public.dropkiller_config USING btree (id) |
| dropkiller_config | dropkiller_config_platform_country_code_key | sí | no | — | CREATE UNIQUE INDEX dropkiller_config_platform_country_code_key ON public.dropkiller_config USING btree (platform, country_code) |
| dropkiller_products_daily | dropkiller_products_daily_external_id_captured_at_key | sí | no | — | CREATE UNIQUE INDEX dropkiller_products_daily_external_id_captured_at_key ON public.dropkiller_products_daily USING btree (external_id, captured_at) |
| dropkiller_products_daily | dropkiller_products_daily_pkey | sí | sí | — | CREATE UNIQUE INDEX dropkiller_products_daily_pkey ON public.dropkiller_products_daily USING btree (id) |
| dropkiller_products_daily | idx_dropkiller_daily_captured | no | no | — | CREATE INDEX idx_dropkiller_daily_captured ON public.dropkiller_products_daily USING btree (captured_at DESC) |
| dropkiller_products_daily | idx_dropkiller_daily_external | no | no | — | CREATE INDEX idx_dropkiller_daily_external ON public.dropkiller_products_daily USING btree (external_id, captured_at DESC) |
| dropkiller_saved_products | dropkiller_saved_products_external_id_country_code_key | sí | no | — | CREATE UNIQUE INDEX dropkiller_saved_products_external_id_country_code_key ON public.dropkiller_saved_products USING btree (external_id, country_code) |
| dropkiller_saved_products | dropkiller_saved_products_pkey | sí | sí | — | CREATE UNIQUE INDEX dropkiller_saved_products_pkey ON public.dropkiller_saved_products USING btree (id) |
| internal_messages | idx_internal_messages_conversacion | no | no | — | CREATE INDEX idx_internal_messages_conversacion ON public.internal_messages USING btree (LEAST(remitente_id, destinatario_id), GREATEST(remitente_id, destinatario_id), created_at DESC) |
| internal_messages | internal_messages_pkey | sí | sí | — | CREATE UNIQUE INDEX internal_messages_pkey ON public.internal_messages USING btree (id) |
| meta_campaigns | idx_meta_campaigns_estado | no | no | — | CREATE INDEX idx_meta_campaigns_estado ON public.meta_campaigns USING btree (estado) |
| meta_campaigns | idx_meta_campaigns_pais | no | no | — | CREATE INDEX idx_meta_campaigns_pais ON public.meta_campaigns USING btree (pais) |
| meta_campaigns | meta_campaigns_pkey | sí | sí | — | CREATE UNIQUE INDEX meta_campaigns_pkey ON public.meta_campaigns USING btree (id) |
| notifications | idx_notifications_user_unread | no | no | (leida = false) | CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (leida = false) |
| notifications | notifications_pkey | sí | sí | — | CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id) |
| orders | idx_orders_activo | no | no | (activo = true) | CREATE INDEX idx_orders_activo ON public.orders USING btree (activo) WHERE (activo = true) |
| orders | idx_orders_estado_crm | no | no | — | CREATE INDEX idx_orders_estado_crm ON public.orders USING btree (estado_crm) |
| orders | idx_orders_estado_dropi | no | no | — | CREATE INDEX idx_orders_estado_dropi ON public.orders USING btree (estado_dropi) |
| orders | idx_orders_fecha | no | no | — | CREATE INDEX idx_orders_fecha ON public.orders USING btree (fecha) |
| orders | idx_orders_nombre_apellido | no | no | — | CREATE INDEX idx_orders_nombre_apellido ON public.orders USING btree (nombre, apellido) |
| orders | idx_orders_numero_orden | no | no | — | CREATE INDEX idx_orders_numero_orden ON public.orders USING btree (numero_orden) |
| orders | idx_orders_pais | no | no | — | CREATE INDEX idx_orders_pais ON public.orders USING btree (pais) |
| orders | idx_orders_reconciliacion_pendiente | no | no | ((activo = true) AND (tarea_generada_para_estado IS DISTINCT FROM estado_dropi)) | CREATE INDEX idx_orders_reconciliacion_pendiente ON public.orders USING btree (id) WHERE ((activo = true) AND (tarea_generada_para_estado IS DISTINCT FROM estado_dropi)) |
| orders | idx_orders_telefono | no | no | — | CREATE INDEX idx_orders_telefono ON public.orders USING btree (telefono) |
| orders | orders_id_orden_dropi_key | sí | no | — | CREATE UNIQUE INDEX orders_id_orden_dropi_key ON public.orders USING btree (id_orden_dropi) |
| orders | orders_id_orden_shopify_key | sí | no | — | CREATE UNIQUE INDEX orders_id_orden_shopify_key ON public.orders USING btree (id_orden_shopify) |
| orders | orders_pkey | sí | sí | — | CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id) |
| profiles | profiles_pkey | sí | sí | — | CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id) |
| push_subscriptions | idx_push_subscriptions_user | no | no | — | CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id) |
| push_subscriptions | push_subscriptions_endpoint_key | sí | no | — | CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint) |
| push_subscriptions | push_subscriptions_pkey | sí | sí | — | CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id) |
| shopify_webhook_events | shopify_webhook_events_pkey | sí | sí | — | CREATE UNIQUE INDEX shopify_webhook_events_pkey ON public.shopify_webhook_events USING btree (webhook_id) |
| status_catalog | status_catalog_estado_transportadora_key | sí | no | — | CREATE UNIQUE INDEX status_catalog_estado_transportadora_key ON public.status_catalog USING btree (estado, transportadora) |
| status_catalog | status_catalog_pkey | sí | sí | — | CREATE UNIQUE INDEX status_catalog_pkey ON public.status_catalog USING btree (id) |
| status_history | idx_status_history_order | no | no | — | CREATE INDEX idx_status_history_order ON public.status_history USING btree (order_id) |
| status_history | status_history_order_id_estado_registrado_en_key | sí | no | — | CREATE UNIQUE INDEX status_history_order_id_estado_registrado_en_key ON public.status_history USING btree (order_id, estado, registrado_en) |
| status_history | status_history_pkey | sí | sí | — | CREATE UNIQUE INDEX status_history_pkey ON public.status_history USING btree (id) |
| task_handling_events | idx_task_handling_events_task | no | no | — | CREATE INDEX idx_task_handling_events_task ON public.task_handling_events USING btree (task_id, opened_at DESC) |
| task_handling_events | task_handling_events_pkey | sí | sí | — | CREATE UNIQUE INDEX task_handling_events_pkey ON public.task_handling_events USING btree (id) |
| tasks | idx_tasks_asignado_a | no | no | (asignado_a IS NOT NULL) | CREATE INDEX idx_tasks_asignado_a ON public.tasks USING btree (asignado_a) WHERE (asignado_a IS NOT NULL) |
| tasks | idx_tasks_estado | no | no | — | CREATE INDEX idx_tasks_estado ON public.tasks USING btree (estado) |
| tasks | idx_tasks_fecha_limite | no | no | — | CREATE INDEX idx_tasks_fecha_limite ON public.tasks USING btree (fecha_limite) |
| tasks | idx_tasks_order | no | no | — | CREATE INDEX idx_tasks_order ON public.tasks USING btree (order_id) |
| tasks | idx_tasks_snoozed_until | no | no | (snoozed_until IS NOT NULL) | CREATE INDEX idx_tasks_snoozed_until ON public.tasks USING btree (snoozed_until) WHERE (snoozed_until IS NOT NULL) |
| tasks | tasks_pkey | sí | sí | — | CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id) |
| tasks | uq_tasks_order_tipo_abierta | sí | no | (estado = ANY (ARRAY['pendiente'::estado_tarea_enum, 'en_progreso'::estado_tarea_enum])) | CREATE UNIQUE INDEX uq_tasks_order_tipo_abierta ON public.tasks USING btree (order_id, tipo) WHERE (estado = ANY (ARRAY['pendiente'::estado_tarea_enum, 'en_progreso'::estado_tarea_enum])) |
| wallet_movement_catalog | wallet_movement_catalog_pkey | sí | sí | — | CREATE UNIQUE INDEX wallet_movement_catalog_pkey ON public.wallet_movement_catalog USING btree (identification_code) |
| wallet_movements | idx_wallet_movements_code | no | no | — | CREATE INDEX idx_wallet_movements_code ON public.wallet_movements USING btree (identification_code) |
| wallet_movements | idx_wallet_movements_order | no | no | — | CREATE INDEX idx_wallet_movements_order ON public.wallet_movements USING btree (order_id) |
| wallet_movements | idx_wallet_movements_pais_fecha | no | no | — | CREATE INDEX idx_wallet_movements_pais_fecha ON public.wallet_movements USING btree (pais, registrado_en) |
| wallet_movements | wallet_movements_pais_id_movimiento_dropi_key | sí | no | — | CREATE UNIQUE INDEX wallet_movements_pais_id_movimiento_dropi_key ON public.wallet_movements USING btree (pais, id_movimiento_dropi) |
| wallet_movements | wallet_movements_pkey | sí | sí | — | CREATE UNIQUE INDEX wallet_movements_pkey ON public.wallet_movements USING btree (id) |
| whatsapp_mensajes_entrantes | idx_whatsapp_mensajes_order | no | no | — | CREATE INDEX idx_whatsapp_mensajes_order ON public.whatsapp_mensajes_entrantes USING btree (order_id, recibido_en DESC) |
| whatsapp_mensajes_entrantes | whatsapp_mensajes_entrantes_pkey | sí | sí | — | CREATE UNIQUE INDEX whatsapp_mensajes_entrantes_pkey ON public.whatsapp_mensajes_entrantes USING btree (id) |
| whatsapp_mensajes_salientes | idx_whatsapp_mensajes_salientes_telefono | no | no | — | CREATE INDEX idx_whatsapp_mensajes_salientes_telefono ON public.whatsapp_mensajes_salientes USING btree (telefono_destino, enviado_en DESC) |
| whatsapp_mensajes_salientes | whatsapp_mensajes_salientes_pkey | sí | sí | — | CREATE UNIQUE INDEX whatsapp_mensajes_salientes_pkey ON public.whatsapp_mensajes_salientes USING btree (id) |

## Functions and RPCs

**LIVE VERIFIED:** 15 funciones `public`. `STABLE`/`VOLATILE` y `SECURITY DEFINER` provienen de `pg_proc`. Las definiciones debajo son el resultado exacto de `pg_get_functiondef` obtenido con SELECT; incluyen argumentos, retornos, lenguaje, seguridad y cuerpo. Ninguna fue ejecutada. No se encontraron patrones de credenciales en estas definiciones antes de incluirlas.

| Función | Argumentos de identidad | Retorno | Lenguaje | Volatilidad | Seguridad |
| --- | --- | --- | --- | --- | --- |
| customer_directory_v1 | p_query text, p_pais pais_enum, p_limit integer, p_offset integer | TABLE(pais pais_enum, telefono text, nombre text, apellido text, ultimo_pedido_fecha date, pedidos_pakora bigint, nivel_riesgo text, total_pedidos_cliente integer, pedidos_entregados_cliente integer, pedidos_devueltos_cliente integer, total_count bigint) | sql | STABLE | INVOKER |
| dinero_en_la_calle | — | TABLE(pais pais_enum, nombre_producto text, pedidos_por_entregar bigint, dinero_en_la_calle numeric) | sql | STABLE | INVOKER |
| dropkiller_sweet_spot_candidates | — | TABLE(external_id text, platform text, country_code text, nombre_producto text, sale_price numeric, suggested_price numeric, stock integer, total_sold_units integer, sold_units_last_7_days integer, sold_units_last_30_days integer, captured_at date, ritmo_reciente numeric, percentil_ritmo numeric, dias_con_venta_7d integer, tercio1_promedio numeric, tercio2_promedio numeric, tercio3_promedio numeric, tendencia_ratio numeric, cumple_banda_sweet_spot boolean, cumple_consistencia boolean, cumple_tendencia_ascendente boolean, es_sweet_spot boolean, dropkiller_uuid text, providers_count integer, primary_image_url text) | sql | STABLE | INVOKER |
| dropkiller_sweet_spot_candidates_scored_v3 | — | TABLE(external_id text, platform text, country_code text, nombre_producto text, sale_price numeric, suggested_price numeric, stock integer, total_sold_units integer, sold_units_last_7_days integer, sold_units_last_30_days integer, captured_at date, ritmo_reciente numeric, percentil_ritmo numeric, dias_con_venta_7d integer, tercio1_promedio numeric, tercio2_promedio numeric, tercio3_promedio numeric, tendencia_ratio numeric, cumple_banda_sweet_spot boolean, cumple_consistencia boolean, cumple_tendencia_ascendente boolean, es_sweet_spot boolean) | sql | STABLE | INVOKER |
| handle_new_user | — | trigger | plpgsql | VOLATILE | DEFINER |
| is_authenticated_active_user | — | boolean | sql | STABLE | DEFINER |
| product_order_summary | — | TABLE(pais pais_enum, nombre_producto text, total bigint, pendientes bigint, confirmados bigint, en_transito bigint, entregados bigint, cancelados bigint, devoluciones bigint, confirmados_alguna_vez bigint, pct_confirmacion numeric, pct_cancelacion numeric, pct_entrega numeric, pct_devolucion numeric) | sql | STABLE | INVOKER |
| reporte_semanal | p_date_from date, p_date_to date | TABLE(pais pais_enum, pedidos_nuevos bigint, confirmados bigint, cancelados bigint, entregas bigint, devoluciones bigint) | sql | STABLE | INVOKER |
| resolve_wallet_movement_order_id | — | trigger | plpgsql | VOLATILE | DEFINER |
| set_updated_at | — | trigger | plpgsql | VOLATILE | INVOKER |
| task_completions_by_user | p_date_from date, p_date_to date | TABLE(usuario text, tipo text, tareas_completadas bigint) | sql | STABLE | INVOKER |
| task_handling_time_by_user | p_date_from date, p_date_to date | TABLE(usuario text, tareas_medidas bigint, minutos_promedio numeric) | sql | STABLE | INVOKER |
| update_updated_at | — | trigger | plpgsql | VOLATILE | INVOKER |
| wallet_daily_summary | p_date_from date, p_date_to date | TABLE(pais pais_enum, dia date, entradas numeric, salidas numeric, neto numeric) | sql | STABLE | INVOKER |
| wallet_summary | p_date_from date, p_date_to date | TABLE(pais pais_enum, categoria tipo_movimiento_wallet_enum, tipo text, total numeric) | sql | STABLE | INVOKER |

### `public.customer_directory_v1(p_query text, p_pais pais_enum, p_limit integer, p_offset integer)`

```sql
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
$function$
```

### `public.dinero_en_la_calle()`

```sql
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
$function$
```

### `public.dropkiller_sweet_spot_candidates()`

```sql
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
$function$
```

### `public.dropkiller_sweet_spot_candidates_scored_v3()`

```sql
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
$function$
```

### `public.handle_new_user()`

```sql
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
$function$
```

### `public.is_authenticated_active_user()`

```sql
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
$function$
```

### `public.product_order_summary()`

```sql
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
$function$
```

### `public.reporte_semanal(p_date_from date, p_date_to date)`

```sql
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
$function$
```

### `public.resolve_wallet_movement_order_id()`

```sql
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
$function$
```

### `public.set_updated_at()`

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
```

### `public.task_completions_by_user(p_date_from date, p_date_to date)`

```sql
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
$function$
```

### `public.task_handling_time_by_user(p_date_from date, p_date_to date)`

```sql
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
$function$
```

### `public.update_updated_at()`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
```

### `public.wallet_daily_summary(p_date_from date, p_date_to date)`

```sql
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
$function$
```

### `public.wallet_summary(p_date_from date, p_date_to date)`

```sql
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
$function$
```

## Triggers

**LIVE VERIFIED:** siete triggers de usuario en tablas `public` y uno relevante en `auth.users`; timing/eventos y función están expresados en la definición live. No se incluyeron triggers internos de constraints.

| Tabla | Trigger | Función | Definición live |
| --- | --- | --- | --- |
| public.costeos | trg_costeos_updated_at | set_updated_at() | CREATE TRIGGER trg_costeos_updated_at BEFORE UPDATE ON costeos FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.orders | trg_orders_updated_at | set_updated_at() | CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.profiles | trg_profiles_updated_at | set_updated_at() | CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.status_catalog | trg_status_catalog_updated_at | set_updated_at() | CREATE TRIGGER trg_status_catalog_updated_at BEFORE UPDATE ON status_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.tasks | trg_tasks_updated_at | set_updated_at() | CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.wallet_movement_catalog | trg_wallet_movement_catalog_updated_at | set_updated_at() | CREATE TRIGGER trg_wallet_movement_catalog_updated_at BEFORE UPDATE ON wallet_movement_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at() |
| public.wallet_movements | trg_wallet_movements_resolve_order | resolve_wallet_movement_order_id() | CREATE TRIGGER trg_wallet_movements_resolve_order BEFORE INSERT ON wallet_movements FOR EACH ROW EXECUTE FUNCTION resolve_wallet_movement_order_id() |
| `auth.users` | `trg_on_auth_user_created` | `public.handle_new_user` | `CREATE TRIGGER trg_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()` |

## RLS and policies

**LIVE VERIFIED:** RLS está habilitado y no forzado en las 23 tablas `public`. Hay 39 políticas. `dropi_sessions` y `shopify_webhook_events` no tienen políticas; esto describe metadatos, no prueba por sí solo acceso efectivo desde una sesión concreta. No hay vistas públicas a las que aplicar la inspección de RLS.

| Tabla | Política | Comando | Roles | Modo | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- | --- |
| abandonados | authenticated users can read abandonados | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| abandonados | authenticated users can update abandonados | UPDATE | public | PERMISSIVE | is_authenticated_active_user() | — |
| asistente_whatsapp_config | authenticated users can read config | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| asistente_whatsapp_config | authenticated users can update config | UPDATE | public | PERMISSIVE | is_authenticated_active_user() | — |
| comentarios | authenticated users can read comentarios | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| comentarios | authenticated users can write comentarios | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| costeos | authenticated users can read costeos | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| costeos | authenticated users can write costeos | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| dropkiller_config | authenticated users can read dropkiller_config | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| dropkiller_products_daily | authenticated users can read dropkiller_products_daily | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| dropkiller_saved_products | authenticated users can read saved products | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| dropkiller_saved_products | authenticated users can write saved products | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| internal_messages | users can mark received messages as read | UPDATE | public | PERMISSIVE | (auth.uid() = destinatario_id) | (auth.uid() = destinatario_id) |
| internal_messages | users can read their own conversations | SELECT | public | PERMISSIVE | ((auth.uid() = remitente_id) OR (auth.uid() = destinatario_id)) | — |
| internal_messages | users can send messages as themselves | INSERT | public | PERMISSIVE | — | ((auth.uid() = remitente_id) AND is_authenticated_active_user()) |
| meta_campaigns | authenticated users can read meta campaigns | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| meta_campaigns | authenticated users can update meta campaigns | UPDATE | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| notifications | users read own notifications | SELECT | public | PERMISSIVE | (user_id = auth.uid()) | — |
| notifications | users update own notifications | UPDATE | public | PERMISSIVE | (user_id = auth.uid()) | (user_id = auth.uid()) |
| orders | authenticated users can read orders | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| orders | authenticated users can write orders | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| profiles | authenticated users can read all active profiles | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| profiles | users can update own profile | UPDATE | public | PERMISSIVE | (id = auth.uid()) | (id = auth.uid()) |
| push_subscriptions | users manage own push subscriptions | ALL | public | PERMISSIVE | (user_id = auth.uid()) | (user_id = auth.uid()) |
| status_catalog | authenticated users can read status_catalog | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| status_catalog | authenticated users can write status_catalog | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| status_history | authenticated users can read status_history | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| status_history | authenticated users can write status_history | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| task_handling_events | authenticated users can insert handling events | INSERT | public | PERMISSIVE | — | is_authenticated_active_user() |
| task_handling_events | authenticated users can read handling events | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| tasks | authenticated users can read tasks | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| tasks | authenticated users can write tasks | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| wallet_movement_catalog | authenticated users can read wallet_movement_catalog | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| wallet_movement_catalog | authenticated users can write wallet_movement_catalog | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| wallet_movements | authenticated users can read wallet_movements | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| wallet_movements | authenticated users can write wallet_movements | ALL | public | PERMISSIVE | is_authenticated_active_user() | is_authenticated_active_user() |
| whatsapp_mensajes_entrantes | authenticated users can read whatsapp messages | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |
| whatsapp_mensajes_salientes | authenticated users can insert sent messages | INSERT | public | PERMISSIVE | — | is_authenticated_active_user() |
| whatsapp_mensajes_salientes | authenticated users can read sent messages | SELECT | public | PERMISSIVE | is_authenticated_active_user() | — |

## Grants and database roles

**LIVE VERIFIED:** entre los roles no `pg_%` están `anon`, `authenticated`, `authenticator`, `cli_login_postgres`, `dashboard_user`, `postgres`, `service_role` y los roles estándar `supabase_*` (`admin`, `auth_admin`, `etl_admin`, `privileged_role`, `read_only_user`, `realtime_admin`, `replication_admin`, `storage_admin`). No existe `crm_mcp_reader` ni otro rol con prefijo `crm_` en `pg_roles` al momento de la consulta. `service_role` y `postgres` tienen `rolbypassrls = true`; `anon` y `authenticated`, false. Los roles no se modificaron.
- **LIVE VERIFIED:** `public` concede `USAGE` directamente a `anon`, `authenticated`, `service_role` y `postgres`; `pg_database_owner` tiene `CREATE` y `USAGE`.
- **LIVE VERIFIED:** las 23 tablas `public` conceden directamente a cada uno de `anon`, `authenticated`, `service_role` y `postgres` los siete privilegios `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE` (23 × 4 × 7 = 644 grants observados). RLS sigue habilitado para las operaciones por fila a las que aplica; grants no equivalen a visibilidad de filas.
- **LIVE VERIFIED:** cada una de las 15 funciones `public` tiene `EXECUTE` concedido directamente a esos cuatro roles; además las 15 tienen `EXECUTE` concedido a `PUBLIC` en su ACL. Esto no equivale a haber invocado ninguna función ni a demostrar acceso HTTP exitoso.
- **LIVE VERIFIED:** las 18 secuencias `public` listadas arriba conceden `USAGE` a `anon`, `authenticated`, `service_role` y `postgres` según `information_schema.role_usage_grants`.
- **LIVE VERIFIED:** para los roles relevantes, `authenticator` es miembro de `anon`, `authenticated` y `service_role`; `postgres` también figura como miembro con `admin_option` en los tres. No se consultaron contraseñas ni credenciales.

## status_catalog

**LIVE VERIFIED:** 185 filas; columnas live: `id`, `notas`, `activo`, `estado`, `categoria`, `created_at`, `updated_at`, `transportadora`. Todas las filas tienen `activo = true`. No existe columna `pais` en esta tabla live; por tanto no aplica distribución por país.

| categoria | Filas |
| --- | ---: |
| `cancelado` | 12 |
| `confirmado` | 2 |
| `devolucion` | 25 |
| `en_reparto` | 10 |
| `en_ruta` | 41 |
| `entregado` | 18 |
| `guia_generada` | 1 |
| `intento_fallido` | 3 |
| `novedad` | 13 |
| `nuevo` | 5 |
| `proximo_a_llegar` | 7 |
| `recoger_oficina` | 7 |
| `sin_clasificar` | 41 |

- `sin_clasificar`: **41**. Filas genéricas con `transportadora IS NULL`: **23**.
- Dos pares `(estado, transportadora)` duplicados, ambos genéricos: `EN CIUDAD DE ORIGEN DEVOLUCIÓN` + `NULL` (IDs 259, 261, ambos `devolucion`) y `ENTRADA A CENTRO DE DISTRIBUCION` + `NULL` (IDs 260, 262, ambos `en_ruta`). No se observaron otros pares duplicados. La constraint `UNIQUE (estado, transportadora)` permite varios `NULL` en PostgreSQL; no se modificó ninguna clasificación.
- **ANALYSIS (normalización no aplicada por la constraint live):** al comparar `estado`/`transportadora` con `casefold()` y espacios extremos removidos aparecen cuatro pares adicionales que difieren solo por mayúsculas/minúsculas de transportadora: IDs 60/229 (`EN TERMINAL DESTINO`, `Coordinadora`/`COORDINADORA`), 61/233 (`EN REPARTO`), 64/251 (`EN PUNTO DROOP`) y 105/216 (`RECLAME EN OFICINA`, `Interrapidisimo`/`INTERRAPIDISIMO`). El par 60/229 tiene categorías distintas (`en_ruta` y `proximo_a_llegar`); los otros tres conservan la misma categoría. No son duplicados exactos bajo la comparación case-sensitive de la constraint. No hay `estado` ni `transportadora` no nulos con texto vacío, ni categorías nulas.
- Los 185 registros siguientes contienen todas las columnas y están ordenados por `id` ascendente. Son datos de catálogo/configuración permitidos para esta auditoría, no filas de pedidos o clientes.

```jsonl
{"activo":true,"categoria":"nuevo","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PENDIENTE CONFIRMACION","id":1,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"confirmado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PENDIENTE","id":2,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"guia_generada","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"GUIA_GENERADA","id":3,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"GUIA_ANULADA","id":4,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CANCELADO","id":5,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RECHAZADO","id":6,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADO","id":7,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVOLUCION","id":8,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NOVEDAD SOLUCIONADA","id":9,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PREPARADO PARA TRANSPORTADORA","id":10,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INDEMNIZADA POR DROPI","id":11,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVOLUCION EN TRANSITO","id":12,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADO A TRANSPORTADORA","id":13,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN BODEGA DROPI","id":14,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RECOGIDO POR DROPI","id":15,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RECIBIDO PAU","id":16,"notas":null,"transportadora":null,"updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RECIBIDO POR DROPI","id":17,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"FINALIZADO POR RETENCION","id":18,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PROCESO FINALIZADO","id":19,"notas":null,"transportadora":null,"updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INGRESO AL CENTRO LOGISTICO","id":20,"notas":null,"transportadora":"Servientrega","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN ZONA DE DISTRIBUCION","id":21,"notas":null,"transportadora":"Servientrega","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGA VERIFICADA","id":22,"notas":null,"transportadora":"Servientrega","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"SALIO A CIUDAD DESTINO","id":23,"notas":null,"transportadora":"Servientrega","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"REPORTADO ENTREGADO","id":24,"notas":null,"transportadora":"Servientrega","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"GUIA NO EXISTE","id":56,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"A RECIBIR POR COORDINADORA","id":57,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TERMINAL ORIGEN","id":58,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TRANSPORTE","id":59,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TERMINAL DESTINO","id":60,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN REPARTO","id":61,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA","id":62,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CERRADO POR INCIDENCIA, VER CAUSA","id":63,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN PUNTO DROOP","id":64,"notas":null,"transportadora":"Coordinadora","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENVÍO ADMITIDO","id":65,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INGRESADO A BODEGA","id":66,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"VIAJANDO EN RUTA NACIONAL","id":67,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"VIAJANDO EN RUTA REGIONAL","id":68,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PARA RECLAMAR EN OFICINA","id":69,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCIÓN URBANA","id":70,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN PROCESO DE DEVOLUCIÓN","id":71,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"intento_fallido","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN CONFIRMACIÓN TELEFÓNICA","id":72,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVUELTO AL REMITENTE","id":73,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGA EXITOSA","id":74,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"intento_fallido","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PARA NUEVO INTENTO ENTREGA","id":75,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PRUEBA DE ENTREGA DIGITALIZADA","id":76,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN INVESTIGACIÓN","id":77,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DOCUMENTO ANULADA","id":78,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PRUEBA DE ENTREGA ARCHIVADA","id":79,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DISPOSICIÓN FINAL","id":80,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DESPACHADO PARA BODEGA","id":81,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INCAUTADO POR AUTORIDADES","id":82,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PARA BODEGA FINAL/CUSTODIA","id":83,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NO LLEGO EL ENVÍO FÍSICO","id":84,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"FACTURADO","id":85,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NOTA CRÉDITO","id":86,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN AUDITORIA EN TERRENO","id":87,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVOLUCIÓN POR CONFIRMACIÓN DEL CLIENTE","id":88,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCION URBANA AGENCIA","id":89,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"PARA DEVOLVER AL REMITENTE","id":90,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN BODEGA FINAL/CUSTODIA","id":91,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ADMITIDA","id":92,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CENTRO ACOPIO","id":93,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"TRANSITO NACIONAL","id":94,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"TRANSITO REGIONAL","id":95,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"TELEMERCADEO","id":96,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVOLUCIÓN RATIFICADA","id":97,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA","id":98,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ANULADA","id":99,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"TRANSITO URBANO","id":100,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INCAUTADO","id":101,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DISTRIBUCIÓN","id":102,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ARCHIVADA","id":103,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DIGITALIZADA","id":104,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RECLAME EN OFICINA","id":105,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"REPARTO","id":106,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"REENVIO","id":107,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"intento_fallido","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INTENTO DE ENTREGA","id":108,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T23:27:41.014834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENVO ADMITIDO","id":109,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCIN URBANA","id":110,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN PROCESO DE DEVOLUCIN","id":111,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN CONFIRMACIN TELEFNICA","id":112,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DISPOSICIN FINAL","id":113,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NO LLEGO EL ENVO FSICO","id":114,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NOTA CRDITO","id":115,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVOLUCIN RATIFICADA","id":116,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DISTRIBUCIN","id":117,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DISTRIBUCION","id":118,"notas":null,"transportadora":"Interrapidisimo","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"GUIA GENERADA","id":166,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"AGENDADO","id":167,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN ALISTAMIENTO EN OFICINA DE ORIGEN","id":168,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCION","id":169,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TRANSITO A CIUDAD DESTINO","id":170,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"LLEGO A OFICINA DE DESTINO","id":171,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"REAGENDADO","id":172,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADO","id":173,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"NO ENTREGADO","id":174,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CASO CERRADO","id":175,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ANULADA","id":176,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DEVUELTA A REMITENTE","id":177,"notas":null,"transportadora":"SUPPLI-EXPRESS-ESM","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN AEROLINEA DE MIAMI","id":178,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN AEROLINEA DE COLOMBIA","id":179,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN PROCESO DE INSPECCION ADUANERA","id":180,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"MERCANCIA NACIONALIZADA","id":181,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DESPACHO","id":182,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CARGADA","id":183,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"DIGITADA","id":184,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"MERCANCIA RECOGIDA","id":185,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TRASLADO NACIONAL","id":186,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN RECIBO","id":187,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCION","id":188,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA A CONEXIONES","id":189,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA","id":190,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA CON BOOMERANG","id":191,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"RELACIONADA PARA DEVOLVER BOOMERANG","id":192,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN TRASLADO NACIONAL CON BOOMERANG","id":193,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN BODEGA ORIGEN CON BOOMERANG","id":194,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DISTRIBUCION CON BOOMERANG","id":195,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"CUMPLIDO CON DEVOLUCION PARCIAL","id":196,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"MERCANCÍA EN PROCESO DE INDEMNIZACIÓN","id":197,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INDEMNIZACIÓN PAGADA","id":198,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"INDEMNIZACIÓN NEGADA","id":199,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ENTREGADA PARCIALMENTE","id":200,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"MERCANCÍA RETENIDA POR LA DIAN","id":201,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN DEVOLUCIÓN","id":202,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"EN CONTINUACION","id":203,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"sin_clasificar","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"REEMPLAZADA","id":204,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-01T20:57:10.86368+00:00","estado":"ANULADA","id":205,"notas":null,"transportadora":"TCC","updated_at":"2026-07-01T20:57:10.86368+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":206,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"SALIDA DE CENTRO DE DISTRIBUCION","id":207,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"CANCELADO","id":208,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":209,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"nuevo","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"PENDIENTE CONFIRMACION","id":210,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":211,"notas":"clasificado con datos reales de producción","transportadora":"ENVIA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ASIGNADO A MENSAJERO","id":212,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"CANCELADO","id":213,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"RECEPCION CENTRO DE ENTREGA","id":214,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"NOVEDAD SOLUCIONADA","id":215,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"RECLAME EN OFICINA","id":216,"notas":"clasificado con datos reales de producción","transportadora":"INTERRAPIDISIMO","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":217,"notas":"clasificado con datos reales de producción","transportadora":"INTERRAPIDISIMO","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"NOVEDAD","id":218,"notas":"clasificado con datos reales de producción","transportadora":"QUALITY-POST","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"NOVEDAD SOLUCIONADA","id":219,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"CANCELADO","id":220,"notas":"clasificado con datos reales de producción","transportadora":"INTERRAPIDISIMO","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"CANCELADO","id":221,"notas":"clasificado con datos reales de producción","transportadora":"ENVIA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"DEVOLUCION","id":222,"notas":"clasificado con datos reales de producción","transportadora":"INTERRAPIDISIMO","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":223,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"CANCELADO","id":224,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"SALIDA DE INSTALACIONES CIRCUITO","id":225,"notas":"clasificado con datos reales de producción","transportadora":"AMPM","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"nuevo","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"PENDIENTE CONFIRMACION","id":226,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"nuevo","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"PENDIENTE CONFIRMACION","id":227,"notas":"clasificado con datos reales de producción","transportadora":"AMPM","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"EMBARQUE DE CARGA","id":228,"notas":"clasificado con datos reales de producción","transportadora":"AMPM","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"EN TERMINAL DESTINO","id":229,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"nuevo","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"PENDIENTE CONFIRMACION","id":230,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"NOVEDAD","id":231,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"entregado","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"ENTREGADO","id":232,"notas":"clasificado con datos reales de producción","transportadora":"AMPM","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"EN REPARTO","id":233,"notas":"clasificado con datos reales de producción","transportadora":"COORDINADORA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"EN BODEGA ORIGEN","id":234,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"NOVEDAD","id":235,"notas":"clasificado con datos reales de producción","transportadora":"ENVIA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"DESPACHADA","id":236,"notas":"clasificado con datos reales de producción","transportadora":"ENVIA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"DEVOLUCION","id":237,"notas":"clasificado con datos reales de producción","transportadora":"ENVIA","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"DEVOLUCION","id":238,"notas":"clasificado con datos reales de producción","transportadora":"AFIMEX","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-02T15:09:17.352282+00:00","estado":"EN RUTA","id":239,"notas":"clasificado con datos reales de producción","transportadora":"VELOCES","updated_at":"2026-07-02T15:09:17.352282+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"PAQUETE EN DEVOLUCION","id":240,"notas":"clasificado con datos reales MX","transportadora":"QUALITY-POST","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"EN PROCESO DE DEVOLUCION","id":241,"notas":"clasificado con datos reales MX","transportadora":"VELOCES","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"RECEPCION","id":242,"notas":"clasificado con datos reales MX","transportadora":"QUALITY-POST","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"DESEMBARQUE DE CARGA","id":243,"notas":"clasificado con datos reales MX","transportadora":"AMPM","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"BODEGA DESTINO","id":244,"notas":"clasificado con datos reales MX","transportadora":"VELOCES","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"en_reparto","created_at":"2026-07-06T03:27:40.429834+00:00","estado":"EN REPARTO","id":245,"notas":"clasificado con datos reales MX","transportadora":"AMPM","updated_at":"2026-07-06T03:27:40.429834+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-10T00:53:59.884086+00:00","estado":"DEVOLUCION","id":246,"notas":"clasificado con datos reales CO — encontrado vía reporte por producto","transportadora":"COORDINADORA","updated_at":"2026-07-10T00:53:59.884086+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"DEVOLUCION","id":247,"notas":"clasificado con datos reales — reporte por producto","transportadora":"AMPM","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"DEVOLUCION EN PROCESO","id":248,"notas":"clasificado con datos reales — reporte por producto","transportadora":"QUALITY-POST","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"PREPARADO PARA TRANSPORTADORA","id":249,"notas":"clasificado con datos reales — reporte por producto","transportadora":"QUALITY-POST","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"confirmado","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"PENDIENTE","id":250,"notas":"clasificado con datos reales — reporte por producto","transportadora":"QUALITY-POST","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"recoger_oficina","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"EN PUNTO DROOP","id":251,"notas":"clasificado con datos reales — reporte por producto","transportadora":"COORDINADORA","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"cancelado","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"CANCELADO","id":252,"notas":"clasificado con datos reales — reporte por producto","transportadora":"AMPM","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"EN CIUDAD DE ORIGEN","id":253,"notas":"clasificado con datos reales — transportadora TIUI nunca vista antes","transportadora":"TIUI","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"proximo_a_llegar","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"EN BODEGA DESTINO","id":254,"notas":"clasificado con datos reales — reporte por producto","transportadora":"ENVIA","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"NOVEDAD","id":255,"notas":"clasificado con datos reales — reporte por producto","transportadora":"COORDINADORA","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"EN PROCESO DE DEVOLUCION","id":256,"notas":"clasificado con datos reales — reporte por producto","transportadora":"AMPM","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"EN CAMINO A CIUDAD DE DESTINO","id":257,"notas":"clasificado con datos reales — transportadora TIUI nunca vista antes","transportadora":"TIUI","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-10T00:55:18.618395+00:00","estado":"DEVOLUCION EN BODEGA","id":258,"notas":"clasificado con datos reales — reporte por producto","transportadora":"VELOCES","updated_at":"2026-07-10T00:55:18.618395+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-26T16:40:52.29423+00:00","estado":"EN CIUDAD DE ORIGEN DEVOLUCIÓN","id":259,"notas":"clasificado con datos reales MX","transportadora":null,"updated_at":"2026-07-26T16:40:52.29423+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-26T16:40:52.29423+00:00","estado":"ENTRADA A CENTRO DE DISTRIBUCION","id":260,"notas":"clasificado con datos reales MX","transportadora":null,"updated_at":"2026-07-26T16:40:52.29423+00:00"}
{"activo":true,"categoria":"devolucion","created_at":"2026-07-26T16:43:20.854802+00:00","estado":"EN CIUDAD DE ORIGEN DEVOLUCIÓN","id":261,"notas":"clasificado con datos reales MX","transportadora":null,"updated_at":"2026-07-26T16:43:20.854802+00:00"}
{"activo":true,"categoria":"en_ruta","created_at":"2026-07-26T16:43:20.854802+00:00","estado":"ENTRADA A CENTRO DE DISTRIBUCION","id":262,"notas":"clasificado con datos reales MX","transportadora":null,"updated_at":"2026-07-26T16:43:20.854802+00:00"}
{"activo":true,"categoria":"novedad","created_at":"2026-07-26T16:45:58.814266+00:00","estado":"NOVEDAD","id":263,"notas":"clasificado con datos reales MX","transportadora":"AMPM","updated_at":"2026-07-26T16:45:58.814266+00:00"}
```

## wallet_movement_catalog

**LIVE VERIFIED:** 75 filas; columnas live: `nombre`, `categoria`, `created_at`, `updated_at`, `identification_code`. `identification_code` es primary key; no hay códigos duplicados ni códigos nulos/vacíos en las 75 filas.

| categoria | Filas |
| --- | ---: |
| `comision_referido` | 1 |
| `correccion` | 14 |
| `costo_flete` | 5 |
| `devolucion_flete` | 5 |
| `fulfillment` | 2 |
| `ganancia` | 5 |
| `indemnizacion` | 10 |
| `otro` | 9 |
| `recarga` | 6 |
| `retiro` | 7 |
| `software` | 11 |

Los 75 registros siguientes contienen todas las columnas y están ordenados por `identification_code` ascendente. No se reclasificó ningún movimiento.

```jsonl
{"categoria":"costo_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1000","nombre":"SALIDA POR NUEVA ORDEN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1001","nombre":"ENTRADA POR CAMBIO DE ESTATUS","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"ganancia","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1002","nombre":"ENTRADA POR GANANCIA EN LA ORDEN COMO DROPSHIPPER","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"devolucion_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1003","nombre":"DEVOLUCION DE FLETE ORDEN ENTREGADA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1004","nombre":"SALIDA POR CORRECCION DE ESTADO DE GUIA PAGO POR COMISION DE REFERIDOS","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"comision_referido","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1005","nombre":"PAGO POR COMISION DE REFERIDOS","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"ganancia","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1006","nombre":"ENTRADA POR GANANCIA EN LA ORDEN COMO PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"ganancia","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1007","nombre":"PAGO POR GANANCIA FLETE DE MARCA BLANCA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"ganancia","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1008","nombre":"PAGO POR GANANCIA COMISION DROPSHIPPER DE MARCA BLANCA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1009","nombre":"SALIDA POR CORRECCION DE ESTADO DE GUIA COMO PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1010","nombre":"SALIDA POR CORRECCION DE ESTADO DE GUIA COMO DROPSHIPPER","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1011","nombre":"SALIDA POR CORRECCION DE ESTADO DE GUIA, FLETE","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1012","nombre":"SALIDA POR CORRECCION DE ESTADO DE GUIA, MONTO INICIAL COBRADO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"devolucion_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1013","nombre":"DEVOLUCION DE FLETE POR ENTREGA NO EFECTIVA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"devolucion_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1014","nombre":"SALIDA DE COBRO DE DEVOLUCION POR ENTREGA NO EFECTIVA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"devolucion_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1015","nombre":"SALIDA DE COBRO DE DEVOLUCION POR ENTREGA NO EFECTIVA, MARCA BLANCA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1016","nombre":"SALIDA POR CORRECCION, ORDEN RECHAZADO A ENTREGADO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1017","nombre":"CORRECCION DE SALDO DE CARTERA COMO DROPSHIPPER","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1018","nombre":"CORRECCION DE SALDO DE CARTERA DE FLETE","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1019","nombre":"CORRECCION DE SALDO DE CARTERA COMO PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1020","nombre":"SALIDA POR PETICION DE RETIRO DE SALDO EN CARTERA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1021","nombre":"ENTRADA POR SOLICITUD DE RETIRO DE CARTERA NEGADA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1022","nombre":"ENTRADA POR RECARGA DE SALDO EN CARTERA, POR ADMIN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1023","nombre":"SALIDA POR RECARGA DE SALDO EN CARTERA AL USUARIO POR SUPER ADMIN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1024","nombre":"ENTRADA POR RETIRO DE SALDO EN CARTERA AL USUARIO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1025","nombre":"ENTRADA POR RETIRO ADMIN EN USER","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1026","nombre":"RET. ADMIN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1027","nombre":"ENVÍO DE SMS","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1028","nombre":"ENVÍO DE VOICE","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1029","nombre":"DEVOLUCIÓN POR FALLO DE ENVÍO DE SMS","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1030","nombre":"ENTRADA POR TRANSFERENCIA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1031","nombre":"SALIDA POR TRANSFERENCIA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"devolucion_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1034","nombre":"SALIDA POR DEVOLUCION DE FLETE, CAMBIO DE TRANSPORTADORA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"ganancia","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1036","nombre":"PAGO POR INCREMENTO PRECIO PRODUCTO PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1038","nombre":"SALIDA POR RECARGA DE TARJETA DE CREDITO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"retiro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1039","nombre":"ENTRADA POR RETIRO DE TARJETA DE CREDITO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1040","nombre":"COBRO DE FLETE POR ORDEN(GARANTIA)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1041","nombre":"INDEMNIZACION POR INCUMPLIMIENTO DE GARANTIA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1042","nombre":"COBRO DE DEVOLUCION DE DINERO POR ORDEN(GARANTIA)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1043","nombre":"DEVOLUCION DE DINERO AL DROPSHIPPER POR UNA ORDEN(GARANTIA)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1044","nombre":"ENTRADA POR INDEMNIZACION DE ORDEN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1045","nombre":"SALIDA POR COBRO MANTENIMIENTO TARJETA DE CREDITO MENSUAL","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1046","nombre":"DEVOLUCION DE DINERO POR GARANTIA INDEMINZADA POR PARTE DEL PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1047","nombre":"COBRO DE FLETE POR RECOLECCION DE GARANTIA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1051","nombre":"SALIDA POR CORRECCION DE ORDEN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1052","nombre":"SALIDA POR INDEMNIZACION DE ORDEN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1053","nombre":"CORRECCION POR COBRO DE DEVOLUCION","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"costo_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1054","nombre":"PAGO POR INCREMENTO DE FLETE DUEÑO DE COMUNIDAD","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"fulfillment","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1055","nombre":"PAGO POR FULFILLMENT, ORDEN ID:","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1056","nombre":"REVERSION DE INDEMNIZACION POR INCUMPLIMIENTO DE GARANTIA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"indemnizacion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1057","nombre":"REVERSION DE INDEMNIZACION POR GARANTIA INDEMINZADA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1058","nombre":"REVERSION POR CORRECCION DROPI CARD","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-14T19:18:48.157209+00:00","identification_code":"1068","nombre":"RECARGA DE WALLET A TRAVES DE PASARELA DE PAGO (INFERIDO, no está en la lista oficial de Dropi)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"fulfillment","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1069","nombre":"SALIDA POR FULFILLMENT, ORDEN ID:","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"correccion","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1081","nombre":"CORRECCION DE PAGO POR INCREMENTO DE FLETE DUEÑO DE COMUNIDAD","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"costo_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1084","nombre":"ACUMULADO PARA PAGO A TRANSPORTADORA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"costo_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1085","nombre":"GANANCIA DROPI POR FLETE","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1086","nombre":"GANANCIA DROPI COMISION DROPSHIPPER POR PRODUCTO","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1087","nombre":"GANANCIA DROPI INCREMENTO AL PRECIO DE PROVEEDOR","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"costo_flete","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1088","nombre":"PAGO DE FLETE POR MERCANCIA EN DISPOSICION DEFINITIVA DE LA AUTORIDAD COMPETENTE (FINALIZADO POR RETENCION)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1089","nombre":"DEBITO AL PROVEEDOR: Descuento de comision generada por negociacion exitosa con lider de comunidad","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1090","nombre":"CREDITO AL LIDER: Abono de comision recibida por negociacion exitosa como lider de comunidad","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1091","nombre":"DEBITO AL LIDER: Reversion de comision abonada al lider por anulacion de negociacion","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1092","nombre":"CREDITO AL PROVEEDOR: Devolucion del monto debitado por comision ante anulacion de negociacion","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1093","nombre":"GANANCIA DROPI LLC","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1094","nombre":"COBRO POR CREACION DE PAGINA DE PRODUCTO (PAGE BUILDER)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1095","nombre":"REEMBOLSO POR FALLO EN CREACION DE PAGINA DE PRODUCTO (PAGE BUILDER)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1096","nombre":"COBRO POR IMPORTACION DE PAGINA A TIENDA SHOPIFY (PAGE BUILDER)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1097","nombre":"REEMBOLSO POR FALLO EN IMPORTACION A TIENDA SHOPIFY (PAGE BUILDER)","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1098","nombre":"USO DE SOFTWARE FENIX VENTURE - ENTREGA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1099","nombre":"PAGO POR USO DE SOFTWARE - ENTREGA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1100","nombre":"DEVOLUCION USO DE SOFTWARE FENIX VENTURE - ENTREGA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"software","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1101","nombre":"DEVOLUCION RETIRO POR USO DE SOFTWARE - ENTREGA","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"otro","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"1102","nombre":"COBRO 4X1000","updated_at":"2026-07-14T19:18:48.157209+00:00"}
{"categoria":"recarga","created_at":"2026-07-01T20:57:10.86368+00:00","identification_code":"3001","nombre":"ENTRADA POR INGRESO DE CREDITO, POR ADMIN","updated_at":"2026-07-14T19:18:48.157209+00:00"}
```

## Live DB vs database.types.ts

- **REPOSITORY VERIFIED:** el archivo versionado declara 21 tablas, 0 vistas, 10 funciones y 9 enums. No se regeneró ni alteró.
- **DIFFERENCE:** tablas live ausentes de tipos: `internal_messages`, `meta_campaigns`. Tablas tipadas no encontradas live: ninguna.
- **DIFFERENCE:** columna live ausente de tipos: `orders.pausar_tareas_automaticas boolean NOT NULL DEFAULT false`, re-verificada mediante un SELECT de metadatos de esa sola columna. Columnas tipadas no encontradas live: ninguna.
- **DIFFERENCE:** el archivo de tipos actualmente versionado no lista cinco funciones live: `customer_directory_v1`, `handle_new_user`, `resolve_wallet_movement_order_id`, `set_updated_at`, `update_updated_at`. `customer_directory_v1` es un RPC invocado por la aplicación y falta en los tipos API versionados; las otras cuatro retornan `trigger` y son funciones de trigger de PostgreSQL. Funciones tipadas no encontradas live: ninguna.
- **LIVE VERIFIED + REPOSITORY VERIFIED:** los nueve enums coinciden exactamente en nombres, valores y orden. En las 21 tablas comunes no se detectaron diferencias obvias de nullabilidad o mapeo escalar PostgreSQL→TypeScript; tampoco diferencias obvias de nombres de campos de retorno en las funciones tipadas comunes. Esta comparación estructural no reemplaza una regeneración de tipos soportada.
- **NOT VERIFIED:** una comparación textual contra tipos generados nuevamente por CLI, porque no hay `supabase` CLI configurada en este entorno; no se creó un archivo temporal de tipos.
- **NOT VERIFIED:** si las cuatro funciones de trigger aparecerían en una generación nueva y soportada de tipos Supabase. Fase 3 no debe agregarlas manualmente a `database.types.ts` basándose solo en esta auditoría.

## Live DB vs version-controlled SQL

- **REPOSITORY VERIFIED:** únicamente `supabase/dropkiller_sweet_spot_candidates_add_uuid.sql` y `supabase/dropkiller_sweet_spot_candidates_fix_search_path.sql` están versionados como SQL bajo `supabase/`. Ambos son parches manuales del wrapper `public.dropkiller_sweet_spot_candidates()`; el primero depende de la función base `dropkiller_sweet_spot_candidates_scored_v3()` o de la función previa y el segundo vuelve a reemplazar el wrapper. Incluyen instrucciones mutantes históricas, que **no se ejecutaron** durante esta auditoría.
- **DIFFERENCE:** ninguno de los dos archivos es un baseline autónomo para crear las 23 tablas, 9 enums, 18 secuencias, 52 constraints, 66 índices, 15 funciones completas, 8 triggers observados (7 `public` + 1 `auth.users`), 39 políticas ni los 260 registros de catálogo. El wrapper Dropkiller está parcialmente representado como transformación, pero su función base, las tablas y su definición exacta actual no pueden reconstruirse con esos parches solos.
- **DIFFERENCE:** no hay artefacto SQL versionado suficiente para reconstruir RLS/grants, `internal_messages`, `meta_campaigns`, `customer_directory_v1`, la columna `orders.pausar_tareas_automaticas`, los RPC financieros/de productividad/reporting, notificaciones o la recepción de webhooks Shopify.

## Application references vs live DB

**REPOSITORY VERIFIED:** búsqueda de literales `.from(...)` y `.rpc(...)` en `src/` y `mcp-server/src/`; las referencias no literales no se pueden enumerar con este método. Todas las 21 tablas y 9 funciones invocadas de forma literal por `src/` se encontraron live. `mcp-server/src/` referencia directamente los RPC `dinero_en_la_calle`, `product_order_summary`, `wallet_daily_summary` y `wallet_summary`, también live. Su allowlist dinámica en `mcp-server/src/supabase.ts` incluye además las tablas `orders`, `status_catalog`, `status_history` y `tasks`; las cuatro existen live y en tipos, pero no tienen SQL completo versionado. La columna de SQL indica reconstrucción completa desde los dos archivos, no simple mención.

| Tipo | Objeto | Referencias literales | Ejemplo en repo | Live | Tipos | SQL completo |
| --- | --- | ---: | --- | --- | --- | --- |
| from | abandonados | 5 | `src/lib/whatsapp/generateAbandonadoRecoveryMessage.ts:118` | sí | sí | no |
| from | asistente_whatsapp_config | 3 | `src/lib/orders/getFullOrderContext.ts:567` | sí | sí | no |
| from | comentarios | 2 | `src/app/api/orders/[id]/route.ts:69` | sí | sí | no |
| from | costeos | 12 | `src/app/(app)/costeos/actions.ts:181` | sí | sí | no |
| from | dropi_sessions | 2 | `src/lib/dropi/getDropiSession.ts:130` | sí | sí | no |
| from | dropkiller_config | 1 | `src/app/api/cron/dropkiller-sync/route.ts:87` | sí | sí | no |
| from | dropkiller_products_daily | 3 | `src/lib/dropkiller/searchDropkillerProduct.ts:193` | sí | sí | no |
| from | dropkiller_saved_products | 3 | `src/app/(app)/command-center/investigacion/actions.ts:92` | sí | sí | no |
| from | internal_messages | 5 | `src/components/chat/InternalChatDrawer.tsx:435` | sí | no | no |
| from | meta_campaigns | 15 | `src/lib/meta/evaluateAutopause.ts:131` | sí | no | no |
| from | notifications | 13 | `src/lib/tasks/processOrderEvent.ts:445` | sí | sí | no |
| from | orders | 35 | `src/lib/tasks/checkStaleOrders.ts:160` | sí | sí | no |
| from | profiles | 13 | `src/lib/tasks/processOrderEvent.ts:421` | sí | sí | no |
| from | shopify_webhook_events | 2 | `src/app/api/webhooks/shopify/[country]/route.ts:225` | sí | sí | no |
| from | status_catalog | 10 | `src/lib/tasks/checkStaleOrders.ts:56` | sí | sí | no |
| from | status_history | 5 | `src/lib/tasks/processOrderHistory.ts:68` | sí | sí | no |
| from | task_handling_events | 1 | `src/app/(app)/tareas/actions.ts:156` | sí | sí | no |
| from | tasks | 27 | `src/lib/tasks/checkStaleOrders.ts:204` | sí | sí | no |
| from | wallet_movements | 2 | `src/app/api/cron/dropi-sync-co/route.ts:83` | sí | sí | no |
| from | whatsapp_mensajes_entrantes | 6 | `src/lib/whatsapp/generateAbandonadoRecoveryMessage.ts:153` | sí | sí | no |
| from | whatsapp_mensajes_salientes | 5 | `src/lib/whatsapp/generateAbandonadoRecoveryMessage.ts:186` | sí | sí | no |
| rpc | customer_directory_v1 | 1 | `src/lib/clientes/getCustomerDirectory.ts:244` | sí | no | no |
| rpc | dinero_en_la_calle | 3 | `src/lib/hoy/getTodaySummary.ts:350` | sí | sí | no |
| rpc | dropkiller_sweet_spot_candidates | 2 | `src/app/(app)/command-center/investigacion/page.tsx:111` | sí | sí | no |
| rpc | product_order_summary | 4 | `src/app/(app)/command-center/metricas/page.tsx:7` | sí | sí | no |
| rpc | reporte_semanal | 1 | `src/app/api/cron/reporte-semanal/route.ts:170` | sí | sí | no |
| rpc | task_completions_by_user | 1 | `src/app/(app)/command-center/productividad/page.tsx:95` | sí | sí | no |
| rpc | task_handling_time_by_user | 1 | `src/app/(app)/command-center/productividad/page.tsx:105` | sí | sí | no |
| rpc | wallet_daily_summary | 2 | `src/app/(app)/command-center/finanzas/page.tsx:219` | sí | sí | no |
| rpc | wallet_summary | 2 | `src/app/(app)/command-center/finanzas/page.tsx:244` | sí | sí | no |

**REPOSITORY VERIFIED — campos/tipos extendidos manualmente:** `src/lib/tasks/processOrderEvent.ts`, `src/lib/tasks/checkStaleOrders.ts`, `src/lib/tasks/checkConfirmationFollowups.ts` y `src/app/(app)/tareas/actions.ts` consumen `orders.pausar_tareas_automaticas` mediante extensiones/casts; `src/app/(app)/chat-actions.ts` y `src/components/chat/InternalChatDrawer.tsx` extienden tipos para `internal_messages`; `src/app/(app)/command-center/campanias/` y `src/lib/meta/evaluateAutopause.ts` hacen lo propio con `meta_campaigns`; `src/lib/clientes/getCustomerDirectory.ts` tipa localmente `customer_directory_v1`. Las cuatro entidades están verificadas live y faltan total o parcialmente en `database.types.ts`.

### Clasificación de objetos investigados explícitamente

| Objeto/grupo | Clasificación | Evidencia concreta |
| --- | --- | --- |
| `orders.pausar_tareas_automaticas` | VERIFIED LIVE + missing/incomplete in repo | Columna `boolean NOT NULL DEFAULT false` live; usada por Task Engine/acciones; ausente de tipos y SQL. |
| `internal_messages` | VERIFIED LIVE + missing/incomplete in repo | Tabla, constraints y 3 políticas live; referencias con tipos locales; ausente de tipos/SQL. |
| `meta_campaigns` | VERIFIED LIVE + missing/incomplete in repo | Tabla y 2 políticas live; referencias con tipos locales; ausente de tipos/SQL. |
| `customer_directory_v1` | VERIFIED LIVE + missing/incomplete in repo | RPC live e invocado por Clientes; ausente de tipos/SQL. |
| RPC financieros: `dinero_en_la_calle`, `wallet_daily_summary`, `wallet_summary` | VERIFIED LIVE + missing/incomplete in repo | Tres RPC live y tipados; ninguna definición completa en SQL versionado. |
| RPC de reporting/productividad: `product_order_summary`, `reporte_semanal`, `task_completions_by_user`, `task_handling_time_by_user` | VERIFIED LIVE + missing/incomplete in repo | Cuatro RPC live y tipados; ninguna definición en SQL versionado. |
| Notificaciones: `notifications`, `push_subscriptions`, `notificacion_tipo_enum` | VERIFIED LIVE + missing/incomplete in repo | Tablas/enum live y tipados; políticas, FKs e índices live; SQL reproductivo ausente. |
| Recepción Shopify: `shopify_webhook_events` | VERIFIED LIVE + missing/incomplete in repo | Tabla live con PK `webhook_id`, RLS habilitado sin políticas; referencia en webhook; tipos presentes, SQL ausente. |
| `crm_mcp_reader` | referenced in repo but NOT FOUND LIVE | El código/documentación MCP menciona este rol, pero no apareció en `pg_roles`; aprovisionamiento de producción no verificado. |

## Reproducibility gaps

- **DIFFERENCE:** falta un baseline versionado completo de tablas/columnas/defaults/identidades/secuencias, enums, constraints, índices, funciones/cuerpos, triggers, RLS/policies y grants del esquema observado. Los dos SQL existentes son parches acotados, no un historial completo de migraciones.
- **DIFFERENCE:** falta un artefacto versionado con las 185 filas de `status_catalog` y las 75 de `wallet_movement_catalog`; esta auditoría conserva sus valores observados sin aplicarlos ni transformarlos.
- **DIFFERENCE:** `database.types.ts` cubre buena parte de las formas de datos, pero no lista dos tablas, una columna y cinco funciones live (un RPC de aplicación y cuatro funciones de trigger); además los tipos generados no representan por sí solos policies, grants, triggers o datos de catálogo. La inclusión de funciones de trigger en una generación nueva sigue sin verificarse.

## Security-relevant findings

- **LIVE VERIFIED:** RLS habilitado en todas las tablas `public`, no forzado en ninguna. Las políticas exactas se listan arriba; `dropi_sessions` y `shopify_webhook_events` carecen de políticas. No se probó acceso efectivo con JWT de `anon` o `authenticated`.
- **LIVE VERIFIED:** `anon` y `authenticated` tienen grants SQL directos amplios sobre tablas y funciones, y `PUBLIC` tiene `EXECUTE` en los 15 RPC/funciones. El control efectivo de filas depende de RLS y del contexto de invocación; este hallazgo no clasifica por sí solo una vulnerabilidad.
- **LIVE VERIFIED:** los grants directos a `anon` y `authenticated` incluyen `TRUNCATE` y `REFERENCES`. RLS gobierna `SELECT`/`INSERT`/`UPDATE`/`DELETE` por fila; no gobierna estas operaciones de tabla completa. **NOT VERIFIED:** si esos privilegios son alcanzables mediante JWT, PostgREST o superficies de la aplicación. Esta auditoría no los clasifica como una vulnerabilidad confirmada.
- **ANALYSIS:** la política live `profiles` UPDATE usa `USING (id = auth.uid())` y `WITH CHECK (id = auth.uid())`; la expresión RLS por sí misma no exige `activo = true` ni restringe columnas concretas al actualizar la propia fila. **NOT VERIFIED:** su comportamiento efectivo mediante flujos reales de JWT, PostgREST o cliente.
- **LIVE VERIFIED:** `handle_new_user`, `is_authenticated_active_user` y `resolve_wallet_movement_order_id` son `SECURITY DEFINER`; las otras 12 funciones `public` son invoker. `service_role` posee `BYPASSRLS`. Los cuerpos y políticas se capturaron arriba para revisión posterior.
- **LIVE VERIFIED:** `crm_mcp_reader` no existe en `pg_roles` al instante de auditoría; esto es consistente con la provisión MCP aún diferida, pero no demuestra qué credenciales usa o no usa producción.

## Unknowns / not verified

- **NOT VERIFIED:** objetos y políticas fuera de `public` salvo el trigger concreto de `auth.users`; no se hizo auditoría general de `auth`, `storage` u otros schemas gestionados.
- **NOT VERIFIED:** comportamiento efectivo de autorización bajo sesiones/JWT reales, exposición PostgREST de cada función, seguridad de endpoints de Next.js o configuración de producción de MCP. La auditoría no invocó RPCs ni rutas.
- **NOT VERIFIED:** mecanismo que agenda sincronizaciones Dropi CO/MX en producción y completitud temporal de wallet; requerirían otra clase de evidencia, no se infieren de este snapshot.
- **NOT VERIFIED:** comparación byte a byte con tipos recién generados mediante Supabase CLI, por ausencia de herramienta CLI; sí se hizo la comparación estructural indicada.
- **NOT VERIFIED:** consistencia atómica entre todas las consultas de esta auditoría; el SQL Editor ejecutó SELECT separados y pudo haber cambios concurrentes ajenos a este proceso.

## Inputs for Stabilization Phase 3

- El inventario live anterior fija el alcance observado de `public`: 23 tablas, 9 enums, 18 secuencias, 52 constraints, 66 índices, 15 funciones, 7 triggers `public`, 1 trigger de `auth.users`, 39 políticas, grants y dos catálogos con 260 filas en conjunto.
- La reconstrucción debe tener en cuenta las diferencias verificadas frente a tipos (2 tablas, 1 columna, 5 funciones) y que los dos SQL existentes son parches dependientes de objetos previos.
- La evidencia de catálogo incluye dos claves genéricas duplicadas en `status_catalog`; no se resolvió su clasificación ni se cambió su contenido.
- La evidencia de permisos incluye `EXECUTE` de `PUBLIC` en las 15 funciones y ausencia live de `crm_mcp_reader`; ninguna garantía de autorización se declaró satisfecha.
- Esta Fase 2 no creó baseline, migraciones ni decisiones de implementación. Los diez invariantes de estabilización siguen siendo objetivos, no resultados acreditados por esta auditoría.
