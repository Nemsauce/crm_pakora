# Supabase Reproducible Baseline Plan — Stabilization Phase 3A

## Objective

Reconstruir la definición actual verificada de la base desde artefactos versionados, establecer migraciones como fuente de los cambios intencionales futuros y prevenir drift de schema. Esta fase diseña el procedimiento; no rediseña ni limpia la base. No genera SQL, consulta Supabase, modifica runtime ni acredita el Invariant 6 — Database reproducibility.

## Verified source of truth

La evidencia es [SUPABASE_LIVE_AUDIT.md](SUPABASE_LIVE_AUDIT.md), Fase 2 del 2026-09-30, proyecto `nauqpgsspwfqkxidenkx`, PostgreSQL 17.6. **LIVE VERIFIED en Fase 2**, sin nueva consulta en Fase 3A:

| Alcance | Cantidad verificada |
| --- | ---: |
| Tablas `public` / columnas | 23 / 244 |
| Vistas / vistas materializadas | 0 / 0 |
| Enums / secuencias | 9 / 18 |
| Constraints / índices | 52 / 66 |
| Funciones `public` | 15 |
| Triggers `public` / trigger relevante en `auth.users` | 7 / 1 |
| Políticas RLS | 39 |
| Filas `status_catalog` / `wallet_movement_catalog` | 185 / 75 |

También se capturaron roles/grants relevantes y las definiciones y filas detalladas. La auditoría usó consultas separadas, no un snapshot atómico. No auditó íntegramente `auth`, `storage` ni otros schemas administrados por Supabase: este baseline no pretende reconstruirlos.

**REPOSITORY VERIFIED:** se revisaron `AGENTS.md`, `DEVELOPMENT_LOG.md`, la auditoría, los tipos, todos los archivos versionados de `supabase/`, `.env.example`, `package.json` y referencias de desarrollo/deploy. Solo existen dos SQL de parche y `supabase/.gitignore`; no hay configuración local Supabase, migraciones ordenadas ni seeds versionados. README y scripts de paquetes describen el ciclo Next.js, sin procedimiento de reconstrucción DB o generación de tipos. `vercel.json` agenda endpoints de aplicación, no migraciones. Las referencias históricas a migraciones/n8n no constituyen historial de schema. El deploy de aplicación no debe ejecutar este baseline implícitamente.

Los tipos actuales y los parches son material de comparación, no autoridad sobre live. Las decisiones siguientes son **PLAN**, no operaciones ejecutadas ni nueva evidencia live.

## Core baseline principle

**Baseline first, fixes later.** Reproducir fielmente el estado observado, incluso cuando parezca imperfecto. No corregir durante el baseline:

- Duplicados genéricos de `status_catalog` permitidos por la semántica de NULL, casing de transportadoras ni categorías `sin_clasificar`.
- Políticas RLS actuales, grants amplios, `PUBLIC EXECUTE`, política de autoactualización de `profiles` ni ausencia de políticas en `dropi_sessions` y `shopify_webhook_events`.
- Papel de `estado_crm`, comportamiento de RPC financieros, Task Engine ni problemas de autorización.
- Ausencia de `crm_mcp_reader`: no aprovisionar ese rol.

Cada corrección requerirá trabajo separado y revisado después de la reproducción. Una discrepancia durante la validación exige explicar la diferencia; no autoriza a mejorar silenciosamente el comportamiento.

## Brownfield baseline adoption

Producción es una base existente (brownfield). **Nunca ejecutar la migración estructural inicial ni la carga inicial de catálogos contra su schema ya poblado.** La capacidad de reconstrucción y la adopción del historial son operaciones distintas:

1. **Crear/versionar:** preparar una migración estructural y una migración inmediatamente posterior de catálogos. Asignar versiones únicas y ordenadas después de revisar el historial existente; ambas forman el baseline completo.
2. **Validar en limpio:** ejecutarlas únicamente sobre un destino Supabase desechable, comprobar equivalencia y conservar resultados. No usar ejecución condicional o upserts para intentar que el baseline también se pueda aplicar sobre producción.
3. **Registrar/adoptar en producción:** después de los gates, utilizar exclusivamente un mecanismo soportado de adopción del historial para registrar como aplicadas ambas versiones, sin ejecutar sus cuerpos. Revisar antes el historial remoto real, que Fase 2 no capturó; conservar entradas existentes y detenerse ante conflictos, sin truncar ni sustituir ese historial.
4. **Continuar normalmente:** solo migraciones posteriores al baseline podrán aplicarse normalmente a producción. Antes de cualquier aplicación, revisar la lista pendiente; si incluye una de las dos migraciones iniciales, detenerse.

