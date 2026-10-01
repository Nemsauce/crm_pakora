# Supabase Baseline Metadata Closure — Stabilization Phase 3B-1

## Scope and safety

- **LIVE VERIFIED:** auditoría ejecutada el `2026-10-01` desde el Supabase Dashboard SQL Editor ya autenticado, con consultas `SELECT` solamente, en el proyecto `nauqpgsspwfqkxidenkx` (`CRM Personal`, rama `main` marcada `PRODUCTION`, host `nauqpgsspwfqkxidenkx.supabase.co`), base `postgres`, PostgreSQL `17.6` en `aarch64-unknown-linux-gnu`.
- Hora UTC de la última consulta de identidad: `2026-10-01 14:29:36.360782 UTC`.
- HEAD del repositorio: `bfbaae7eaecf7959e37a8b972d674567951e0a4f`.
- Se inspeccionaron metadatos de `public`, el trigger de aplicación ya identificado en `auth.users`, ACL/default ACL, roles/settings, historial de migraciones y filas únicamente de `status_catalog` y `wallet_movement_catalog`. No se leyeron datos de pedidos, perfiles, usuarios, mensajes, tareas, notificaciones, campañas ni movimientos de negocio; tampoco cuerpos SQL de migraciones.
- **READ ONLY:** no se modificó schema, datos, ACL, roles, funciones, triggers, secuencias ni historial remoto. No se ejecutó CLI, generación de tipos, migración ni endpoint de aplicación.
- La sesión SQL del dashboard ejecuta consultas independientes, no una transacción de snapshot única. Los resultados identifican el estado observado durante esta revisión.

## Toolchain decision

| Herramienta / entorno | Hallazgo local |
| --- | --- |
| OS / arquitectura | Linux `7.1.3-arch2-2`, `x86_64` |
| Node.js | `v24.16.0` |
| pnpm | No está en PATH; `package.json` declara `pnpm@11.9.0` |
| Docker / Compose | Docker CLI no instalado; Compose no disponible |
| Daemon Docker/Podman | No accesible; sockets habituales ausentes |
| Supabase CLI | No instalado/en PATH |
| Configuración local | No hay `supabase/config.toml` |

**REPOSITORY VERIFIED:** no se instalaron, actualizaron ni configuraron herramientas durante esta fase.

