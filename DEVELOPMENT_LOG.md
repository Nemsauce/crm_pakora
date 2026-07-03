# DEVELOPMENT_LOG.md — CRM Pakora

Bitácora cronológica de decisiones y progreso. Formato por entrada: fecha, qué se hizo/decidió, por qué, qué queda pendiente. Entradas más recientes al final.

## Convención
Cada vez que se complete un commit significativo (schema, feature, decisión de arquitectura), agregar una entrada nueva al final de este archivo. No editar entradas pasadas salvo error factual.

---

### [Fase 1] Schema de Supabase — COMPLETADO
- Se diseñaron y ejecutaron `001_crm_schema.sql` y `002_catalog_seeds.sql` directamente en el SQL Editor de Supabase (no vía migración versionada en este repo todavía).
- Tablas: `orders`, `status_history`, `status_catalog`, `tasks`, `comentarios`, `wallet_movements`, `wallet_movement_catalog`.
- `status_catalog` poblado con clasificación heurística de primera pasada de los 205 estados encontrados en `.HAR` de Dropi CO/MX. ~69 quedaron `sin_clasificar` — pendiente revisión manual por Alejo antes de confiar en producción.
- `wallet_movement_catalog` poblado con los ~74 tipos de movimiento, clasificados por keyword del nombre. Revisar especialmente categorías `otro` y `correccion`.
- Decisión: CO y MX en las mismas tablas (columna `pais`), no schemas separados — mismo negocio, se necesita comparar/sumar métricas entre países.
- Pendiente: no existe todavía un mecanismo de migraciones versionadas en este repo (Supabase CLI). El schema vive solo como los dos .sql ejecutados manualmente. Evaluar si se formaliza más adelante.

### [Fase 2 — decisión de arquitectura] Motor de tareas automáticas — EN DISEÑO
- Decisión: el disparo de tareas va por **webhook** (n8n llama a un endpoint de este backend después de actualizar `orders`), NO por trigger de Postgres ni por polling propio del backend. Razón: la lógica de negocio de tareas debe vivir en TypeScript testeable/versionable, no en SQL ni duplicada en un segundo sistema de polling.
- Riesgo identificado: si el webhook falla y n8n ya actualizó `orders.estado_dropi` antes de notificar, el próximo ciclo de polling ya no detecta el "cambio" (porque Dropi y Supabase ya coinciden) y el evento se pierde en silencio.
- Mitigación acordada: columna `tarea_generada_para_estado` en `orders` (separada de `estado_dropi`), actualizada por el backend solo cuando confirma que procesó ese estado. Reintentos nativos de n8n (2-3 intentos) para fallos transitorios. Job de reconciliación liviano (backend, cron) que compara `estado_dropi` vs `tarea_generada_para_estado` en órdenes activas y dispara los webhooks pendientes — pendiente de implementar.
- Pendiente: la columna `tarea_generada_para_estado` todavía NO se ha agregado al schema. Falta antes de construir el endpoint del webhook.
- Pendiente: diseño del endpoint del webhook, su lógica de decisión de tareas, y el job de reconciliación.

### [Fase 3] Setup base de Next.js — EN PROGRESO
- Scaffold inicial creado y pusheado a main (commit 9173e0f): Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (tema dark-mode-first), pnpm, Node v24.18.0 (.nvmrc).
- Repo: https://github.com/Nemsauce/crm_pakora
- Sin auth todavía, sin cliente Supabase todavía — a propósito, son commits separados.
- Pendiente: deploy en Vercel (Alejo debe conectar el repo manualmente vía dashboard, no CLI — no metió env vars reales todavía).
- Pendiente: conectar dominio crm.pakora.online en Vercel (requiere acceso DNS de Alejo).
- Pendiente: cliente Supabase (server + browser) + tipos generados desde el schema.
- Pendiente: autenticación con roles (multi-usuario desde el inicio, no un solo usuario).

### [Fase 4] Command Center financiero — NO INICIADO