**VERIFIED FROM CURRENT OFFICIAL SUPABASE DOCUMENTATION (2026-09-30):** el historial remoto se registra en `supabase_migrations.schema_migrations`. Un `supabase db pull` inicial sobre un proyecto existente puede crear una migración baseline a partir del schema remoto y ofrecer registrarla como aplicada en ese historial. `supabase migration repair --status applied <version>` permite marcar una versión como aplicada modificando solo el historial, sin ejecutar el cuerpo SQL de la migración. Fuentes: [flujo de migraciones](https://supabase.com/docs/guides/deployment/database-migrations) y [referencia de CLI](https://supabase.com/docs/reference/cli/supabase-db-schema-declarative).

**Límite de mutación:** `db pull` no es automáticamente read-only respecto a metadatos de migraciones: aceptar su oferta de actualizar el historial remoto sí lo modifica. Durante Fases 3B y 3E, cualquier extracción o validación debe rechazar esa oferta y no activar automáticamente su aceptación; **ninguna operación de esas fases puede modificar el historial de producción**. Registrar versiones allí pertenece exclusivamente a Fase 3F tras cumplir todos los gates. Tampoco se ejecutan entonces el DDL ni los datos del baseline contra producción.

**Tooling de extracción:** el comportamiento de `db pull` depende del motor de diff, `migra` o `pg-delta`. Este proyecto aún no tiene `supabase/config.toml`; Fase 3B debe establecer y fijar explícitamente versión de CLI y configuración antes de confiar en el SQL generado. No se elige motor en 3A. Revisar con el motor y versión elegidos la captura de objetos propios en schemas gestionados, en particular el trigger observado en `auth.users` que llama a una función `public`. La [documentación de motores de diff](https://supabase.com/docs/guides/local-development/diff-engines) describe mecanismos de captura distintos y diferencias con versiones antiguas de la CLI; la salida concreta deberá verificarse contra la auditoría, sin asumir que un pull reproduce por sí solo los catálogos.

**STILL NOT VERIFIED FOR THIS PROJECT:** versión de CLI disponible, motor elegido, contenido real del historial remoto, posibles conflictos con las futuras versiones T0/T1, secuencia exacta de comandos más segura y recuperación ensayada en un entorno desechable. Fase 3F elegirá entre aceptar un registro soportado desde un flujo de baseline apropiado o usar `migration repair --status applied`, según el historial y el comportamiento observados entonces. No se escribe manualmente en tablas internas de migraciones ni se prescribe ahora una secuencia de ejecución específica.

Antes de adoptar, una comprobación posterior autorizada deberá contrastar el estado vigente con la evidencia aprobada; la auditoría del 2026-09-30 no demuestra ausencia de drift posterior. Si hubo cambios, detener la adopción y reconciliar evidencia y artefactos mediante revisión. No sobrescribir producción para hacerla coincidir con el snapshot.

## Proposed repository layout

Convención elegida: **una migración estructural completa + una migración de datos operativos**, seguidas por migraciones incrementales inmutables. `T0`, `T1` y `T2` representan timestamps válidos y únicos con `T0 < T1 < T2`, por asignar; no son nombres ejecutables. Estructura futura, no archivos creados en Fase 3A:

```text
supabase/
  .gitignore
  config.toml
  README.md
  migrations/
    <T0>_baseline_structure.sql
    <T1>_baseline_operational_catalogs.sql
    <T2>_<cambio_intencional>.sql
  verification/
    baseline_expected.json
  seed.sql                                      (opcional, solo desarrollo)
  dropkiller_sweet_spot_candidates_add_uuid.sql  (histórico, fuera del runner)
  dropkiller_sweet_spot_candidates_fix_search_path.sql (histórico, fuera del runner)
src/lib/supabase/database.types.ts               (salida generada)
```

La estructura en un solo archivo permite ordenar todas las dependencias y revisar un estado coherente sin reconstruir una historia ficticia. Separar los 260 registros de catálogo mantiene revisables estructura y configuración; ambas migraciones son obligatorias para declarar reconstruido el baseline. No dividir por tabla ni reproducir los parches históricos como pasos iniciales.

`config.toml` fijará la configuración local compatible, sin secretos; README documentará versiones, prerrequisitos, reconstrucción, validación, adopción y exclusión de parches. `baseline_expected.json` será un manifiesto verificable de definiciones y filas esperadas derivado de la evidencia, revisado independientemente de las migraciones; no será otro mecanismo de carga ni una fuente editable paralela. Migraciones y runbook deben permitir reconstruir sin consultar el Markdown de Fase 2.

No se necesita seed para los catálogos. Si después se necesitan fixtures ficticios de desarrollo, usar `seed.sql` optativo, separado y excluido del procedimiento de producción. No incluir datos reales, usuarios, tokens ni configuración secreta. No modificar archivos ya adoptados; corregir mediante nuevas migraciones.

## Dependency order

Orden de creación en un destino limpio:

1. **Prerrequisitos:** plataforma Supabase compatible, roles estándar, `auth.users`, `auth.uid()` y schema `extensions`. Verificar disponibilidad de `pgcrypto` 1.3 y `uuid-ossp` 1.1 observadas; documentar su provisión soportada sin recrear objetos internos del proveedor.
2. **Tipos:** los nueve enums con valores y orden exactos; cualquier dependencia adicional requiere evidencia, no inferencia.
3. **Tablas:** 23 tablas con columnas en orden, tipos, precisión, nullability, defaults e identidades. Las dependencias de defaults deben existir antes. Crear todas antes de las FKs.
4. **Constraints locales:** 23 PK, 10 UNIQUE y 1 CHECK con nombres y definiciones observadas. Preservar la semántica NULL de la unicidad.
5. **Foreign keys:** las 18 FKs, incluidas acciones de borrado y referencia a `auth.users`; no crear esa tabla gestionada.
6. **Índices restantes:** expresiones, orden, unicidad y predicados exactos. No duplicar índices ya creados por PK/UNIQUE; el total final debe ser 66.
7. **Funciones/RPCs no trigger:** tablas primero; `dropkiller_sweet_spot_candidates_scored_v3` antes de su wrapper. Crear `is_authenticated_active_user` antes de policies. Preservar las firmas y cuerpos restantes.
8. **Funciones de trigger y triggers:** crear las cuatro funciones de trigger, incluidos objetos sin trigger asociado observado; luego los siete triggers `public` y el de `auth.users`.
9. **RLS:** habilitado en las 23 tablas y no forzado.
10. **Policies:** las 39 con roles, comandos, modo permisivo/restrictivo y expresiones exactas, sin añadir policies a tablas que no las tienen.
11. **Permisos:** grants de schema, tablas, secuencias y EXECUTE por firma, incluido `PUBLIC`. Verificar el resultado de ACL contra evidencia; no confundir defaults del entorno de prueba con permisos demostrados en producción.
12. **Catálogos operativos:** segunda migración, ambas tablas inicialmente vacías, valores explícitos íntegros y orden determinista. Usar el contexto de migración autorizado del destino limpio, sin desactivar RLS ni cambiar políticas para cargar datos.
13. **Secuencia de catálogo:** ajustar el generador de `status_catalog` después de restaurar IDs explícitos para evitar colisiones; validar el resultado en el destino limpio.
14. **Tipos TypeScript:** generar después del schema y catálogos como artefacto derivado, nunca como definición de la base.

Este orden adelanta todas las tablas antes de FKs y todas las funciones usadas por triggers/policies antes de estos. No deshabilitar comprobación de cuerpos para ocultar dependencias faltantes. El bootstrap no debe recibir tráfico de aplicación ni crear usuarios mientras esté incompleto.

### Supabase-managed `auth.users`

`profiles.id` referencia `auth.users(id)` con borrado en cascada. `public.handle_new_user()` y el trigger observado `trg_on_auth_user_created` forman la integración de la aplicación con Auth. Crear ese trigger AFTER INSERT únicamente cuando Supabase ya provea `auth.users` y existan `profiles`, su FK y la función pública; antes de habilitar altas de usuarios en el destino reconstruido. No recrear `auth`, importar usuarios ni reemplazar triggers del proveedor. Si el trigger ya existe en un supuesto destino limpio, revisar el destino en vez de sobrescribirlo.

## Identity and sequence strategy

Expresar las 18 identidades como `GENERATED ALWAYS AS IDENTITY` en sus tablas, manteniendo nombres/asociaciones de secuencia observados; no mantener DDL redundante de creación de esas mismas secuencias. Verificar las 18 secuencias resultantes, su asociación, propiedad `postgres` observada y permisos. La ausencia de ID autogenerado en otras tablas se preserva.

Conservar todos los IDs de `status_catalog`, aunque la auditoría no encontró FKs que los referencien: facilita comparación exacta y evita introducir diferencias gratuitas. La futura carga debe usar el mecanismo PostgreSQL soportado para valores explícitos de identidad ALWAYS, sin cambiarla a BY DEFAULT. Después, dejar el próximo ID por encima del máximo restaurado, **263**. El siguiente sería 264 si se confirma incremento 1; ese incremento y otros parámetros no se deducen del nombre de la secuencia.

**NOT VERIFIED:** Fase 2 no registró inicio, incremento, límites, cache/cycle ni posición actual de las secuencias. Verificar parámetros estructurales antes de cerrar su SQL. Las posiciones de secuencias de tablas transaccionales pobladas no se copian a una reconstrucción vacía; son estado de datos, no schema. La inicialización segura del catálogo no afirma reproducir su contador histórico live y nunca se ejecutará durante la adopción de producción. `wallet_movement_catalog` usa `identification_code` textual como PK, sin secuencia.

## Catalog versioning strategy

El mecanismo primario será **la migración obligatoria `<T1>_baseline_operational_catalogs.sql`**. Seeds opcionales podrían omitirse y no son adecuados para configuración crítica. Fase 3C transcribirá los JSONL verificados a valores explícitos, sin dependencia de lectura del informe en tiempo de ejecución.

- `status_catalog`: preservar exactamente las 185 filas y sus ocho columnas, incluidos IDs, NULL, notas, booleanos y timestamps. Conservar categorías, los dos pares genéricos duplicados y diferencias de casing; no normalizar, deduplicar ni reclasificar. Ordenar por ID.
- `wallet_movement_catalog`: preservar exactamente las 75 filas y sus cinco columnas, incluidos códigos textuales, nombres, categorías y timestamps. Ordenar por código; no convertirlo a número ni clasificar por descripción.
- La carga inicial presupone ambas tablas vacías y debe fallar ante un destino inesperadamente poblado. No usar upserts ni defaults temporales que alteren filas capturadas. Verificar que los triggers existentes no cambien esos valores durante la carga.
- Después de adoptar el baseline, adiciones, reclasificaciones y desactivaciones serán **migraciones de datos versionadas**, con precondiciones y resultado esperado revisables. No pueden quedar solo en el dashboard ni en una edición no versionada de la aplicación. Esta fase establece la regla; no cambia UI, permisos ni catálogos.

## Functions and RPC strategy

Incluir las definiciones live exactas de las 15 funciones. Nueve son RPC invocados literalmente por la aplicación: `customer_directory_v1`, `dinero_en_la_calle`, `dropkiller_sweet_spot_candidates`, `product_order_summary`, `reporte_semanal`, `task_completions_by_user`, `task_handling_time_by_user`, `wallet_daily_summary` y `wallet_summary`. Dos son helpers no trigger: `dropkiller_sweet_spot_candidates_scored_v3` e `is_authenticated_active_user`. Las cuatro funciones que retornan `trigger` son `handle_new_user`, `resolve_wallet_movement_order_id`, `set_updated_at` y `update_updated_at`.

Preservar lenguaje, argumentos/defaults, orden y tipos de retorno, volatilidad, SECURITY DEFINER/invoker, configuración `search_path`, cuerpos y EXECUTE observado. No sustituir el wrapper actual por los parches históricos, simplificar cálculos, agregar `search_path` defensivo ni eliminar `update_updated_at` por no tener trigger asociado observado. Las tres DEFINER son `handle_new_user`, `resolve_wallet_movement_order_id` e `is_authenticated_active_user`; las otras doce son invoker.

La auditoría no registró propietarios de funciones/tablas ni todos los defaults de sesión/rol que pueden afectar nombres no calificados. **NOT VERIFIED:** esos metadatos, especialmente el dueño efectivo de funciones DEFINER. Deben aclararse antes de cerrar una reproducción fiel; no asumir que ejecutar todo como `postgres` demuestra equivalencia de seguridad.

## RLS and grants strategy

Reproducir RLS habilitado y no forzado en las 23 tablas y las 39 policies exactas: nombre, comando, roles, modalidad, USING y WITH CHECK, incluida ausencia de expresión donde corresponde. Conservar las dos tablas sin policies y la política UPDATE de `profiles` tal como está. Esta no es la fase de endurecimiento de autorización.

Reproducir grants observados: siete privilegios de tabla para cada uno de `anon`, `authenticated`, `service_role` y `postgres`; EXECUTE de las 15 funciones para esos roles y para `PUBLIC`; USAGE observado de secuencias y privilegios de schema. RLS no gobierna TRUNCATE/REFERENCES; reproducir grants no acredita su alcance efectivo mediante JWT/PostgREST, que permanece sin verificar. No revocar permisos por interpretación de riesgo durante el baseline.

No crear ni alterar roles gestionados (`anon`, `authenticated`, `service_role`, `authenticator`, `postgres`, `supabase_*` u otros del proveedor), sus contraseñas ni membresías. Son prerrequisitos; referenciarlos en grants/policies cuando corresponda. **No crear `crm_mcp_reader`**, ausente live en Fase 2. La auditoría de USAGE de secuencias no demuestra todos sus posibles privilegios; tampoco capturó default ACL completos. No inventar una política de permisos futuros a partir de grants actuales: resolver esas limitaciones antes de declarar equivalencia de ACL.

## Existing SQL files

`supabase/dropkiller_sweet_spot_candidates_add_uuid.sql` y `supabase/dropkiller_sweet_spot_candidates_fix_search_path.sql` permanecerán en su ubicación como parches históricos, fuera de `migrations/`. README los marcará como referencia no ejecutable por el flujo de reconstrucción. No moverlos, borrarlos ni editarlos en Fase 3A.

El baseline incluirá directamente la definición final live de Dropkiller y su función base. El runner futuro solo descubrirá migraciones en la ubicación estándar; nunca recorrerá todos los SQL de `supabase/` con un glob recursivo. No registrar esos parches como historia aplicada sin evidencia ni volver a aplicarlos sobre la definición final.

## Generated TypeScript types

En Fase 3D, generar tipos con el mecanismo Supabase soportado, cuya versión y uso se verificarán entonces, desde la base desechable ya reconstruida con estructura y catálogos. Comparar primero una salida temporal con `src/lib/supabase/database.types.ts`; después versionar la salida generada revisada. No parchear manualmente como solución primaria.

Esperar las diferencias de aplicación confirmadas: `internal_messages`, `meta_campaigns`, `orders.pausar_tareas_automaticas boolean NOT NULL DEFAULT false` y `customer_directory_v1`. Fase 2 no realizó una generación nueva soportada. No agregar manualmente `handle_new_user`, `resolve_wallet_movement_order_id`, `set_updated_at` ni `update_updated_at`: que aparezcan o no lo determinará el generador, no su sola existencia en PostgreSQL. Separar reconciliación de tipos de cualquier cambio de lógica; si aparecen incompatibilidades, reportarlas y acotar su resolución en la fase correspondiente.

## Validation strategy

Destino: stack Supabase local desechable compatible con PostgreSQL 17 y los prerrequisitos del proveedor; si no está disponible, proyecto Supabase desechable separado, con identidad explícitamente verificada. PostgreSQL vacío sin Auth/roles no basta. No recrear a mano un falso `auth.users`, usar credenciales de producción ni habilitar integraciones de negocio para validar. Fijar versiones y configuración antes de implementar SQL; toda incompatibilidad debe explicarse, no ocultarse.

Fases 3B/3C harán una reconstrucción preliminar para probar dependencias y permitir generación en 3D. **Fase 3E repetirá desde un entorno realmente limpio**, usando únicamente artefactos versionados, sin estado residual ni pasos manuales del autor. Comparar resultados con el manifiesto derivado y revisado contra Fase 2:

- 23 tablas, 244 columnas: nombres, orden, tipos/precisión, nullability, defaults e identidad; ausencia de vistas/materializadas según alcance.
- Nueve enums: cada etiqueta y orden exactos; 18 secuencias: asociaciones y parámetros estructurales verificados.
- 52 constraints y 66 índices: nombres, definiciones, columnas/expresiones, referencias, acciones, unicidad y predicados; no solo totales.
- 15 funciones: firmas/defaults, retornos, lenguaje, volatilidad, seguridad, configuración y cuerpos; siete triggers públicos y el trigger Auth con timing, eventos y funciones exactos.
- Flags RLS en todas las tablas, 39 policies completas y grants relevantes de schema/tablas/secuencias/funciones, incluidos PUBLIC y los roles existentes. Resolver límites de propiedad/ACL antes de aprobar.
- Catálogos: igualdad de todas las columnas/fila contra valores capturados, con orden determinista y timestamps comparados sin perder precisión. Los conteos son smoke checks, no prueba de equivalencia.

Permitir únicamente diferencias de representación explicadas (por ejemplo formato de metadatos entre versiones compatibles); nunca normalizar cuerpos, casing o NULL para ocultar diferencias semánticas. Guardar resultados y discrepancias con versión de herramientas y destino; cualquier diferencia no justificada bloquea aprobación. Las verificaciones futuras deben inspeccionar metadatos y catálogos sin ejecutar funciones de negocio sobre producción.

### Catalog-specific validation

`status_catalog`: 185 filas, 185 IDs distintos, máximo 263, todas activas, 41 `sin_clasificar`, 23 transportadoras NULL y distribución exacta por categoría. Deben persistir los duplicados genéricos 259/261 (`EN CIUDAD DE ORIGEN DEVOLUCIÓN`) y 260/262 (`ENTRADA A CENTRO DE DISTRIBUCION`), y los pares por casing 60/229, 61/233, 64/251 y 105/216. Conservar las categorías diferentes de 60/229. Verificar que el próximo ID no colisionaría sin consumir secuencias de producción.

`wallet_movement_catalog`: 75 filas, igualdad de valores y distribución por categoría; códigos únicos, sin NULL ni blancos. Estas pruebas deben detectar cualquier pérdida, normalización o reclasificación accidental; no corregir los casos preservados.

## Production safety gates

Antes de tocar siquiera el historial de migraciones de producción en Fase 3F:

1. Reconstrucción limpia exitosa y comparación de definiciones y catálogos aprobada; baseline completo y tipos versionados, sin diferencias inexplicadas.
2. Metadatos faltantes resueltos, historial remoto inspeccionado bajo autorización posterior y ausencia de drift desde la evidencia aprobada comprobada. Confirmar identidad de producción por separado de la del destino desechable.
3. Procedimiento oficial vigente de adopción Supabase verificado, con comandos exactos y versión documentados; ensayo de adopción sobre schema ya creado en entorno desechable y revisión del runbook.
4. Confirmación explícita en la revisión de ejecución: **ninguno de los dos cuerpos del baseline se ejecutará contra producción**. No hay carga de catálogos, reset, replay de DDL ni cambio del contador de IDs en esa operación.
5. Captura previa del historial de migraciones y procedimiento de recuperación de esos metadatos probado: restaurar únicamente el estado de registro afectado mediante mecanismo soportado, sin borrar objetos/datos del CRM. No improvisar SQL contra tablas internas. Si una adopción queda parcial, detener futuras aplicaciones, comparar el historial y recuperar según el runbook.
6. Verificación posterior de versiones registradas y ausencia de cambios en schema/catálogos; no aplicar automáticamente migraciones posteriores durante la adopción. La recuperación de datos de negocio es una responsabilidad separada del historial.

No se satisface ningún gate de ejecución por aprobar este documento. No ligar adopción a un push de aplicación o deploy de Vercel.

## Future database change rule

Después de Fase 3, todo cambio intencional de tablas, columnas, enums, constraints, índices, funciones/RPCs, triggers, RLS, policies, grants o catálogos operativos deberá existir en control de versiones. Dirección normal: **migración/configuración en Git → revisión → aplicación a la base → verificación**. No dashboard manual → drift sin documentar. Registrar esta regla en `AGENTS.md` en una fase posterior autorizada; ese archivo no cambia en 3A.

Excepción de emergencia: si es imprescindible un cambio manual urgente, registrar inmediatamente el cambio exacto, crear el artefacto equivalente versionado y reconciliar live, repo e historial sin volver a ejecutar ciegamente una operación ya realizada. No dejar la solución solo en producción ni alterar una migración antigua para simular que siempre existió.

## Backup boundary

Reproducibilidad de schema no es backup transaccional. Fase 3 protege estructura, políticas, funciones y configuración de los dos catálogos auditados. Pedidos, clientes, tareas, historial de estados, movimientos wallet, mensajes y demás datos de negocio necesitan backups separados. Tampoco se capturaron filas de otras tablas de configuración: no inventar ni importar esos contenidos. La reconstrucción será de definición y catálogos verificados, no un clon operativo completo de producción. No se diseña el sistema de backups aquí.

## Phase decomposition

### Phase 3B — structural baseline

Tras revisión del plan y resolución de los metadatos estructurales pendientes, implementar una migración de estructura, funciones, triggers, RLS y grants; configuración local/runbook mínimos y manifiesto estructural. Probar creación en destino limpio desechable. Sin catálogos ni correcciones. No tocar producción.

### Phase 3C — operational catalogs

Implementar la segunda migración obligatoria con ambos catálogos exactos y el ajuste de secuencia de catálogo; completar expectativas de validación y comprobar carga en el destino desechable. No normalizar datos.

### Phase 3D — generated types

Generar desde la reconstrucción 3B+3C, comparar y reconciliar tipos con la salida soportada. El artefacto generado no redefine el baseline ni exige que todos los objetos PostgreSQL sean expuestos como RPC.

### Phase 3E — clean reconstruction validation

Repetir reconstrucción desde cero con artefactos versionados y probar equivalencia de definiciones y filas, no solo conteos. Completar runbook, evidencia de validación y regla futura en `AGENTS.md` bajo autorización de esa fase. La prueba preliminar de 3B/3C no sustituye esta aceptación independiente.

### Phase 3F — production migration-history adoption

Después de todos los gates, adoptar ambas versiones mediante el procedimiento soportado verificado, sin replay de estructura ni datos. Revisar historial antes/después y estado de producción sin mezclar correcciones. Solo desde entonces aplicar normalmente nuevas migraciones posteriores.

### Unresolved before SQL / adoption

- **Antes de cerrar SQL estructural:** versión de CLI y motor de diff (`migra` o `pg-delta`) fijados en la futura configuración, cobertura del trigger propio en `auth.users` y entorno Supabase compatible; provisión de extensiones y prerrequisitos Auth; propietarios de tablas/funciones (críticos para DEFINER), parámetros estructurales de secuencias, ACL completos relevantes y defaults de resolución de nombres no capturados. Requieren evidencia adicional acotada y autorización en una fase posterior; no consultas en 3A ni supuestos silenciosos.
- **Antes de fijar versiones/adoptar:** historial remoto real, eventuales conflictos T0/T1 y drift posterior a Fase 2. El repositorio no prueba que el historial remoto esté vacío.
- **Antes de 3D/3F:** mecanismo y versión de generación de tipos; elección y secuencia exacta de adopción entre los mecanismos oficiales ya documentados, comportamiento con la CLI elegida y recuperación ensayada. La existencia de soporte para registrar una versión aplicada sin ejecutar SQL está verificada; su aplicación segura a este proyecto aún no.
- Schemas gestionados completos, autorización efectiva de JWT/PostgREST, otros datos de configuración, scheduler Dropi y provisión MCP siguen fuera de la evidencia/alcance; este plan no los resuelve.

## Explicitly deferred corrective migrations

Fuera del baseline: duplicados de estados; normalización/casing de transportadora; revisión de `sin_clasificar`; endurecimiento de autorización/RLS; grants amplios y PUBLIC EXECUTE; política UPDATE de `profiles`; provisión MCP; cambios del Task Engine; titularidad de Shopify sobre el ciclo de vida; completitud de wallet; resolución arquitectónica de `estado_crm`. Requerirán fases propias y, cuando corresponda, migraciones correctivas posteriores. No se elige aquí su solución.

## Phase 3 completion criteria

Fase 3 completa requiere: toda definición live verificada necesaria para el CRM versionada; ambos catálogos reproducibles; tipos generados desde ese schema; reconstrucción limpia exitosa; definiciones/filas equivalentes a la evidencia aprobada de Fase 2 y sus aclaraciones verificadas; historial brownfield adoptado de forma segura; reglas futuras documentadas en `AGENTS.md`; ninguna corrección de comportamiento incorporada silenciosamente. Los límites y dependencias del proveedor deben permanecer explícitos.

**Fase 3A solo completa el plan. El invariante de reproducibilidad y los demás invariantes continúan sin declararse satisfechos.**
