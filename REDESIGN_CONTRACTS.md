# CRM Pakora v4 — matriz de contratos anti-regresión

Este archivo es la fuente de verdad del Gate G0 para el rediseño. Describe los
comportamientos que deben sobrevivir a cambios visuales, refactors y nuevas
rutas. Una diferencia de UI no autoriza a cambiar un contrato funcional,
operativo, financiero o de datos.

## 1. Línea base y aislamiento

| Elemento | Valor verificado | Contrato | Protección |
| --- | --- | --- | --- |
| Commit base | `3ffd66aad1cb0a11f4228b439f07e512b877b255` | Toda comparación de regresión parte de este commit. | `BASE-001` — verificado manualmente |
| Rama de trabajo | `redesign/crm-v4` | Ningún commit parcial del rediseño entra directamente a `main`. | `BASE-002` — verificado; CI configurado |
| Tag de recuperación | `pre-crm-v4-20260728` | Punto inmutable previo al primer cambio del rediseño. | `BASE-003` — verificado manualmente |
| Producción | Fuera de alcance de pruebas mutables | Toda escritura automatizada usa exclusivamente Supabase staging y registros fixture. | `ENV-001` — staging `qmpcthkbrckjeedbxgkw` auditado y allowlisted; producción denylisted |
| Zona operativa | `America/Bogota` | Fechas relativas, “Hoy” y fixtures se calculan explícitamente en esta zona. | `TIME-001` — planificado |

### 1.1 Exclusiones protegidas del usuario

Los siguientes archivos o directorios ya existían fuera del alcance del
rediseño. No se deben mover, editar, añadir al índice, borrar ni usar como lugar
para nuevos artefactos de QA:

- `docs/`
- `src/app/api/dropi-order-create-test/`
- `src/lib/dropi/createDropiOrderCO.test.ts`
- `src/lib/dropi/createDropiOrderCO.ts`
- `whatsapp-bridge/.env.staging`

`whatsapp-bridge/.env.staging` se considera secreto y propiedad del usuario.
Cuando el usuario autorice staging, los procesos pueden cargar sus variables
directamente en memoria, pero nunca imprimir, copiar a otro archivo, versionar,
editar ni inferir sus valores. El archivo debe conservar permisos restrictivos.

Protección planificada: `TREE-001` comparará únicamente la lista esperada de
rutas sin seguimiento antes y después de cada gate. Estado: **planificado**.

### 1.2 Estados de automatización

- **Verificado**: comprobado en la línea base, pero aún debe incorporarse a CI.
- **Planificado**: tiene identificador estable y debe convertirse en prueba al
  llegar a la fase indicada.
- **Bloqueado staging**: la prueba está especificada, pero no puede ejecutarse
  hasta disponer de un proyecto Supabase aislado y fixtures.
- **Bloqueante**: cuando exista la prueba, su fallo detiene el gate; no se
  actualizarán snapshots para ocultarlo.

### 1.3 Seguridad y readiness de G0

| ID | Estado verificable | Invariante | Protección |
| --- | --- | --- | --- |
| `ENV-PUBLIC-001` | Suite pública local/read-only | Next arranca con las tres variables Supabase vacías; requests HTTP se abortan fuera del origen local y WebSockets se interceptan/cancelan antes de conectar a hosts externos; proyectos mutables ni Auth se cargan. | Playwright `102` aprobadas / `7` skips intencionales; CI ejecuta guard vacío antes de UI |
| `ENV-MUT-001` | Ejecución mutable fail-closed | Solo `VERCEL_ENV=preview`, origen HTTPS exacto, ref Supabase en allowlist positiva versionada, marker staging read-only, habilitación literal y secretos completos. La allowlist contiene únicamente `CRM staging` (`qmpcthkbrckjeedbxgkw`). | `staging-guard.spec.ts`; `test:e2e:guard:empty`; marker real verificado con service-role y bloqueado para anon |
| `ENV-DEPLOY-001` | Identidad real del preview | El propio deployment debe atestiguar mismo origen, ref, entorno preview y marker mediante `/api/e2e/attestation`; redirects o drift de identidad bloquean la suite. El runner exige una capacidad Vercel separada y la envía solo por header al origen Preview: nunca en URL, cookie persistida, respuesta ni requests Supabase. | ramas `404/401/503/409/200` automatizadas; bypass ausente/malformado, header limitado por origen y WebSocket solo Supabase automatizados; smoke HTTP local `404`; ejecución live bloqueada staging |
| `ENV-AUTH-001` | Auth staging | Sin credenciales no se crea storage state vacío. Login exige `/pedidos`, navegación principal y heading real; artefactos de Auth están desactivados. | proyecto `auth` dependiente de guard; bloqueado staging real |
| `SCHEMA-READINESS-001` | Schema y tipos auditados | El scanner AST usa fuentes rastreadas —excluye los archivos protegidos del usuario— y falla ante cualquier tabla, RPC o columna live ausente dentro de llamadas literales `.from()`/`.rpc()`. Wrappers y nombres dinámicos quedan fuera de su prueba. | baseline schema-only y fingerprint versionados; `schema-readiness.spec.ts`; `schemaTypesReady=true` |
| `FIXTURE-LOGICAL-001` | Contrato lógico determinista | Manifiesto inmutable con claves `FX-*`, sin PK hardcodeadas y anclado a Bogotá. Sus oráculos prueban coherencia de escenarios, no fórmulas privadas ni RPC. El adaptador DB está bloqueado. | paridad productiva real: historial Dropi, resultados de tareas y teléfono WhatsApp; resto marcado `scenarioOnly` |