### [Fase 3] Cliente Supabase — COMPLETADO
- Se agregaron clientes Supabase tipados para browser, server/RLS y admin server-only usando `@supabase/ssr` + `@supabase/supabase-js`.
- Se generó `src/lib/supabase/database.types.ts` desde el schema live de Supabase (`nauqpgsspwfqkxidenkx`, schema `public`). El schema real incluye `orders`, `status_history`, `status_catalog`, `tasks`, `comentarios`, `wallet_movements`, `wallet_movement_catalog`; también aparece `tarea_generada_para_estado` en `orders`, consistente con la mitigación definida para webhooks. Sigue pendiente revisar manualmente los ~69 estados `sin_clasificar` de `status_catalog` antes de confiar en producción.
- Se agregó `middleware.ts` con refresh de sesión vía cookies para Next.js App Router, sin crear UI de auth ni páginas nuevas.
- Pendiente: auth UI, roles/permisos multi-usuario, reglas RLS finales y uso real de los clientes en features.

### [Fase 3] Auth (login/invite/logout) — COMPLETADO
- Se agregó flujo mínimo invite-only: login con email/password, callback de Supabase para códigos PKCE y token hashes, set-password para invitaciones, logout vía Server Action y protección de rutas desde `middleware.ts`.
- No existe signup público; los usuarios se crean por invitación desde Supabase Auth.
- La raíz protegida muestra solo un placeholder de sesión iniciada con botón de logout. El dashboard real reemplaza esta pantalla en un commit futuro.
- Pendiente: diferenciar roles/permisos en UI y backend; por ahora solo existe el rol operativo `admin`.

### [Fase 3] Sistema de diseño — COMPLETADO
- Se estableció `DESIGN.md` como fuente de verdad para dirección visual, color, tipografía, layout y motion.
- Se agregaron tokens reutilizables de color, tipografía y gradiente/glass en Tailwind/CSS variables: base/surface, accent from/to, risk high/medium/low, text primary/secondary, Space Grotesk, Inter y JetBrains Mono.
- Se aplicó el sistema visual a login, set-password y placeholder home sin construir nuevas pantallas ni dashboard.
- Pendiente: construir el orbe de riesgo cuando exista la lista de pedidos y reemplazar el placeholder por el layout real del dashboard.

### [Fase 2] Motor de tareas — COMPLETADO
- Se agregó `processOrderEvent(orderId)` como motor compartido e idempotente para leer `orders.estado_dropi`, clasificarlo vía `status_catalog`, crear/actualizar/cerrar tareas automáticas y marcar `orders.tarea_generada_para_estado`.
- Se agregó webhook server-to-server `POST /api/webhooks/orders/status-changed`, protegido con `x-webhook-secret` (`WEBHOOK_SHARED_SECRET`), para que n8n notifique cambios de estado usando el `orders.id` interno.
- Se agregó cron de reconciliación `GET /api/cron/reconcile-tasks`, protegido con `CRON_SECRET`, programado en Vercel cada 30 minutos para reprocesar órdenes activas cuyo estado no esté marcado como procesado.
- Se agregaron placeholders server-only `WEBHOOK_SHARED_SECRET` y `CRON_SECRET` en `.env.example`.
- Pendiente: actualizar los workflows de n8n para llamar el webhook después de persistir cambios de estado; eso se hará vía API REST de n8n, no en este repo.

### [Fase 2] Integración n8n -> webhook — COMPLETADO
- Se agregó `scripts/n8n/patch-dropi-polling-webhook.mjs` para patchar vía API REST de n8n los workflows Dropi Polling (`9p1gvbDxdYqugkMT`) y Dropi Polling MX (`BQ7G5rSntIoszmJ3`), agregando/actualizando el nodo HTTP `Notificar backend CRM` después de `Actualizar orden Supabase`.
- Codex no ejecutó el script contra n8n porque este sandbox no tiene acceso de red ni credenciales. Alejo debe correrlo localmente con `N8N_BASE_URL`, `N8N_API_KEY` y `WEBHOOK_SHARED_SECRET`, primero en dry-run y luego con `--confirm`.
- El script no toca Dropi migracion, Dropi migracion MEX, Shopify Orders ni Shopify Orders MX.
- Pendiente: Alejo debe ejecutar el script, re-testear manualmente ambos workflows en n8n y confirmar que el webhook `/api/webhooks/orders/status-changed` se dispare correctamente.