**VERIFIED FROM OFFICIAL RELEASE METADATA:** el release estable actual al `2026-10-01` es Supabase CLI `2.119.0`, release oficial del `2026-09-30`; GitHub lo identifica como `Latest`. Hay versiones beta/pre-release visibles, que no se seleccionan. La recomendación para 3B-2 es fijar `2.119.0`, reemplazando la previsión anterior `2.117.0`, que ya no es la última estable. [Release oficial v2.119.0](https://github.com/supabase/cli/releases/tag/v2.119.0).

**Decisión de motor:** usar `pg-delta` en la futura configuración `[experimental.pgdelta] enabled = true`; no habilitarlo ni crear configuración en 3B-1. La documentación vigente explica que el motor aún es experimental y que `db pull` depende del motor configurado. Se prefiere frente a `migra` porque pg-delta cubre PostgreSQL 14–18 (incluido el PG17 live), representa más categorías de objetos y ofrece reporte estricto de cobertura; la estrategia documentada también contempla personalizaciones en schemas administrados como el trigger de `auth.users`. No se encontró incompatibilidad concreta con este proyecto. [Documentación oficial de motores de diff](https://supabase.com/docs/guides/local-development/diff-engines).

**Viabilidad local:** no se puede ejecutar hoy el stack Supabase local: faltan CLI, Docker y daemon. Antes de usar extracción o reconstrucción se necesita un entorno compatible con PG17 y Auth/roles/extensiones del proveedor, y fijar explícitamente CLI/configuración. Un proyecto desechable separado sigue siendo la alternativa si el runtime local no se provisiona. Estas carencias afectan la ejecución, no sustituyen evidencia live ya recogida.

## Ownership de objetos

**LIVE VERIFIED:** el schema `public` pertenece a `pg_database_owner`. Son propiedad de `postgres` las 23 tablas, las 18 secuencias, las 15 funciones de `public`, los nueve enums y las extensiones inspeccionadas `pgcrypto` y `uuid-ossp`. No se inspeccionó ni se afirma ownership de `auth.users` ni de otros objetos administrados.

## SECURITY DEFINER y metadatos de funciones

Las tres funciones `SECURITY DEFINER` tienen propietario `postgres`, `proconfig = {search_path=public}` y ACL directa idéntica: `EXECUTE` para `PUBLIC`, `postgres`, `anon`, `authenticated` y `service_role`. No se ejecutó ninguna.

| Firma | Lenguaje | Volatilidad | Seguridad | `proconfig` |
| --- | --- | --- | --- | --- |
| `customer_directory_v1(p_query text DEFAULT NULL::text, p_pais pais_enum DEFAULT NULL::pais_enum, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)` | sql | STABLE | INVOKER | NULL |
| `dinero_en_la_calle()` | sql | STABLE | INVOKER | NULL |
| `dropkiller_sweet_spot_candidates()` | sql | STABLE | INVOKER | NULL |
| `dropkiller_sweet_spot_candidates_scored_v3()` | sql | STABLE | INVOKER | NULL |
| `handle_new_user()` | plpgsql | VOLATILE | DEFINER | `{search_path=public}` |
| `is_authenticated_active_user()` | sql | STABLE | DEFINER | `{search_path=public}` |
| `product_order_summary()` | sql | STABLE | INVOKER | NULL |
| `reporte_semanal(p_date_from date, p_date_to date)` | sql | STABLE | INVOKER | NULL |
| `resolve_wallet_movement_order_id()` | plpgsql | VOLATILE | DEFINER | `{search_path=public}` |
| `set_updated_at()` | plpgsql | VOLATILE | INVOKER | NULL |
| `task_completions_by_user(p_date_from date, p_date_to date)` | sql | STABLE | INVOKER | NULL |
| `task_handling_time_by_user(p_date_from date, p_date_to date)` | sql | STABLE | INVOKER | NULL |
| `update_updated_at()` | plpgsql | VOLATILE | INVOKER | NULL |
| `wallet_daily_summary(p_date_from date, p_date_to date)` | sql | STABLE | INVOKER | NULL |
| `wallet_summary(p_date_from date, p_date_to date)` | sql | STABLE | INVOKER | NULL |

Las 12 funciones INVOKER también pertenecen a `postgres`, tienen la misma ACL directa `PUBLIC, postgres, anon, authenticated, service_role = EXECUTE`, sin `proconfig` propio. El ACL `PUBLIC EXECUTE` es explícito en las ACL observadas de todas las funciones; el default ACL de función de `postgres` no incluye `PUBLIC`.

## Secuencias e identidades

**LIVE VERIFIED:** las 18 columnas siguientes son `GENERATED ALWAYS AS IDENTITY`; cada una está enlazada a la secuencia indicada, propiedad de `postgres`:

| Tabla.columna | Secuencia |
| --- | --- |
| `abandonados.id` | `abandonados_id_seq` |
| `asistente_whatsapp_config.id` | `asistente_whatsapp_config_id_seq` |
| `comentarios.id` | `comentarios_id_seq` |
| `costeos.id` | `costeos_id_seq` |
| `dropkiller_config.id` | `dropkiller_config_id_seq` |
| `dropkiller_products_daily.id` | `dropkiller_products_daily_id_seq` |
| `dropkiller_saved_products.id` | `dropkiller_saved_products_id_seq` |
| `internal_messages.id` | `internal_messages_id_seq` |
| `notifications.id` | `notifications_id_seq` |
| `orders.id` | `orders_id_seq` |
| `push_subscriptions.id` | `push_subscriptions_id_seq` |
| `status_catalog.id` | `status_catalog_id_seq` |
| `status_history.id` | `status_history_id_seq` |
| `task_handling_events.id` | `task_handling_events_id_seq` |
| `tasks.id` | `tasks_id_seq` |
| `wallet_movements.id` | `wallet_movements_id_seq` |
| `whatsapp_mensajes_entrantes.id` | `whatsapp_mensajes_entrantes_id_seq` |
| `whatsapp_mensajes_salientes.id` | `whatsapp_mensajes_salientes_id_seq` |

Todas comparten estructura `bigint`, start `1`, increment `1`, min `1`, max `9223372036854775807`, cache `1`, `NO CYCLE`; ACL directa `{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}` (SELECT/UPDATE/USAGE). Se verificaron 18 enlaces a columnas `id`, `attidentity='a'` (ALWAYS), y 18 tablas distintas.

No se leyó el valor actual/runtime de ninguna secuencia. Para una reconstrucción vacía, preservar los IDs de catálogo hasta `status_catalog.id = 263`; tras insertarlos explícitamente, el próximo valor estructural esperado es `264` por incremento 1. Este estado de catálogo debe comprobarse en el destino desechable; no copiar posiciones de secuencias transaccionales de producción.

## ACL y default ACL

ACL directa agrupada observada:

- `public`: owner `pg_database_owner`; `CREATE, USAGE` para `pg_database_owner`; `USAGE` para `PUBLIC`, `postgres`, `anon`, `authenticated`, `service_role`.
- Las 23 tablas: owner `postgres`; ACL `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`.
- Las 18 secuencias: owner `postgres`; ACL indicada arriba.
- Las 15 funciones: owner `postgres`; `EXECUTE` para `PUBLIC`, `postgres`, `anon`, `authenticated`, `service_role`.

El ACL crudo de tablas contiene ocho privilegios por cada uno de cuatro roles (`INSERT`, `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`): 23 × 4 × 8 = **736 grants**. La vista `information_schema.table_privileges` consultada devuelve los siete tradicionales por rol (644 filas de grants) y omite `MAINTAIN`; la auditoría Phase 2 registró ese resumen de siete. **ANÁLISIS:** esta diferencia de cobertura entre la vista y el ACL crudo no prueba que el grant cambiara desde Phase 2; la reconstrucción debe usar el ACL crudo live y registrar la discrepancia como omisión de reporte anterior. `MAINTAIN` se observó también para los cuatro roles en los default ACL de tablas de `postgres` en `public`.

`pg_default_acl` contiene para `public` tres entradas de `postgres` y tres de `supabase_admin`: object type `r` (tablas), `S` (secuencias) y `f` (funciones). En ambos grantors los defaults de tabla incluyen los mismos ocho privilegios para `postgres`, `anon`, `authenticated`, `service_role`; los defaults de secuencia incluyen `SELECT`, `UPDATE`, `USAGE` para esos roles. Defaults de función conceden `EXECUTE` a esos cuatro roles, sin `PUBLIC`. Los objetos auditados pertenecen a `postgres`; las funciones tienen `PUBLIC EXECUTE` además de ese default. No se modificó ACL alguno.

`authenticator` figura en roles gestionados, pero no es grant directo en estos ACL de objeto. No existe `crm_mcp_reader` en la evidencia Phase 2; no se crea como parte del baseline. El ACL no verifica si privilegios pueden alcanzarse mediante JWT/PostgREST y no se interpretan aquí como vulnerabilidad efectiva.

## Configuración relevante para resolución de nombres

`pg_roles.rolconfig` reporta `search_path` de `postgres` como `"$user", public, extensions`; `supabase_admin` como `"$user", public, auth, extensions`; `supabase_auth_admin` como `auth`; `supabase_storage_admin` como `storage`. `pg_db_role_setting` no reportó overrides de `search_path` por base o rol/base. `pg_settings` para la sesión auditora (`postgres`) devuelve `"$user", public, extensions`, source `user`. PostgreSQL `17.6` no expone la columna `pg_database.datconfig` consultada en este protocolo; la cobertura de configuración de base se verificó mediante `pg_db_role_setting`.

Los tres `SECURITY DEFINER` fijan su propio `search_path=public`, por lo que el valor de sesión no sustituye esa configuración. Se reporta el límite de metadatos por versión; no se infieren parámetros del proveedor no visibles mediante estos catálogos.

## Extensiones relevantes

| Extensión | Versión | Schema | Owner |
| --- | --- | --- | --- |
| `pgcrypto` | `1.3` | `extensions` | `postgres` |
| `uuid-ossp` | `1.1` | `extensions` | `postgres` |

No se instaló, movió ni alteró ninguna extensión. No es un inventario de todas las extensiones del proveedor.

## Remote migration history

**LIVE VERIFIED:** no existe el schema `supabase_migrations`; por tanto tampoco existe `supabase_migrations.schema_migrations`. El chequeo de `information_schema.columns`, `pg_namespace` y `pg_class` no encontró columnas, schema ni relación de historial. Hay **cero entradas verificables**, sin versiones/nombres/timestamps que enumerar. No se consultó contenido SQL de migraciones ni se escribió en tabla interna alguna.

Este estado no elige versiones T0/T1. En Fase 3F se volverá a inspeccionar el proyecto y se escogerá una regla UTC posterior a cualquier estado que exista entonces. Sigue sin estar verificado cómo inicializaría el flujo oficial de adopción el historial ausente en este proyecto; no ejecutar ni asumir ahora comandos de repair/adopción.

## Drift check desde Phase 2

**NO DRIFT DETECTADO — inventario estructural y listas de identidad.** Recuento live de `public`: 23 tablas, 244 columnas, 9 enums, 52 constraints, 66 índices, 15 funciones, 7 triggers de usuario, 39 policies; además 1 trigger de usuario relevante en `auth.users`; 0 vistas, 0 vistas materializadas; RLS habilitado en 23/23 y forzado en 0. Coinciden con las cantidades de Phase 2. Se compararon los nombres determinísticos de tablas, constraints, índices, firmas de funciones, triggers y pares tabla/policy; todos coinciden. Los nueve enums coinciden en etiquetas y orden. Se reconsultaron de forma puntual los nombres de FK e índice que podían parecer truncados por la UI; coinciden literalmente con Phase 2.

**ACL: precisión adicional, no drift temporal confirmado.** El resumen Phase 2 indicó siete privilegios de tabla porque `information_schema.table_privileges` no incluye `MAINTAIN`; la inspección actual de ACL crudos y defaults muestra ocho privilegios, incluido `MAINTAIN`, en las 23 tablas. No hay evidencia para afirmar que el permiso se añadió después; registrar esta diferencia de cobertura y usar la evidencia cruda para la reproducción.

**Catálogos:** `status_catalog` sigue en 185 filas, máximo ID 263, 41 `sin_clasificar`, 23 transportadoras NULL y dos pares `(estado, transportadora)` duplicados por los NULL genéricos: `EN CIUDAD DE ORIGEN DEVOLUCIÓN` (2) y `ENTRADA A CENTRO DE DISTRIBUCION` (2). Se observan variantes de casing `Coordinadora`/`COORDINADORA` e `Interrapidisimo`/`INTERRAPIDISIMO`. `wallet_movement_catalog` conserva 75 filas, cero códigos repetidos y cero códigos NULL/blancos.

Fingerprints reproducibles para comparación futura; algoritmo `md5(string_agg(to_jsonb(row)::text, E'\\n' ORDER BY id/código))`: status `5a4881c146a152b9c8157bb2ddfc163b`; wallet `30f1c7c7c1f78cad489418724d09fe51`. Phase 2 no publicó fingerprints con el mismo algoritmo; estos hashes son una nueva referencia live, no prueba hash-a-hash de ausencia de cambios en valores entre snapshots. Solo se leyeron filas de los dos catálogos autorizados.

## Managed-schema customization coverage

El trigger observado es `auth.users.trg_on_auth_user_created`, `AFTER INSERT`, función `public.handle_new_user()`. No se recreará `auth.users`. La documentación actual y el motor recomendado `pg-delta` indican soporte para personalizaciones propias en schemas administrados; Fase 3B-2 debe demostrar en una extracción y reconstrucción desechable que el trigger aparece en el artefacto y puede aplicarse después de que Supabase provea Auth y exista `public.handle_new_user()`. No se ejecutó `db pull` en esta fase.

## Metadata resolved for Phase 3B-2

- CLI objetivo: estable `2.119.0` (release de 2026-09-30), no beta.
- Motor recomendado: `pg-delta`, futura opción experimental `[experimental.pgdelta] enabled = true`; no configurado aún.
- Propietarios de schema, 23 tablas, 18 secuencias, 15 funciones, 9 enums y dos extensiones inspeccionadas: `public` es de `pg_database_owner`, los objetos enumerados de `postgres`.
- Las tres funciones DEFINER, proconfig, ACL y parámetros de búsqueda: precisados arriba.
- Secuencias: 18/18 parámetros estructurales, owners, ACL y mapeo de identidad verificados; no se copiaron posiciones runtime.
- ACL directa y default ACL de `public`: capturados; `MAINTAIN` añade detalle omitido por la vista de privilegios usada en el resumen Phase 2.
- Historial remoto: schema y tabla ausentes, cero versiones; no hubo mutación.
- Drift estructural: no detectado en cantidades, identidad de objetos ni etiquetas/orden de enum desde Phase 2.
- Integridad de ambos catálogos: filas y anomalías esperadas verificadas; fingerprints live guardados para validación posterior.
- Auth trigger: cobertura pg-delta planificada, pendiente de probar al extraer en 3B-2.

## Still unresolved

- Instalar/proveer de forma autorizada Supabase CLI `2.119.0` y Docker/runtime compatible antes de ejecutar la reconstrucción local; esta fase no instaló herramientas.
- Fijar `supabase/config.toml` y probar `pg-delta` en la fase siguiente, incluida captura del trigger de `auth.users`; configuración no creada aquí.
- Verificar en destino desechable extensiones y prerrequisitos Auth/roles, y comparar el baseline que se genere con esta metadata y Phase 2.
- Verificar versión/mecanismo de generación de tipos en 3D.
- Volver a inspeccionar el historial en 3F y validar el flujo exacto de adopción/inicialización y recuperación sin replay de DDL ni catálogos.
- Alcance de schemas Supabase gestionados más allá de la personalización puntual de `auth.users`; funcionamiento efectivo de ACL vía JWT/PostgREST; otros datos de configuración; no fueron ampliados en esta fase.

## Phase 3B-2 readiness

**METADATA CERRADA / GENERACIÓN PERMITIDA TRAS REVISIÓN:** no se detectó drift estructural; ownership, parámetros de secuencia, ACL y defaults relevantes quedaron capturados. Tras revisar este informe y el plan actualizado, se puede comenzar la generación del baseline estructural en un destino no productivo con CLI fijado y motor `pg-delta`, comprobando la personalización Auth. El entorno local observado no puede ejecutar ese flujo todavía por falta de CLI y Docker. La creación de baseline no autoriza cambio del historial de producción; toda adopción sigue reservada para Phase 3F.