La deuda conocida de tipos quedó resuelta regenerando desde el schema auditado
de staging, no mediante tipos inventados. La paridad estructural comprobada es:
21 tablas, 221 columnas, 9 enums/52 valores, 47 constraints, 14 funciones,
30 índices, 34 políticas, 21 tablas con RLS, 8 triggers y una publicación
Realtime. Dentro de su alcance literal, el scanner queda verde; no se interpreta
como auditoría completa de wrappers o SQL dinámico.
El contrato lógico cubre CO/MX, cinco estados CRM, las trece categorías de
`status_catalog`, los cinco tipos de tarea, vencida/hoy/futura/pospuesta,
notificaciones `99+`, WhatsApp, abandonados, wallet, productos y costeos. El
caso canónico `#1007: 118 = 39 + 78 + 1` sí se compara con
`getCustomerHistoryStats`, la función productiva usada por ambos drawers. Las
demás cifras marcadas `scenarioOnly` son casos QA esperados, no evidencia de
paridad con código privado o RPC. Nada de esto autoriza una escritura hasta
cerrar schema, Auth, RLS, marker y allowlist de staging.

## 2. Contratos de rutas

### 2.1 Rutas actuales que deben permanecer funcionales

| ID | Ruta | Contrato actual | Evolución v4 permitida | Protección |
| --- | --- | --- | --- | --- |
| `ROUTE-001` | `/` | Redirige a `/pedidos`. | Solo cambiará a `/hoy` después de que `/hoy` apruebe G9. | `E2E-ROUTE-001` — planificado G9 |
| `ROUTE-002` | `/login` | Acepta `error`; muestra login por correo/contraseña; no ofrece registro público. | Puede cambiar su presentación y ofrecer tema, no el flujo de Auth. | `E2E-AUTH-PUBLIC-001` — automatizado read-only; login mutable bloqueado staging |
| `ROUTE-003` | `/set-password` | Requiere sesión de invitación; sin sesión muestra enlace inválido; contraseña mínima de 8 caracteres. | Solo rediseño visual; PKCE y permisos no cambian. | `E2E-AUTH-PUBLIC-002` — invitación inválida automatizada; invitación válida bloqueada staging |
| `ROUTE-004` | `/auth/callback` | Completa el callback de autenticación existente. | Contrato técnico sin cambios. | `E2E-AUTH-003` — bloqueado staging |
| `ROUTE-005` | `/pedidos` | Lista paginada de pedidos y subvista de abandonados; conserva filtros y abre el drawer por URL. | La lista puede pasar de cards a tabla/cards responsive sin cambiar consulta, conteo o navegación. | `E2E-ORD-001` — bloqueado staging |
| `ROUTE-006` | `/tareas` | Cola filtrable; selección de pedido/tarea por URL; completar puede avanzar a la siguiente tarea visible. | Puede cambiar jerarquía y composición, no acciones ni orden vigente. | `E2E-TASK-001` — bloqueado staging |
| `ROUTE-007` | `/clientes/[telefono]` | Perfil legado por teléfono exacto; hoy consulta pedidos locales coincidentes. | En G7 aceptará `pais` para enlaces nuevos, separará Dropi/Pakora y mantendrá enlaces antiguos sin `pais`. | `E2E-CUST-001` — bloqueado staging |
| `ROUTE-008` | `/notificaciones` | Historial paginado por usuario, 20 filas por página. | En G8 redirigirá a `/alertas`; bookmarks y destinos profundos siguen válidos. | `E2E-ALERT-LEGACY-001` — bloqueado staging |
| `ROUTE-009` | `/costeos` | Entrada existente al módulo de costeos. | Se conserva como entrada compatible. | `E2E-COST-001` — bloqueado staging |
| `ROUTE-010` | `/costeos/co` y `/costeos/mx` | Lista y calculadora separadas por país; selección de un costeo por URL. | Rediseño visual sin mezclar monedas ni fórmulas. | `E2E-COST-002` — bloqueado staging |
| `ROUTE-011` | `/command-center` | Hub de Finanzas, Métricas, Investigación y Productividad. | En G9 pasa a ser hub secundario “Más / Herramientas”; subrutas no cambian. | `E2E-NAV-001` — planificado G9 |
| `ROUTE-012` | `/command-center/finanzas` | Analítica financiera con rango de fechas. | Jerarquía visual nueva; RPC e invariantes sin cambios. | `E2E-FIN-001` — bloqueado staging |
| `ROUTE-013` | `/command-center/metricas` | Resumen histórico por producto. | Tabla/cards responsive; mismo RPC y denominadores. | `E2E-METRIC-001` — bloqueado staging |
| `ROUTE-014` | `/command-center/productividad` | Productividad por usuario y rango. | Nueva presentación; mismos RPC, rango y zona temporal. | `E2E-PROD-001` — bloqueado staging |
| `ROUTE-015` | `/command-center/investigacion` | Vistas sugeridos/guardados, búsqueda por producto y país. | Nueva jerarquía; fuentes y mutaciones existentes. | `E2E-RESEARCH-001` — bloqueado staging |
| `ROUTE-016` | `/configuracion/asistente` | Lee y guarda las reglas reales del asistente. | Se integra al shell de Configuración; no se inventan secciones sin backend. | `E2E-SETTINGS-001` — bloqueado staging |
| `ROUTE-017` | `/api/orders/[id]` | `GET` autenticado devuelve `{ order, statusHistory, tasks, comentarios, whatsappMessages }`; ID inválido `400`, ausente `404`, error de lectura `500`. | Es contrato público inmutable durante el rediseño. | `API-ORD-001` — bloqueado staging |
| `ROUTE-018` | `/api/cron/*`, `/api/webhooks/*`, `/api/fx/mxn-cop` | Integraciones, cron, conciliación, webhooks y FX existentes. | El rediseño no cambia payloads, autorización ni efectos. | `API-SMOKE-001` — planificado read-only/config; mutaciones aisladas |
| `ROUTE-QA-001` | `/api/e2e/attestation` | Solo existe operativamente en Vercel Preview, omite exclusivamente el redirect de sesión del middleware, exige su propio secreto staging y devuelve únicamente identidad no sensible después de verificar marker read-only. En producción responde `404`. | `ENV-DEPLOY-001` — handler `404/401/503/409/200` y HTTP local `404` sin redirect automatizados; live bloqueado staging |

