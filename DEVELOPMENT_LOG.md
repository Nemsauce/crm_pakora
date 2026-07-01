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