### [Fase 2] Cron de reconciliación — PAUSADO
- Se removió la programación Vercel Cron de `/api/cron/reconcile-tasks` porque el plan Hobby solo permite crons diarios y este proyecto todavía no está pagando Vercel Pro.
- Decisión: la reconciliación se hará extendiendo el ciclo existente de n8n (`Dropi Polling`, 5x/día) para comparar `estado_dropi` contra `tarea_generada_para_estado`, no solo detectar cambios desde el último poll. Esto se implementará vía script/API de n8n en `scripts/n8n/`, no como cambio nuevo del backend en este commit.
- La ruta `/api/cron/reconcile-tasks` sigue existiendo y funcionando; simplemente no está agendada por Vercel ahora. Puede reactivarse si más adelante se adopta Vercel Pro.

### [Fase 2] Reconciliación vía ciclo de polling n8n — COMPLETADO
- Se extendió `scripts/n8n/patch-dropi-polling-webhook.mjs` para que también agregue `tarea_generada_para_estado` al `select=` de `Traer ordenes activas Supabase` y parchee `Comparar y filtrar cambios` con un marcador idempotente (`yaProcesado`).
- Objetivo: cada corrida existente de Dropi Polling (5x/día) funciona como reconciliación natural, re-notificando al backend cuando `orders.estado_dropi` ya coincide con Dropi pero `tarea_generada_para_estado` todavía no fue procesado por el motor de tareas.
- Codex no ejecutó el script contra n8n; Alejo debe correr dry-run y luego `--confirm` localmente con credenciales reales de n8n.
- Verificado por Alejo en n8n: ambos workflows (CO y MX) tienen el marcador `yaProcesado` en `Comparar y filtrar cambios` y `tarea_generada_para_estado` en el `select=` de `Traer ordenes activas Supabase`. Aplicado exitosamente vía `--confirm` contra n8n de producción.

### [Fase 3] Shell autenticado (sidebar) — COMPLETADO
- Se reemplazó el placeholder de sesión en `/` por un redirect server-side a `/pedidos` para usuarios autenticados.
- Se agregó el grupo protegido `(app)` con layout de aplicación: sidebar densa con glassmorphism para navegación/chrome, usuario actual y logout; el contenido principal queda opaco sobre `bg-surface` para futuras tablas y datos densos.
- Se creó `/pedidos` como placeholder mínimo dentro del shell. Pendiente: construir la lista real de pedidos y conectar datos.

### [Fase 3] Lista de pedidos (cards + filtros + orbe de riesgo) — COMPLETADO
- Se reemplazó el placeholder de `/pedidos` por una lista server-rendered de pedidos en cards opacas, con filtros por país, estado CRM y nivel de riesgo vía URL/search params.
- Se agregó el `RiskOrb` de `DESIGN.md`: pulso CSS por `nivel_riesgo` (verde/ámbar/rojo) y fallback estático para `sin_datos` o `prefers-reduced-motion`.
- La paginación quedó simple con anterior/siguiente a 24 pedidos por página. Pendiente: vista de detalle individual de pedido en un commit futuro.

### [Fase 3] Detalle de pedido (drawer) — COMPLETADO
- Se agregaron cards clickeables en `/pedidos` con selección persistente por URL (`detalle={orders.id}`) y resaltado visual con token `accent-to`.
- Se agregó drawer lateral opaco/read-only que carga bajo demanda `/api/orders/[id]` usando el cliente Supabase server/RLS, con datos de la orden, historial de estados y tareas asociadas.
- Pendiente: acciones de tareas desde UI (completar, editar, reasignar) y una vista dedicada de detalle de pedido.

### [Fase 3] Rediseño visual — tema claro (tokens) — COMPLETADO
- Se reemplazó el sistema dark liquid-glass por una dirección visual clara basada en la referencia de Figma aprobada por Alejo: fondo cálido a lavanda, superficies blancas, sombras suaves y acento violeta.
- Este commit solo actualiza `DESIGN.md` y la infraestructura de tokens en Tailwind/CSS variables; no migra componentes ni pantallas todavía.
- Temporalmente Sidebar, login, set-password, OrderCard, OrderDetailDrawer y RiskOrb todavía reflejan parte del tema oscuro anterior hasta que se actualicen en commits siguientes. Esta inconsistencia visual es esperada y temporal.