### 2.2 Nuevas rutas v4

| ID | Ruta | Contrato objetivo | Condición de activación | Protección |
| --- | --- | --- | --- | --- |
| `ROUTE-V4-001` | `/hoy` | Resumen operativo server-side con fecha Bogotá y CTA a contratos existentes. | Debe estar completa antes de exponer navegación o cambiar `/`. | `E2E-TODAY-001` — planificado G9 |
| `ROUTE-V4-002` | `/clientes` | Directorio paginado por `pais + telefono` exacto usando `customer_directory_v1`. | RPC read-only, tipos regenerados y página aprobada antes de mostrar el enlace. | `E2E-CUST-DIR-001` — planificado G7 |
| `ROUTE-V4-003` | `/alertas` | Inbox sobre `notifications`, sin inventar estado “resuelta”. | Realtime, lectura/no lectura y deep links verdes antes de redirigir `/notificaciones`. | `E2E-ALERT-001` — planificado G8 |

No se publicará en el shell ningún destino v4 antes de que exista y tenga al
menos un smoke de navegación aprobado.

## 3. Contratos de parámetros de URL

Los parámetros desconocidos no deben provocar una mutación. Los valores
inválidos conocidos regresan a los defaults actuales y los filtros preservan
parámetros ajenos, especialmente `detalle` y `tareaId`, salvo cuando la acción
es explícitamente cerrar el drawer o limpiar todos los filtros.

