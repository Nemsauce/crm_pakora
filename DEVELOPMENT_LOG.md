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