### [Fase 3] Rediseño visual — tema claro (componentes) — COMPLETADO
- Se completó la migración visual iniciada en el commit de tokens: Sidebar/auth ya estaban migrados y ahora `/pedidos`, filtros, cards, drawer de detalle y skeleton de carga usan superficies blancas, sombras suaves, bordes mínimos y acento violeta.
- `RiskOrb` dejó de ser un pulso animado y pasó a un indicador plano/estático por color, alineado con `DESIGN.md`: el nuevo tema no usa lenguaje de motion líquido ni glows.
- El rediseño visual de Fase 3 queda completo en las superficies existentes: Sidebar, auth, pedidos, drawer y estados de carga.

### [Fase 3] Pantalla de Tareas — COMPLETADO
- Se agregó `/tareas` como lista plana de tareas abiertas (`pendiente`, `en_progreso`) ordenada por urgencia (`fecha_limite` ascendente, nulos al final). La decisión explícita fue lista operativa, no kanban, porque el flujo COD necesita priorizar qué gestionar primero.
- Cada tarea muestra contexto de pedido (cliente + número de orden), tipo, estado, intentos, vencimiento y tratamiento visual de vencidas con `risk-high`.
- Se agregó acción directa para completar tareas desde la pantalla vía Server Action RLS-scoped: marca `estado = completada`, `completado_en`, `completado_por` con el email del usuario activo y revalida `/tareas`.
- El sidebar ahora habilita `Tareas` como navegación real. Pendiente: deep-link desde una tarea hacia `/pedidos?detalle={orders.id}` para abrir el pedido origen.
- Nota técnica: al convertir Sidebar.tsx a Client Component (fix de active-state por ruta), el logout se movió de Server Action a supabase.auth.signOut() vía cliente browser directo en el mismo componente, para no tocar otros archivos. Verificado manualmente por Alejo: funciona correctamente end-to-end (sesión se cierra, no se puede volver a /pedidos sin loguear de nuevo). Queda como única excepción al patrón de Server Actions para mutaciones de auth usado en el resto de la app (login, set-password). No es urgente, pero se puede unificar cuando se vuelva a tocar el sidebar.

### [Checkpoint] Estado del proyecto y plan de continuación
- Completado: Fase 1 (schema), Fase 2 (motor de tareas + integración n8n completa), Fase 3 (app: auth, sidebar, /pedidos con drawer, /tareas con completar, sistema visual Light Blobmorphism).
- NO iniciado: Fase 4 (Command Center financiero).
- Gap crítico encontrado: `wallet_movements`/`wallet_movement_catalog` existen en el schema pero NINGÚN workflow de n8n las alimenta — el nodo "Procesar movimientos wallet" de los workflows Dropi Polling nunca fue actualizado (el script de patch solo tocó los nodos de `orders`). Bloqueante para Fase 4 hasta resolverse.
- Pendiente: terminar de revisar los ~69 estados `sin_clasificar` de `status_catalog` contra datos reales migrados (query ya entregada, no ejecutada hasta el final).
- Pendiente: roles más allá de `admin` (RLS no distingue permisos todavía).
- Pendiente: formalizar migraciones de schema vía Supabase CLI (hoy son .sql sueltos corridos manualmente).
- Pendiente: confirmar `supabase/.gitignore` cubre `.temp/`.
- Pendiente: borrar data de prueba (`delete from tasks where creado_por = 'seed_test';`) antes de producción real.
- Pendiente: sweep de seguridad (acordado desde el inicio, aceptable en desarrollo).
- Próxima prioridad acordada: conectar wallet a n8n primero, después Command Center.