| ID | Ruta | Parámetros y semántica | Protección |
| --- | --- | --- | --- |
| `QUERY-ORD-001` | `/pedidos` | `vista=pedidos\|abandonados`; default `pedidos`. | `E2E-ORD-QUERY-001` — bloqueado staging |
| `QUERY-ORD-002` | `/pedidos` | `pais=CO\|MX`; `estado_crm=nuevo\|en_ruta\|entregado\|cancelado\|devolucion`; `nivel_riesgo=alto\|medio\|bajo\|sin_datos`; `q`; `page>=1`. | `E2E-ORD-FILTER-001` — bloqueado staging |
| `QUERY-ORD-003` | `/pedidos` | `fecha_desde` y `fecha_hasta` usan `YYYY-MM-DD`; un extremo se replica al faltante y fechas invertidas se ordenan cronológicamente. | `E2E-ORD-DATE-001` — bloqueado staging |
| `QUERY-ORD-004` | `/pedidos` | `detalle=<order.id>` selecciona el pedido exacto; cerrar elimina solo este parámetro. | `E2E-ORD-DEEP-001` — bloqueado staging |
| `QUERY-ORD-005` | `/pedidos?vista=abandonados` | `estado_abandonado=nuevo\|contactado\|recuperado\|descartado`; `pais`; `page`. | `E2E-ABAN-FILTER-001` — bloqueado staging |
| `QUERY-TASK-001` | `/tareas` | `estado_vista=abiertas\|completadas\|pospuestas\|todas`; default `abiertas`. | `E2E-TASK-VIEW-001` — bloqueado staging |
| `QUERY-TASK-002` | `/tareas` | `tipo` acepta los cinco tipos vigentes; `pais=CO\|MX`; `vencidas=true\|false`; `q`. | `E2E-TASK-FILTER-001` — bloqueado staging |
| `QUERY-TASK-003` | `/tareas` | `detalle=<order.id>` abre el drawer y `tareaId=<task.id>` selecciona exactamente esa tarea del pedido. | `E2E-TASK-DEEP-001` — bloqueado staging |
| `QUERY-FIN-001` | Finanzas y Productividad | `range=7\|30\|90`, default `30`; `range=custom` requiere `from` y `to` válidos y ordenados en `YYYY-MM-DD`; si no, vuelve al rango válido/default. | `E2E-RANGE-001` — bloqueado staging |
| `QUERY-NOTIF-001` | `/notificaciones` | `page>=1`; valores inválidos usan 1; una página mayor al total redirige a la última disponible. | `E2E-NOTIF-PAGE-001` — bloqueado staging |
| `QUERY-COST-001` | `/costeos/co`, `/costeos/mx` | `costeo=<id>` selecciona solo un registro del país de la ruta; `guardado=1` e `importe=1` muestran confirmación. | `E2E-COST-QUERY-001` — bloqueado staging |
| `QUERY-RESEARCH-001` | Investigación | `vista=sugeridos\|guardados`; `producto` máximo 100 caracteres; `pais_producto=CO\|MX`. | `E2E-RESEARCH-QUERY-001` — bloqueado staging |
| `QUERY-SETTINGS-001` | Configuración | `guardado=1` muestra confirmación de guardado. | `E2E-SETTINGS-QUERY-001` — bloqueado staging |
| `QUERY-CUST-001` | `/clientes/[telefono]` | El segmento sigue siendo el teléfono exacto. G7 añade `pais=CO\|MX`; sin país se conserva resolución compatible del enlace antiguo. | `E2E-CUST-QUERY-001` — planificado G7 |
| `QUERY-ALERT-001` | `/alertas` | G8 añadirá tab, lectura y tipo en URL sin alterar el destino profundo del elemento. | `E2E-ALERT-QUERY-001` — planificado G8 |

Los filtros de Pedidos continúan persistiendo en URL/localStorage y deben
reiniciar `page` al cambiar. La prueba `E2E-ORD-PERSIST-001` cubrirá recarga,
restauración, cambio de filtro y limpieza. Estado: **bloqueado staging**.

## 4. Deep links y coordinación entre capas

| ID | Origen | Destino/resultado obligatorio | Protección |
| --- | --- | --- | --- |
| `DEEP-001` | Card/fila de pedido | `/pedidos?detalle=<orderId>` abre el pedido correcto sin scroll global inesperado. | `E2E-DEEP-001` — bloqueado staging |
| `DEEP-002` | Fila de tarea | `/tareas?detalle=<orderId>&tareaId=<taskId>` abre el pedido y selecciona la tarea exacta. | `E2E-DEEP-002` — bloqueado staging |
| `DEEP-003` | Búsqueda global | Resultado de pedido navega a `DEEP-001`. | `E2E-SEARCH-001` — bloqueado staging |
| `DEEP-004` | Campana o alerta con tarea y pedido | Navega a `DEEP-002`. | `E2E-NOTIF-DEEP-001` — bloqueado staging |
| `DEEP-005` | Campana o alerta solo con pedido | Navega a `DEEP-001`. | `E2E-NOTIF-DEEP-002` — bloqueado staging |
| `DEEP-006` | Notificación sin destino | No crea un enlace falso ni falla; permite leer/no leer. | `E2E-NOTIF-NODEST-001` — bloqueado staging |
| `DEEP-007` | Asistente | Lee `detalle` como contexto del pedido abierto. El refactor no cambia el significado de este parámetro. | `E2E-ASST-CONTEXT-001` — bloqueado staging |
| `DEEP-008` | Drawer de tarea | Enlace al pedido conserva el ID y abre el drawer de pedido. | `E2E-TASK-TO-ORD-001` — bloqueado staging |
| `DEEP-009` | Perfil de cliente | Cada pedido enlaza por `DEEP-001`. | `E2E-CUST-TO-ORD-001` — bloqueado staging |

