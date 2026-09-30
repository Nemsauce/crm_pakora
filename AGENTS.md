# AGENTS.md — CRM Pakora

## Qué es esto
CRM/Torre de control COD para operación de dropshipping (Dropi + Shopify), mercados Colombia y México. Un solo negocio, un solo dueño (Alejo). Objetivo: monitorear cada pedido a través de su ciclo de vida COD (Cash on Delivery), generar tareas automáticas de gestión, y dar visibilidad financiera día a día.

## STABILIZATION MODE — freeze de features

**El proyecto está en modo de estabilización. Hasta completar esta fase, los agentes no deben agregar nuevas features de producto salvo instrucción explícita del dueño del proyecto (Alejo).** La prioridad pasa de expansión de producto a proteger la corrección del core.

Cambios permitidos durante estabilización:

- Correcciones de bugs.
- Correcciones de comportamiento para asegurar resultados correctos.
- Trabajo de integridad de datos.
- Tests automatizados.
- Observabilidad.
- Endurecimiento de seguridad.
- Reproducibilidad del schema y la base de datos.
- Limpieza de arquitectura necesaria para garantizar la corrección del sistema.
- Refactors directamente necesarios para los puntos anteriores.

Fuera de estabilización salvo aprobación explícita de Alejo:

- Nuevas superficies de producto CRM.
- Nuevas features de Meta.
- Nuevas features de WhatsApp.
- Nuevas features de Dropkiller.
- Nuevas capacidades del asistente.
- Herramientas MCP adicionales a la Tanda 1 existente.
- Rediseños cosméticos sin relación con un problema de corrección.
- Optimizaciones no relacionadas con la estabilización.

MCP Tanda 1 permanece implementado; su aprovisionamiento y validación en producción quedan diferidos intencionalmente hasta completar la estabilización del core. No se elimina ni se rediseña su funcionalidad.

## Core stabilization invariants

Estos diez invariantes son objetivos de estabilización y el marco de aceptación de las próximas fases, no afirmaciones de corrección actual. Ninguno se considera satisfecho sin evidencia verificable en el repositorio.

1. **Invariant 1 — Event effects:** Todo evento logístico real que requiera una consecuencia operativa debe producir esa consecuencia exactamente una vez, incluso ante reintentos, replays o fallos del proceso.
2. **Invariant 2 — Terminal order safety:** Un pedido que haya alcanzado un estado logístico terminal no debe volver accidentalmente a un estado activo/no terminal de su ciclo de vida porque otra integración escriba datos obsoletos o de inicialización.
3. **Invariant 3 — Task recoverability:** Si una tarea automática debe existir por un evento del pedido o una regla operativa, un fallo transitorio no debe causar su pérdida permanente.
4. **Invariant 4 — State consistency:** La UI del CRM, el Task Engine, los reportes, MCP y la lógica financiera/de negocio deben resolver de forma consistente el mismo estado logístico subyacente.
5. **Invariant 5 — Financial completeness:** Toda pantalla o reporte financiero que afirme representar un período definido debe usar datos completos para ese alcance declarado, o indicar explícitamente que solo representa un snapshot parcial/actual.
6. **Invariant 6 — Database reproducibility:** La estructura, funciones, políticas, enums, triggers y datos de catálogo requeridos de la base de producción deben llegar a ser reconstruibles a partir de artefactos del repositorio bajo control de versiones.
7. **Invariant 7 — Single ownership:** Cada campo crítico de negocio o estado derivado debe tener un único responsable claramente definido como autoridad. Las integraciones no deben sobrescribir silenciosamente campos fuera de su ámbito de responsabilidad.
8. **Invariant 8 — Retry/idempotency safety:** Reprocesar el mismo evento externo o histórico no debe crear efectos de negocio duplicados no intencionados.
9. **Invariant 9 — Failure visibility:** Un fallo en la ingesta de pedidos, el procesamiento logístico, la generación de tareas o la ingesta financiera debe ser observable y diagnosticable, en lugar de desaparecer silenciosamente entre logs o estados desactualizados.
10. **Invariant 10 — Authorization boundary:** El acceso privilegiado a la base de datos desde el servidor nunca debe sustituir la verificación de que el actor autenticado está autorizado para realizar o consultar la operación solicitada.

## Stabilization exit criteria

El desarrollo de features solo puede reanudarse como trabajo habitual cuando se cumplan todos estos criterios; hasta entonces, cualquier excepción requiere instrucción explícita de Alejo:

- La documentación de la arquitectura actual refleja la realidad.
- La estructura de la base de datos live está capturada y versionada.
- La programación y la responsabilidad de la sincronización Dropi están explícitas.
- El comportamiento central del Task Engine cuenta con tests de caracterización.
- Los modos de fallo de estados terminales y de replay/idempotencia están resueltos.
- La clasificación de estados tiene una única implementación autoritativa.
- Shopify no puede sobrescribir incorrectamente el estado del ciclo de vida logístico.
- La completitud de la ingesta de wallet está resuelta.
- Las brechas críticas de autorización están resueltas.
- Cada invariante del core tiene verificación automatizada o una garantía arquitectónica documentada.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Supabase (Postgres) como base de datos
- Vercel para hosting/deploy (auto-deploy on push a main)
- Dominio: crm.pakora.online
- Gestor de paquetes: pnpm

## Current architecture summary

**VERIFIED IN REPO — capacidades y responsabilidades implementadas; su ejecución automática en producción se distingue más abajo.**

```text
Shopify ──────────────> Next.js backend ──> Supabase
Dropi CO/MX ──────────> Next.js backend ──> Supabase
Backend sync/events ───> TypeScript Task Engine ──> Supabase
Supabase ─────────────> CRM UI
Supabase ─────────────> capa MCP de solo lectura
```

Shopify es la fuente de origen comercial de pedidos en el diseño actual. Los webhooks llegan directamente al backend mediante `POST /api/webhooks/shopify/co` y `POST /api/webhooks/shopify/mx`. La ruta verifica el HMAC de Shopify, mapea el pedido, lo persiste en Supabase y, tras registrarlo, ejecuta la creación/verificación de la tarea inicial de confirmación, guarda comentarios cuando existen y dispara notificaciones de pedido nuevo. Esas operaciones posteriores se ejecutan de forma asíncrona y pueden fallar; su presencia en el código no demuestra una garantía de entrega.

El backend integra Dropi directamente para CO y MX: autenticación y reutilización de sesión, consulta paginada de pedidos, conciliación con pedidos CRM existentes, procesamiento de historial de estados faltante, enriquecimiento logístico, riesgo, costos, monto esperado a ganar, guía/transportadora y consulta de wallet. Los entrypoints son `runDropiSyncCO()` y `runDropiSyncMX()`; el repositorio expone `GET /api/cron/dropi-sync-co` y `GET /api/cron/dropi-sync-mx`, protegidos con `CRON_SECRET`. La acción autenticada de `/pedidos` permite una sincronización manual que ejecuta CO y luego MX.

**PRODUCTION UNKNOWN / TO VERIFY:** `vercel.json` no agenda `dropi-sync-co` ni `dropi-sync-mx`. El repositorio demuestra que existe la capacidad de sincronización directa, pero no demuestra qué mecanismo la ejecuta automáticamente en producción. No asumir que la sincronización es solo manual ni que existe un programador externo.

Supabase/Postgres persiste el estado operativo del CRM: pedidos, historial de estados, tareas, comentarios, perfiles, notificaciones, wallet, catálogos y registros específicos de otras funciones. El schema, las políticas, funciones y los datos de catálogo de la base live aún no son completamente reconstruibles desde artefactos versionados del repositorio; capturarlos y verificarlos sigue pendiente durante la estabilización. No inferir objetos live adicionales a partir de documentación histórica.

Las reglas de negocio viven en el backend Next.js/TypeScript. El Task Engine bajo `src/lib/tasks/` toma las decisiones operativas: `processOrderEvent.ts` clasifica el estado actual y aplica efectos de tareas; `processOrderHistory.ts` procesa eventos históricos faltantes; `checkStaleOrders.ts` detecta pedidos sin progreso logístico; `checkConfirmationFollowups.ts` gestiona seguimientos repetidos de confirmación. `estado_dropi` conserva el estado logístico externo en bruto. `status_catalog` mapea la combinación estado/transportadora a categorías operativas estables; `status_catalog.categoria` es la clasificación actual consumida por el Task Engine. `estado_crm` todavía existe y algunas partes de la aplicación lo consumen, pero su papel arquitectónico final está bajo revisión. La existencia de estos componentes no prueba procesamiento completamente dirigido por eventos ni efectos exactamente una vez: esos son objetivos de estabilización.

Dirección de responsabilidades, aún sin contrato completo por campo: Shopify aporta datos comerciales y de origen del pedido; Dropi aporta logística, estados, seguimiento y estadísticas financieras/de cliente derivadas de Dropi; el backend clasifica y decide efectos operativos y derivados de negocio; Supabase persiste el estado operativo. La titularidad exacta de cada campo se formalizará en una fase posterior.

## n8n — material legacy y de referencia