### [Fase 4 prep] Captura completa de wallet_movements — SCRIPT LISTO, PENDIENTE DE EJECUCIÓN
- Gap resuelto a nivel de script: `wallet_movements` y `wallet_movement_catalog` existían en Supabase, pero ningún workflow de n8n estaba alimentando `wallet_movements`; solo se actualizaban campos agregados en `orders` para liquidación/devolución.
- Se extendió `scripts/n8n/patch-dropi-polling-webhook.mjs` para agregar una rama paralela desde `Dropi Consultar Wallet`: `Mapear movimientos wallet completo` transforma todos los movimientos con `order_id` y `Insertar movimientos wallet` hace bulk insert en `wallet_movements` con idempotencia por `Prefer: resolution=ignore-duplicates,return=minimal`.
- La clasificación queda por `identification_code` contra `wallet_movement_catalog`, no por texto libre de `description`.
- La cadena existente `Procesar movimientos wallet` → `Actualizar liquidacion` / `Actualizar devolucion` queda intacta y sigue corriendo en paralelo. Pendiente: Alejo debe ejecutar dry-run y luego `--confirm` contra n8n de producción y verificar inserts reales antes de construir Fase 4 (Command Center financiero).
- PIN: la migración histórica completa de wallet_movements (todo lo anterior a los últimos 3 días que ya captura el polling continuo) queda pausada intencionalmente. Se resolverá junto con la migración definitiva al final del proyecto (historial completo de wallet + revisión final de status_catalog sin_clasificar + limpieza de data de prueba). El polling continuo ya captura movimientos nuevos hacia adelante sin problema.

### [Fix producción] JSON inválido en actualización de orden + duplicados en wallet — SCRIPT LISTO, PENDIENTE DE EJECUCIÓN
- Error n8n observado: `invalid JSON` / body inválido al ejecutar `Actualizar orden Supabase` con data real MX que contenía comillas o caracteres especiales. Causa raíz: el `jsonBody` estaba armado con interpolación manual dentro de comillas, sin escape automático. Fix: el script ahora parchea `Actualizar orden Supabase` para usar `JSON.stringify({ ... })` sobre el objeto completo.
- Error n8n observado: `409 duplicate key value violates unique constraint` al insertar `wallet_movements` repetidos aunque el header `Prefer: resolution=ignore-duplicates,return=minimal` existía. Causa raíz: PostgREST necesita `on_conflict=pais,id_movimiento_dropi` para apuntar a la constraint única compuesta, porque no es la primary key. Fix: el script ahora agrega ese query param a la URL de `Insertar movimientos wallet`.
- Pendiente: Alejo debe correr dry-run y luego `--confirm` contra n8n de producción para aplicar ambos fixes.

### [Fase 4] Command Center financiero — COMPLETADO
- Se agregó `/command-center` como dashboard financiero inicial, server-rendered y protegido por el shell autenticado.
- La agregación vive en Supabase vía RPC `wallet_summary(p_date_from, p_date_to)`; la app solo separa por país y hace shaping visual para cards/tablas.
- La pantalla muestra ganancia neta (`ENTRADA - SALIDA`) por CO/MX, selector 7/30/90 días, y desglose por categoría de movimiento wallet.
- La fuente es `wallet_movements`, alimentada por el polling continuo reciente; por ahora puede aparecer "Sin movimientos" si el rango no tiene datos. El backfill histórico completo sigue diferido según el PIN anterior, así que esta pantalla se irá poblando hacia adelante o después de la migración final.

### [Checkpoint] plan finalv1.0 — pendientes antes de considerar el proyecto cerrado
Fases 1-4 del roadmap original están completas y verificadas en producción (schema, motor de tareas + n8n, app completa, Command Center). Esto es lo que queda:

1. Migración histórica completa de wallet_movements (el polling solo captura hacia adelante desde ~1 jul 2026; falta traer todo lo anterior).
2. Roles más allá de `admin` (operador, finanzas) — RLS no distingue permisos todavía.
3. Formalizar migraciones de schema vía Supabase CLI (hoy son 8 archivos .sql sueltos corridos manualmente en el SQL Editor, sin versionar en supabase/migrations/).
4. Confirmar que supabase/.gitignore cubre .temp/ (nunca se confirmó el resultado de ese chequeo).
5. Regenerar database.types.ts para incluir wallet_summary y eliminar el cast manual en /command-center/page.tsx.
6. Borrar data de prueba: `delete from tasks where creado_por = 'seed_test';`
7. Sweep de seguridad (acordado desde el inicio del proyecto, pendiente antes de producción real).
8. Deep-link desde una tarea en /tareas hacia /pedidos?detalle={orders.id} con el drawer ya abierto.