Contrato de capas v4, protegido por `E2E-LAYER-001` (planificado G4):

1. En escritorio ancho, asistente izquierdo y drawer operativo derecho pueden
   coexistir si quedan al menos 720 px útiles.
2. En tablet/móvil solo se presenta un panel a la vez.
3. Si el asistente oculta un drawer, se conserva `detalle` y puede restaurarse.
4. Escape cierra únicamente la capa superior.
5. El foco inicial, el atrapamiento y la restauración pertenecen a la capa que
   se abre/cierra; nunca se pierde en `body`.

## 5. Acciones mutables e invariantes

Todas las acciones requieren sesión/RLS según su implementación actual. Una UI
nueva puede envolverlas, pero no duplicar su lógica en cliente ni cambiar sus
payloads silenciosamente.

| ID | Acción pública | Efecto e invariantes que se preservan | Protección |
| --- | --- | --- | --- |
| `MUT-TASK-001` | `completeTask` | ID positivo; usuario autenticado; resultado obligatorio y válido para el tipo; solo `pendiente/en_progreso` pasa a `completada`; registra fecha, usuario, resultado y notas. | `E2E-TASK-COMPLETE-001` — bloqueado staging |
| `MUT-TASK-002` | completar desde drawer | Emite `crm:task-completed`, respeta estado optimista y `visibleTaskOrder`; selecciona la siguiente tarea visible sin salto, o cierra/termina correctamente si era la última. | `E2E-TASK-NEXT-001` — bloqueado staging |
| `MUT-TASK-003` | `snoozeTask` | Solo ID positivo, tarea accionable y fecha futura; actualiza `snoozed_until`/`updated_at`. | `E2E-TASK-SNOOZE-001` — bloqueado staging |
| `MUT-TASK-004` | `reassignTask` | Permite responsable nulo; actualiza asignación; al cambiar a un usuario genera notificación interna y Telegram solo si tiene chat y país disponibles; un fallo Telegram no revierte la asignación. | `E2E-TASK-ASSIGN-001` — bloqueado staging |
| `MUT-TASK-005` | `logTaskHandlingOpen` | Registra apertura con correo cuando es posible; es best-effort y nunca impide abrir el drawer. | `E2E-TASK-TIME-001` — bloqueado staging |
| `MUT-TASK-006` | `suggestTaskMessage` | Genera sugerencia para la tarea accesible; conserva loading/error/success y no completa la tarea. | `E2E-TASK-AI-001` — bloqueado staging |
| `MUT-ORD-001` | `updateOrderPhone` | ID positivo; autentica; trim; vacío solo cuando `allowEmpty`; actualiza un pedido accesible y permite deshacer al valor anterior, incluso `null`. | `E2E-ORD-PHONE-001` — bloqueado staging |
| `MUT-ORD-002` | `triggerDropiSync` | Ejecuta conciliación CO y MX, permite resultado parcial, revalida `/pedidos`; no mueve reglas COD a n8n. | `E2E-ORD-SYNC-001` — staging/manual aislado |
| `MUT-ABAN-001` | `updateAbandonadoEstado` | Solo estados `nuevo/contactado/recuperado/descartado`, registro accesible y usuario autenticado. | `E2E-ABAN-STATE-001` — bloqueado staging |
| `MUT-ABAN-002` | `suggestAbandonadoMessage` | Valida acceso antes de generar; no cambia el estado automáticamente. | `E2E-ABAN-AI-001` — bloqueado staging |
| `MUT-ABAN-003` | `triggerAbandonadosSync` | Sincroniza CO/MX mediante el backend y revalida `/pedidos`; muestra éxito/error real. | `E2E-ABAN-SYNC-001` — staging/manual aislado |
| `MUT-NOTIF-001` | leer/no leer una notificación | Solo actualiza la fila que coincide con `id` y `user_id` autenticado. | `E2E-NOTIF-READ-001` — bloqueado staging |
| `MUT-NOTIF-002` | marcar todas leídas | Solo filas no leídas del usuario autenticado. | `E2E-NOTIF-ALL-001` — bloqueado staging |
| `MUT-COST-001` | crear/actualizar costeo | Conserva país, validación, conversiones porcentuales y redirects/confirmaciones actuales. | `E2E-COST-SAVE-001` — bloqueado staging |
| `MUT-COST-002` | importe gastado | Actualiza el costeo existente en su país y conserva `costeo` seleccionado con `importe=1`. | `E2E-COST-SPEND-001` — bloqueado staging |
| `MUT-COST-003` | duplicar/eliminar costeo | Duplica todos los campos calculables en el mismo país; borrar redirige a la lista del país. La protección de cambios sin guardar sigue siendo bloqueante. | `E2E-COST-CRUD-001` — bloqueado staging |
| `MUT-RESEARCH-001` | sincronizar Dropkiller | Requiere sesión, usa backend actual y revalida Investigación. | `E2E-RESEARCH-SYNC-001` — staging/manual aislado |
| `MUT-RESEARCH-002` | guardar/quitar producto | Identidad guardada por `external_id,country_code`; solo acepta CO/MX; conserva usuario que guardó. | `E2E-RESEARCH-SAVE-001` — bloqueado staging |
| `MUT-SETTINGS-001` | `saveAssistantRules` | Guarda la configuración real y redirige con `guardado=1`; no crea configuraciones ficticias. | `E2E-SETTINGS-SAVE-001` — bloqueado staging |
| `MUT-AUTH-001` | login/logout/set password | Conserva invitación, sesión, middleware y PKCE; sin registro público. | `E2E-AUTH-FLOW-001` — bloqueado staging |

