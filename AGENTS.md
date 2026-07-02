# AGENTS.md — CRM Pakora

## Qué es esto
CRM/Torre de control COD para operación de dropshipping (Dropi + Shopify), mercados Colombia y México. Un solo negocio, un solo dueño (Alejo). Objetivo: monitorear cada pedido a través de su ciclo de vida COD (Cash on Delivery), generar tareas automáticas de gestión, y dar visibilidad financiera día a día.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Supabase (Postgres) como base de datos
- Vercel para hosting/deploy (auto-deploy on push a main)
- Dominio: crm.pakora.online
- n8n (self-hosted, fuera de este repo) para extracción de datos de Dropi y Shopify
- Gestor de paquetes: pnpm

## Regla de arquitectura no negociable
**n8n solo extrae datos. Toda la lógica de negocio (tareas automáticas, clasificación de estados, reglas COD) vive en este backend, en TypeScript.**
n8n hace: login a Dropi (con 2FA/TOTP), consulta pedidos y wallet, escribe/actualiza en Supabase (`orders`, `status_history`, `wallet_movements`), y notifica cambios a un webhook de este backend.
Este backend hace: decide qué tarea crear, cuándo, con qué prioridad, y toda regla de negocio COD.
Nunca meter lógica de decisión de negocio en un nodo de n8n. Si aparece la tentación, es señal de que la lógica debe moverse acá.

## Repos y sistemas relacionados
- Repo de este CRM: https://github.com/Nemsauce/crm_pakora
- n8n corre en instancia self-hosted separada, gestionada vía su API REST (`N8N_BASE_URL` + `N8N_API_KEY`)
- Workflows de n8n (IDs de referencia):
  - Dropi Polling (CO): 9p1gvbDxdYqugkMT
  - Dropi Polling MX: BQ7G5rSntIoszmJ3
  - Dropi migracion (CO, histórico, inactivo): YrWPu8mLMLCalkFa
  - Dropi migracion MEX (histórico, inactivo): EBAU2dcasgMNFHDV
  - Shopify Orders (CO): R6yGZIKxVCWfJaq9
  - Shopify Orders MX: oYYHzqRXCjNfPGks

## Contexto de negocio clave
- Venta 100% COD: cada pedido puede terminar en no-pago/no-recibido, de ahí la necesidad de tareas de seguimiento activo.
- Dropi no ofrece API pública — todo el acceso es vía ingeniería inversa (login manual + inspección de red), documentado en archivos .HAR.
- Dropi expone ~205 estados de pedido posibles, repartidos en ~10 transportadoras distintas, cada una con su propio vocabulario. Se clasifican en categorías internas (`categoria_estado_enum`) vía la tabla editable `status_catalog`.
- Wallet de Dropi tiene ~74 tipos de movimiento identificados por código fijo (`identification_code`), catalogados en `wallet_movement_catalog`. Clasificar por ese código, nunca por texto libre de `description` (es inestable).
- Países: CO y MX conviven en las mismas tablas, diferenciados por columna `pais`. No hay separación de schema.

## Seguridad (fase de desarrollo actual)
- Está aceptado exponer keys en n8n (self-hosted, entorno controlado) mientras se desarrolla. Se hará un sweep de seguridad antes de ir a producción real.
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