### [Fase 3] Sweep visual v3 — tokens + theme toggle — COMPLETADO
- Se reescribió `DESIGN.md` como fuente de verdad v3 dual-theme (light + dark), basado en los nuevos mockups aprobados por Alejo para Pedidos, Tareas y Command Center.
- Se agregó `next-themes` y el `ThemeProvider` global con `attribute="class"`, `defaultTheme="light"` y `enableSystem=false`; el toggle será explícito y no seguirá la preferencia del sistema.
- Se agregaron tokens completos para `:root` y `.dark` en `globals.css`, más tokens Tailwind para positivos/negativos, badges y acentos secundarios.
- Se creó `ThemeToggle` como componente cliente funcional, todavía sin ubicar en la UI. La aplicación visual de Sidebar/TopBar/cards/tareas/Command Center queda para commits separados del sweep.

### [Fase 3] Sweep visual v3 — logo + barra superior — COMPLETADO
- Se agregó el logo inline SVG de flor de 4 pétalos en degradado violeta junto al wordmark `CRM Pakora` en el sidebar.
- Se creó `TopBar` compartido para todas las pantallas autenticadas con iconos de búsqueda, notificaciones, `ThemeToggle` y avatar circular con iniciales derivadas del email real del usuario.
- Los iconos de búsqueda y notificaciones son placeholders visuales sin funcionalidad todavía; quedan listos para conectar en futuros commits.

### [Migración histórica] Script de backfill completo (pedidos + wallet, desde 2026-03-01) — SCRIPT LISTO, PENDIENTE DE EJECUCIÓN
- Se creó `scripts/n8n/patch-dropi-migracion-historical.mjs` como script one-time para parchear los workflows históricos `Dropi migracion (CO)` (`YrWPu8mLMLCalkFa`) y `Dropi migracion MEX` (`EBAU2dcasgMNFHDV`).
- El script actualiza `Dropi Consultar Historico` para consultar desde `2026-03-01` hasta hoy y habilita paginación nativa del HTTP Request node, evitando depender de una sola página de 50 resultados.
- Se agrega una rama nueva de wallet histórico: `Dropi Consultar Wallet Historico` → `Mapear movimientos wallet completo` → `Insertar movimientos wallet`, reutilizando el patrón de mapping/insert del polling continuo y la idempotencia por `on_conflict=pais,id_movimiento_dropi`.
- No se agrega webhook CRM a estos workflows históricos; la generación de tareas queda para el mecanismo normal de reconciliación después de que la data histórica exista en Supabase.
- Pendiente antes de ejecutar los workflows en n8n: Alejo debe correr primero `009_wipe_para_migracion_limpia.sql` en Supabase para evitar mezclar data parcial/test con la migración histórica definitiva.

### [Notificaciones] Fase 2a — novedad y pedido_entregado — COMPLETADO
- `processOrderEvent` ahora inserta filas en `notifications` para dos eventos: categoría `novedad` (tipo `novedad`, con `task_id` del `resolver_novedad` creado/actualizado) y específicamente cuando `estado_dropi` resuelve a `entregado` dentro de la categoría de cierre (tipo `pedido_entregado`, `task_id` null porque esta categoría cierra tareas, no crea una). `cancelado` y `devolucion` comparten la misma rama de cierre de tareas pero NO generan notificación en este commit — queda fuera de alcance a propósito.
- La lógica de decisión de tareas (creación/cierre) queda byte-idéntica; el insert de notificaciones es aditivo y está envuelto en try/catch que solo hace `console.error` — un fallo de notificación nunca bloquea ni revierte el procesamiento real del evento.
- **PIN importante**: hoy no existe todavía direccionamiento por asignación (`asignado_a`) para notificaciones — cada notificación se inserta como **broadcast**, una fila por cada perfil con `activo = true` en `profiles`. Esto es un default temporal aceptable con un solo rol (`admin`) hoy, pero deja de tener sentido en cuanto haya más de un usuario activo sin distinción de a quién le corresponde cada pedido. El targeting real por asignación queda pendiente para Fase 2b, una vez que la reasignación de tareas (`asignado_a`, ya wireado en `/tareas`) se use como fuente de verdad de a quién notificar.
- Otros disparadores de notificación (pedido nuevo vía Shopify, tarea urgente asignada, tarea vencida) quedan fuera de este commit — son commits separados.
- `database.types.ts` se regeneró de nuevo (estaba desactualizado, sin la tabla `notifications` ni el enum `notificacion_tipo_enum`) — mismo patrón que las regeneraciones anteriores, cambio puramente aditivo.