La arquitectura no negociable también es contrato: n8n extrae y escribe datos;
clasificación, tareas automáticas, reglas COD y decisiones viven en este backend
TypeScript. Protección `ARCH-001`: revisión de diff obligatoria en cada PR.

## 6. Fuentes de datos y fórmulas

| ID | Cifra o vista | Fuente canónica e invariante | Protección |
| --- | --- | --- | --- |
| `DATA-ORD-001` | Pedidos y conteo | `orders`, consulta server-side, `count: exact`, 24 filas por página; orden por `fecha` y luego `created_at` descendentes. | `DATA-E2E-ORD-001` — bloqueado staging |
| `DATA-STATUS-001` | Clasificación de transportadora | `status_catalog.categoria` con coincidencia de estado/transportadora y fallback catalogado; nunca aproximar por texto libre de `estado_dropi`. | `UNIT-STATUS-001` — planificado G2 |
| `DATA-RISK-001` | Riesgo mostrado | Campos de riesgo persistidos en `orders`; “sin datos” cubre `null` y `sin_datos`. | `DATA-E2E-RISK-001` — bloqueado staging |
| `DATA-DROPI-001` | Perfil histórico Dropi | Campos de la orden actual: `total_pedidos_cliente`, `pedidos_entregados_cliente`, `pedidos_devueltos_cliente`; `otros = total - entregados - devueltos`; `null` total produce empty state. | `UNIT-DROPI-001` y `E2E-DROPI-001` — planificado/bloqueado staging |
| `DATA-DROPI-002` | Fixture de referencia | Debe mostrar `118 total = 39 entregados + 78 devueltos + 1 otros` en ambos drawers y, en G7, en el perfil. | `E2E-DROPI-118` — bloqueado staging |
| `DATA-CUST-001` | Identidad de cliente v1 | G7 agrupa exclusivamente por `pais + telefono exacto`; no normaliza ni fusiona formatos distintos. | `SQL-CUST-IDENT-001` — planificado G7 |
| `DATA-CUST-002` | Historial Pakora | Órdenes locales que coinciden exactamente en país y teléfono; debe etiquetarse separado del snapshot global Dropi. | `E2E-CUST-SOURCE-001` — planificado G7 |
| `DATA-CUST-003` | Snapshot global Dropi | Orden más reciente del cliente; siempre muestra fecha de captura para no presentarlo como tiempo real. | `E2E-CUST-SNAPSHOT-001` — planificado G7 |
| `DATA-TASK-001` | Cola de tareas | `tasks` con orden vigente por `fecha_limite` ascendente y nulos al final; filtro pospuesto/abierto conserva la semántica actual. | `DATA-E2E-TASK-001` — bloqueado staging |
| `DATA-NOTIF-001` | Notificaciones | `notifications` filtradas por `user_id`; campana toma últimas 20 y contador exacto de no leídas; Realtime usa sesión autenticada. | `E2E-NOTIF-RT-001` — bloqueado staging |
| `DATA-FIN-001` | Resumen financiero | RPC `wallet_summary`; utilidad operativa nativa por país = entradas operativas − salidas operativas. | `DATA-E2E-FIN-001` — bloqueado staging |
| `DATA-FIN-002` | Capital | Categorías `recarga` y `retiro` se muestran como capital y nunca cuentan como utilidad operativa. | `DATA-E2E-FIN-CAP-001` — bloqueado staging |
| `DATA-FIN-003` | Tendencia/comparación | RPC `wallet_daily_summary` para rango actual y período anterior inclusivo de igual longitud. | `DATA-E2E-FIN-TREND-001` — bloqueado staging |
| `DATA-FIN-004` | Dinero en la calle | RPC `dinero_en_la_calle`; snapshot actual separado por país e independiente de `range/from/to`. | `DATA-E2E-STREET-001` — bloqueado staging |
| `DATA-FIN-005` | CO/MX combinado | COP y MXN no se suman sin conversión explícita. Un error FX no puede ocultar métricas nativas. | `DATA-E2E-FX-001` — bloqueado staging |
| `DATA-METRIC-001` | Métricas por producto | RPC `product_order_summary`; histórico completo, estados y denominadores sin cambios. | `DATA-E2E-METRIC-001` — bloqueado staging |
| `DATA-PROD-001` | Productividad | RPC `task_completions_by_user` y `task_handling_time_by_user`, ambos con el mismo rango. | `DATA-E2E-PROD-001` — bloqueado staging |
| `DATA-RESEARCH-001` | Investigación | RPC `dropkiller_sweet_spot_candidates`, búsqueda Dropkiller y `dropkiller_saved_products`. No inferir recomendaciones nuevas. | `DATA-E2E-RESEARCH-001` — bloqueado staging |
| `DATA-COST-001` | Costeo | Tabla `costeos` y fórmulas TypeScript existentes son canónicas. Entre otras: flete ajustado = `flete_base / tasa_efectividad`; CPA ajustado = `cpa_ads / (tasa_efectividad * (1 - tasa_cancelacion))`; utilidad entregada = venta − proveedor − costo único. | `UNIT-COST-001` — planificado G11 |
| `DATA-ASST-001` | Asistente | Configuración `asistente_whatsapp_config`, contexto de la orden abierta y mensajes actuales. Las reglas guardadas se agregan sin sustituir reglas operativas. | `E2E-ASST-001` — bloqueado staging |