El dueño del proyecto confirmó que n8n ya no forma parte del runtime activo del CRM. `scripts/n8n/` conserva herramientas históricas de migración, parcheo e integración; las entradas antiguas de `DEVELOPMENT_LOG.md` describen etapas en que n8n sí estuvo activo. Estos materiales aportan contexto y conocimiento de Dropi obtenido por ingeniería inversa, pero no prueban la arquitectura actual de producción. No diseñar nuevo comportamiento de producción alrededor de n8n salvo instrucción explícita de Alejo.

## Known architecture unknowns during stabilization

- **PRODUCTION UNKNOWN / TO VERIFY:** mecanismo que agenda automáticamente las sincronizaciones directas Dropi CO/MX; no figura en `vercel.json`.
- **PRODUCTION UNKNOWN / TO VERIFY:** estructura, RLS, funciones y datos de catálogos exactos de Supabase live hasta capturarlos y contrastarlos con el repositorio.
- **PRODUCTION UNKNOWN / TO VERIFY:** papel arquitectónico final de `estado_crm` frente a `estado_dropi` y `status_catalog.categoria`.
- **PRODUCTION UNKNOWN / TO VERIFY:** contrato exacto de titularidad y escritura por campo entre Shopify, Dropi y backend.
- **PRODUCTION UNKNOWN / TO VERIFY:** aprovisionamiento y preparación real de MCP Tanda 1 en producción; la validación permanece diferida durante la estabilización.

## Repos y sistemas relacionados
- Repo de este CRM: https://github.com/Nemsauce/crm_pakora
- n8n y sus workflows antiguos se conservan solo como referencia histórica en `scripts/n8n/` y `DEVELOPMENT_LOG.md`.

## Contexto de negocio clave
- Venta 100% COD: cada pedido puede terminar en no-pago/no-recibido, de ahí la necesidad de tareas de seguimiento activo.
- Este proyecto no usa una API pública oficial de Dropi: la integración directa se apoya en endpoints obtenidos por ingeniería inversa, documentados también en archivos .HAR. CO y MX usan hosts y cuentas Dropi separados.
- Dropi expone ~205 estados de pedido posibles, repartidos en ~10 transportadoras distintas, cada una con su propio vocabulario. Se clasifican en categorías internas (`categoria_estado_enum`) vía la tabla editable `status_catalog`.
- Wallet de Dropi tiene ~74 tipos de movimiento identificados por código fijo (`identification_code`), catalogados en `wallet_movement_catalog`. Clasificar por ese código, nunca por texto libre de `description` (es inestable).
- Países: CO y MX conviven en las mismas tablas, diferenciados por columna `pais`. No hay separación de schema.

## Seguridad (fase de desarrollo actual)
- En este repo (Next.js/Vercel) NUNCA se expone `SUPABASE_SERVICE_ROLE_KEY` al cliente. Server-only, siempre.
- Roles/usuarios: el CRM soportará múltiples usuarios con roles desde el inicio (no es de un solo usuario).

## Convención de trabajo con agentes IA
- Claude actúa como agente de arquitectura/planificación (no escribe código).
- Codex ejecuta el código, siguiendo prompts estructurados que Claude genera.
- Cada prompt de Codex = un commit lógico.
- **Después de cada commit significativo, actualizar DEVELOPMENT_LOG.md** (ver ese archivo para el formato).

## Verificación en sandbox (pnpm no está en PATH por defecto)

El entorno de ejecución de Codex no tiene `pnpm` en el PATH al iniciar, aunque el repo lo declara en `package.json` (`packageManager: pnpm@11.9.0`). Antes de correr cualquier verificación (`build`, `lint`, `tsc`), intentar en este orden:

1. `corepack enable && corepack prepare pnpm@11.9.0 --activate` — esto activa pnpm vía Corepack (incluido con Node). Si esto funciona, usar `pnpm build` / `pnpm lint` normalmente. (Nota: si el sandbox no tiene salida a red, este paso puede fallar igual que el fetch de fuentes de next/font — no es un problema, pasar directo al paso 2.)
2. Si Corepack no está disponible, falla, o no hay red: usar los binarios locales directamente, que son equivalentes:
   - `./node_modules/.bin/next build` (equivalente a `pnpm build`)
   - `./node_modules/.bin/eslint .` (equivalente a `pnpm lint`)
   - `./node_modules/.bin/tsc --noEmit` (chequeo de tipos)

Esto NO es una desviación a reportar cada vez — es el procedimiento esperado y documentado en este entorno. Solo reportar como desviación real si NINGUNA de las dos vías funciona, o si hay un error de build/lint genuino (no relacionado con el PATH).

Nota aparte: el build vía `next build` requiere red para descargar las fuentes de `next/font/google` en build time. Si el sandbox no tiene red saliente, ese fallo específico tampoco es una desviación real — Vercel sí tiene red y compilará bien ahí. `tsc --noEmit` + `eslint` son señal suficiente de corrección cuando el build falla solo por fuentes.