### 6.1 Contrato de `TodaySummary`

Antes de crear `/hoy`, `UNIT-TODAY-001` y `E2E-TODAY-DATA-001` deben fijar:

- vencidas: tarea abierta, no pospuesta activamente y `fecha_limite < ahora`;
- para hoy: abierta, no pospuesta y deadline dentro del día Bogotá;
- pedidos recibidos hoy: `orders.fecha` en el día Bogotá;
- pedidos activos de riesgo alto: `estado_crm` en `nuevo/en_ruta` y riesgo alto;
- alertas de acción: notificaciones no leídas de tipos operativos aprobados;
- dinero en la calle: RPC existente, snapshot sin rango y separado CO/MX;
- próxima cola: primeras tareas según el orden ya vigente por `fecha_limite`.

Estado de ambas protecciones: **planificado G9**. No se añadirá un ranking nuevo.

## 7. Estados visuales obligatorios

Cada estado debe ser explícito en claro/oscuro y en 375/768/1440 px. “Sin
filas” no puede confundirse con “falló la consulta”. Los cambios de datos
relevantes se anuncian; el color nunca es la única señal.

| ID | Superficie | Estados mínimos | Protección |
| --- | --- | --- | --- |
| `VIS-001` | Shell/nav/topbar | default, activo, hover, focus, sidebar expandido/compacto, sheet móvil, búsqueda, campana, tema, perfil, error de perfil no bloqueante. | `VIS-SHELL-001` + `AXE-SHELL-001` — planificado G4 |
| `VIS-002` | Tareas | loading, error/reintento, vacío, poblado, seleccionado, completado, no accionable, responsable nulo, IA loading/error/success. | `VIS-TASK-001` + `AXE-TASK-001` — planificado G5 |
| `VIS-003` | Drawer de tarea | loading, error, seleccionado, sin orden, sin teléfono, historial Dropi, historial `null`, WhatsApp, formulario válido/inválido, éxito. | `VIS-TASK-DRAWER-001` — planificado G5 |
| `VIS-004` | Pedidos | loading existente, error, vacío por filtros, poblado, paginación habilitada/deshabilitada, selección. | `VIS-ORD-001` + `AXE-ORD-001` — planificado G6 |
| `VIS-005` | Drawer de pedido | loading, error/reintento, datos parciales, sin teléfono, edición, deshacer, historial Dropi/empty, tareas/comentarios/mensajes vacíos. | `VIS-ORD-DRAWER-001` — planificado G6 |
| `VIS-006` | Abandonados | loading de sugerencia/sync, error, vacío, poblado, estado actualizando/éxito, sin WhatsApp. | `VIS-ABAN-001` — planificado G6 |
| `VIS-007` | Clientes | loading, error, vacío, resultados, paginación, perfil sin Dropi, múltiples pedidos y enlace legado. | `VIS-CUST-001` + `AXE-CUST-001` — planificado G7 |
| `VIS-008` | Alertas | loading, error/reintento, vacío por cada filtro, leída/no leída, sin destino, realtime nuevo, contador `99+`. | `VIS-ALERT-001` + `AXE-ALERT-001` — planificado G8 |
| `VIS-009` | Hoy | loading, cero actividad, error parcial por origen, poblado, CO/MX separados. | `VIS-TODAY-001` + `AXE-TODAY-001` — planificado G9 |
| `VIS-010` | Finanzas/analítica | loading, sin movimientos, error total/parcial, datos, FX indisponible, rango inválido/custom. | `VIS-FIN-001` + `AXE-FIN-001` — planificado G10 |
| `VIS-011` | Costeos | nuevo, seleccionado, guardando, éxito/error, promoción, cambios sin guardar, delete/duplicate, CO/MX. | `VIS-COST-001` + `AXE-COST-001` — planificado G11 |
| `VIS-012` | Configuración/Auth | loading, error inline, éxito, sesión expirada, invitación inválida, ambos temas. | Login normal/error e invitación inválida: `VIS-AUTH-PUBLIC-001` automatizado. `AXE-AUTH-PUBLIC-001` registra una deuda conocida de contraste únicamente en el error light (`3.95:1`) que G3 debe eliminar; estados autenticados planificados G11 |
| `VIS-013` | Overlays | cerrado/abriendo/abierto/cerrando, foco inicial, Escape, foco restaurado, coexistencia de paneles. | `E2E-OVERLAY-001` — planificado G4 |
| `VIS-014` | Motion | normal y `prefers-reduced-motion`; el modo reducido conserva feedback textual/color/icono sin desplazamiento, escala, pulso o stagger. | `E2E-MOTION-001` — planificado G3/G12 |

Las regresiones visuales se capturan en seis proyectos base: desktop, tablet y
móvil, cada uno claro/oscuro; reduced-motion tiene un proyecto desktop adicional.
Se enmascaran únicamente timestamps realmente variables. Snapshots inesperados
no se aceptan automáticamente.

## 8. Dependencias cruzadas

| ID | Productor/contrato | Consumidores que deben mantenerse alineados | Protección |
| --- | --- | --- | --- |
| `DEP-001` | `detalle` | Pedidos, Tareas, búsqueda, campana/Alertas y asistente. | `E2E-DEP-DETAIL-001` — bloqueado staging |
| `DEP-002` | `tareaId` | Cola, TaskDetailDrawer y destino de notificaciones. | `E2E-DEP-TASKID-001` — bloqueado staging |
| `DEP-003` | `getCustomerHistoryStats` | OrderDetailDrawer, TaskDetailDrawer y perfil de cliente v4. | `UNIT-DEP-DROPI-001` — planificado G2/G7 |
| `DEP-004` | etiquetas/tonos de tareas | Fila, filtros, drawer, Alertas y Hoy; no duplicar mapas divergentes. | `UNIT-DEP-TASK-PRES-001` — planificado G2/G3 |
| `DEP-005` | categorías `status_catalog` | Pedidos, perfil local, drawers, Métricas y reglas COD. | `UNIT-DEP-STATUS-001` — planificado G2 |
| `DEP-006` | `notifications` + Realtime | Campana, título del documento, `/notificaciones`, `/alertas` y Hoy. | `E2E-DEP-NOTIF-001` — bloqueado staging |
| `DEP-007` | rango `range/from/to` | Finanzas y Productividad; ambos conservan su semántica aunque no compartan resultados. | `UNIT-DEP-RANGE-001` — planificado G2 |
| `DEP-008` | costeo seleccionado | URL, lista, calculadora, guardado, importe, duplicación y protección de cambios. | `E2E-DEP-COST-001` — bloqueado staging |
| `DEP-009` | tema `next-themes` | Shell, Auth, overlays, gráficos y snapshots; default light, `enableSystem=false`, persistente. | `E2E-DEP-THEME-001` — planificado G3/G4 |
| `DEP-010` | navegación central | Desktop, sidebar compacta, sheet tablet, bottom nav móvil y destinos de Hoy. | `UNIT-NAV-001` + `E2E-NAV-002` — planificado G4/G9 |
| `DEP-011` | Auth/profile/RLS | Todas las rutas `(app)`, acciones y Realtime por usuario. | `E2E-DEP-AUTH-001` — bloqueado staging |
| `DEP-012` | tipos Supabase | Queries, DTO de Clientes, RPC y fixtures. | `TSC-DB-001` — planificado después de regenerar tipos |

## 9. Regla de evolución del contrato

Antes de cambiar un contrato de este archivo:

1. identificar el ID afectado y la fuente canónica;
2. ejecutar su protección, o documentar por qué sigue bloqueada;
3. añadir primero una prueba de caracterización cuando el comportamiento ya
   existe;
4. cambiar una sola responsabilidad;
5. ejecutar microgate y el recorrido crítico de la fase anterior;
6. actualizar este archivo solo si el plan aprobado cambia deliberadamente el
   contrato, nunca para acomodar una regresión;
7. registrar la decisión en `DEVELOPMENT_LOG.md` dentro del commit
   significativo correspondiente.

Un gate no está verde mientras haya una protección **bloqueante** fallando.
Los estados **bloqueado staging** permiten documentar G0, pero no permiten
aprobar el Gate G0 final ni iniciar pruebas mutables contra producción.
