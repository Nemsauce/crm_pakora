# Inventario completo de interfaz — CRM Pakora

Auditoría factual del shell autenticado y de las pantallas alcanzables desde las rutas solicitadas. Este documento describe la interfaz tal como existe en el código al momento de la lectura. No contiene recomendaciones.

## Sitemap y jerarquía de navegación

```text
Shell autenticado `(app)`
├── Sidebar
│   ├── Pedidos → /pedidos
│   │   ├── filtros: País, Estado CRM, Riesgo, Fecha y Buscar
│   │   ├── paginación: Anterior / Página {n} / Siguiente
│   │   └── tarjeta de pedido
│   │       └── drawer “Detalle de pedido” → /pedidos?detalle={orderId}
│   │           ├── edición de teléfono
│   │           ├── perfil de riesgo
│   │           │   └── “Ver perfil del cliente” → /clientes/{telefono}
│   │           ├── historial de estados
│   │           ├── tareas asociadas
│   │           └── comentarios
│   ├── Tareas → /tareas
│   │   ├── vistas: Abiertas / Completadas / Todas
│   │   ├── filtros: Tipo, País, Vencimiento y Buscar
│   │   ├── fila de tarea
│   │   │   ├── selector de responsable
│   │   │   ├── “Ver pedido” → /pedidos?detalle={orderId}
│   │   │   ├── menú “Posponer” → 1 hora / 3 horas / Mañana
│   │   │   └── drawer “Detalle de tarea”
│   │   │       → /tareas?...&detalle={orderId}&tareaId={taskId}
│   │   │       ├── copiar ID Dropi
│   │   │       ├── abrir WhatsApp
│   │   │       ├── completar tarea
│   │   │       └── paneles colapsables de pedido, novedad e historial
│   ├── Costeos → /costeos
│   │   └── redirección inmediata → /costeos/co
│   │       ├── tab Colombia → /costeos/co
│   │       │   ├── calculadora
│   │       │   ├── resultados
│   │       │   ├── proyección de campaña, si hay costeo seleccionado
│   │       │   ├── packs por cantidad, si hay costeo seleccionado
│   │       │   └── costeos guardados
│   │       └── tab México → /costeos/mx
│   │           ├── calculadora + switch de importes en COP
│   │           ├── resultados
│   │           ├── proyección de campaña, si hay costeo seleccionado
│   │           ├── packs por cantidad, si hay costeo seleccionado
│   │           └── costeos guardados
│   └── Command Center → /command-center
│       ├── Finanzas → /command-center/finanzas
│       │   ├── selector 7 / 30 / 90 días
│       │   ├── popover “Rango personalizado”
│       │   ├── utilidad operativa neta por país
│       │   ├── dinero en la calle por país y producto
│       │   ├── movimientos de capital por país
│       │   └── desglose por categoría por país
│       ├── Métricas → /command-center/metricas
│       │   └── pedidos por producto para Colombia y México
│       └── Investigación → /command-center/investigacion
│           ├── tab Sugeridos → vista predeterminada
│           │   ├── consulta puntual por ID
│           │   └── sweet spots de Colombia y México
│           ├── tab Guardados → ?vista=guardados
│           │   ├── consulta puntual por ID
│           │   └── productos guardados
│           └── tarjeta de producto
│               └── enlace externo a Dropkiller, si hay UUID
├── TopBar, disponible en todas las rutas autenticadas
│   ├── diálogo de búsqueda global → resultado a /pedidos?detalle={orderId}
│   ├── dropdown de notificaciones
│   ├── toggle de tema claro/oscuro
│   └── dropdown de usuario
│       └── Cerrar sesión → /login
└── Ruta autenticada sin ítem propio en Sidebar
    └── /clientes/[telefono]
        ├── Volver a pedidos → /pedidos
        └── pedido del historial → /pedidos?detalle={orderId}
```

## Auditoría cruzada de copy y formatos

Hechos observados entre pantallas:

- El nombre del área global aparece en inglés como `Command Center`, mientras sus descripciones y títulos secundarios están en español.
- La metadata global conserva la descripción `Command Center en construcción`, mientras las rutas autenticadas presentan funcionalidades operativas completas.
- Investigación mezcla `Sweet spots`, `snapshot`, `Dropkiller`, `Dropi` y `Command Center` con copy en español. Finanzas usa `Este snapshot no cambia con el rango de fechas seleccionado.`
- Los calendarios de Pedidos y Finanzas muestran meses, días y fechas en español, pero conservan copy accesible predeterminado de DayPicker en inglés: `Go to the Previous Month`, `Go to the Next Month`, `Today, {fecha}` y `{fecha}, selected`. El contenedor de navegación recibe `aria-label=""`.
- La misma acción de volver a consultar datos usa `Refrescar` en Pedidos e Investigación; durante la espera ambos botones usan `Actualizando...`. Otros flujos de persistencia usan `Guardar`, `Guardar cambios`, `Guardar importe gastado` y `Guardando...`.
- Los estados CRM se presentan como `Nuevo`, `En ruta`, `Entregado`, `Cancelado` y `Devolución` en Pedidos, búsqueda global y perfil de cliente. Métricas usa `En tránsito` para el bloque equivalente de pedidos en movimiento y `Devoluciones` para el conteo agregado.
- El concepto de devolución aparece como `Devolución`, `Devoluciones`, `Devueltos` y `devolucion` según pantalla, métrica o categoría financiera.
- Los tipos de tarea tienen etiquetas legibles en filtros, filas y tarea seleccionada (`Notificar guía`, `Próximo a llegar`), pero el drawer de Pedidos y “Otras tareas de este pedido” en el drawer de Tareas muestran el enum sustituyendo `_` por espacios (`notificar guia`, `notificar proximo llegar`); en Pedidos además se aplica mayúscula visual por CSS.
- En el mensaje de WhatsApp para `notificar_proximo_llegar` aparece `ya esta en reparto`; el resto del copy visible usa tildes en construcciones equivalentes.
- Los estados vacíos alternan entre construcciones `No hay...`, `Sin...` y `Aún no...`; algunos terminan en punto y otros no. Ejemplos: `No hay tareas que coincidan con estos filtros.`, `Sin datos`, `Sin novedad registrada`, `Sin historial registrado.` y `Aún no hay productos guardados.`
- Pedidos y Tareas usan `Cliente o número de orden` como placeholder de búsqueda. La búsqueda global usa `Nombre, teléfono o número de orden`.
- `pedido` y `orden` se alternan dentro de los mismos flujos: `Lista de pedidos`, `Pedido sin contexto`, `Orden no disponible`, `número de orden`, `Ver pedido` e `ID {id}`.
- El país se muestra como `CO` / `MX` en filtros y detalle de Tareas, como `Colombia` / `México` en Command Center y Costeos, y no se muestra en tarjetas de Pedidos, resultados de búsqueda global ni perfil de cliente.
- Finanzas muestra el rango principal como `YYYY-MM-DD - YYYY-MM-DD`; el selector personalizado usa `dd MMM - dd MMM`; Pedidos usa `d MMM`, un guion largo `–` para rangos y descripciones narrativas como `del {d} de {mes}`; tarjetas y drawers usan fechas localizadas con año y, en detalle, hora.
- Los componentes financieros principales formatean MXN sin decimales, mientras “Dinero en la calle” conserva dos decimales para México.
- En `/costeos/mx`, la lista reutilizada dice `Productos CO` y su empty state dice `Aún no hay costeos guardados para Colombia.`
- En `/costeos/mx`, la lista de costeos y la proyección de campaña formatean importes como COP; la calculadora y “Packs por cantidad” usan MXN salvo cuando se activa la conversión visual a COP.
- El mismo concepto de descuento se expresa como `% descuento mostrado`, `precio de comparación` y `Precio comparación`.
- Los bloques de Costeos alternan `Utilidad por pedido entregado`, `Utilidad promedio por pedido Shopify`, `Utilidad promedio Shopify`, `Utilidad neta`, `Tu ganancia total` y `% ganancia extra por unidad adicional`.
- Finanzas usa `Utilidad operativa neta`, `Ganancia esperada` y `Dinero en la calle` para conceptos monetarios distintos dentro de la misma ruta.
- Costeos muestra `Fullfilment`; Finanzas muestra la categoría `Fulfillment`.
- Costeos usa `CPA ads` junto a `% CPA objetivo`, `CPA ajustado`, `CPA real` y `CPA real %`.
- El conteo de historial de Tareas usa siempre `Historial de estados ({n} eventos)`, incluso cuando `{n}` es 1. Otros conteos sí alternan singular y plural, por ejemplo `producto` / `productos` y `tarea pendiente` / `tareas pendientes`.
- Los fallbacks numéricos alternan `—`, `Sin total`, `Sin fecha`, `Sin datos`, `Inválido` y valores monetarios en cero según el componente.

## Shell autenticado y navegación global

### 1. Route

El shell envuelve todas las rutas bajo `src/app/(app)`. No tiene URL propia.

El layout raíz aplica `<html lang="es">`, título de documento `CRM Pakora`, descripción metadata `Command Center en construcción` y tema claro predeterminado con preferencia del sistema desactivada.

- Si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, redirige a `/login?error=Supabase%20no%20est%C3%A1%20configurado%20para%20esta%20sesi%C3%B3n.`
- Si no existe usuario autenticado, redirige a `/login`.

### 2. Jerarquía visual de arriba hacia abajo

1. Contenedor exterior de la aplicación.
2. Sidebar a la izquierda en escritorio y arriba en anchos menores.
3. Área principal:
   1. TopBar.
   2. Contenido de la ruta activa.

`BackgroundBlobs` devuelve `null`; no agrega elementos visuales.

#### Sidebar

1. Marca con gráfico, `CRM Pakora` y `Torre de control COD`.
2. Etiqueta de navegación `Principal`.
3. Enlaces `Pedidos`, `Tareas`, `Costeos` y `Command Center`.

#### TopBar

De izquierda a derecha dentro del grupo alineado a la derecha:

1. Búsqueda global.
2. Campana de notificaciones.
3. Cambio de tema.
4. Avatar de usuario y dropdown.

### 3. Todo el copy literal

#### Sidebar

- `CRM Pakora`
- `Torre de control COD`
- `Principal`
- `Pedidos`
- `Tareas`
- `Costeos`
- `Command Center`

#### Búsqueda global

- `Buscar pedidos`
- `Buscar pedidos (Ctrl+K)`
- `Nombre, teléfono o número de orden`
- `Buscando`
- `Cerrar búsqueda`
- `Busca pedidos por cliente, teléfono o número de orden.`
- `Escribe para buscar`
- `No se pudo completar la búsqueda.`
- `Sin resultados`
- `Esc`
- `para cerrar`
- Estados: `Nuevo`, `En ruta`, `Entregado`, `Cancelado`, `Devolución`
- Fallbacks: `ID {id}`, `Cliente sin nombre`, `Producto sin nombre`

#### Notificaciones

- `Notificaciones`
- `{n} sin leer`
- `Todo al día`
- `Marcar todas`
- `Cargando`
- `No hay notificaciones recientes.`
- `ahora`
- `hace {n} min`
- `hace {n} h`
- `hace {n} d`
- `No se pudieron cargar las notificaciones.`
- `Notificación inválida.`
- `No se pudo identificar el usuario activo.`
- `No se pudo marcar la notificación como leída.`
- `No se pudieron marcar las notificaciones como leídas.`
- Etiqueta accesible: `Notificaciones: {n} sin leer`
- El badge usa `{n}` o `99+`.

#### Tema

- Etiqueta accesible: `Cambiar tema`

#### Usuario

- `Usuario activo`
- `US`
- Etiqueta accesible: `Usuario {nombre principal}`
- `Sin rol`
- `Telegram`
- `Conectado`
- `No vinculado`
- `Cerrar sesión`
- `Cerrando...`

El rol reemplaza `_` por espacios y capitaliza cada palabra.

#### Layout y redirección

- Metadata title: `CRM Pakora`
- Metadata description: `Command Center en construcción`
- `Supabase no está configurado para esta sesión.`

### 4. Todos los elementos interactivos

- Cada enlace del Sidebar navega a su ruta. La coincidencia exacta o por prefijo determina el enlace activo.
- El Sidebar no tiene navegación anidada visible.
- La búsqueda global se abre con su botón o con `Ctrl+K` / `Cmd+K`.
- La consulta global se ejecuta 300 ms después de escribir y busca nombre, apellido, teléfono o número de orden.
- El botón X, `Escape` o seleccionar un resultado cierran la búsqueda.
- Un resultado navega a `/pedidos?detalle={id}`.
- La campana abre el dropdown de notificaciones.
- `Marcar todas` marca las notificaciones como leídas y se deshabilita cuando no hay no leídas o mientras procesa.
- Hacer clic en una notificación no leída la marca como leída. Las ya leídas no disparan otra actualización.
- La lista de notificaciones se actualiza mediante realtime.
- Cuando el conteo no leído es mayor que cero, la campana cambia el título del documento a `({unreadCount}) {baseTitle}`; lo restaura cuando vuelve a cero o el componente se desmonta.
- El toggle de tema alterna claro/oscuro y muestra un icono de sol o luna.
- El proveedor global inicia en tema claro si no hay preferencia persistida y no sigue el tema del sistema (`enableSystem={false}`).
- El avatar abre el dropdown del usuario.
- `Cerrar sesión` cierra la sesión local, navega a `/login`, refresca y queda deshabilitado mientras muestra `Cerrando...`.

### 5. Datos mostrados

- Búsqueda: hasta 20 pedidos recientes coincidentes; número de orden o ID, estado CRM, nombre del cliente y producto.
- Notificaciones: conteo no leído y hasta 20 elementos recientes con título, mensaje opcional, tiempo relativo o fecha, e indicador leído/no leído.
- Usuario: iniciales, nombre, título profesional opcional, email, rol y estado de vinculación de Telegram.
- El Sidebar recibe `userEmail`, pero no lo renderiza.

### 6. Notablemente ausente

- El Sidebar no tiene enlaces directos a las subsecciones de Command Center, tabs de Costeos ni perfiles de cliente.
- El Sidebar no tiene control de colapsar/expandir ni bloque de usuario.
- En `/clientes/[telefono]` ningún ítem del Sidebar queda activo.
- La búsqueda permite buscar por teléfono, pero no muestra el teléfono ni el país en sus resultados.
- La búsqueda no enlaza directamente al perfil del cliente y no tiene un botón separado para limpiar la consulta.
- Las filas de notificación no navegan: `order_id`, `task_id` y `tipo` se consultan, pero no se muestran ni se usan.
- No hay acción para marcar una notificación como no leída, borrarla o abrir una vista de todas las notificaciones.
- El toggle de tema no tiene texto visible; `Cambiar tema` es solo accesible.
- El dropdown de usuario no tiene enlace a perfil/configuración ni acciones para vincular o desvincular Telegram.

## Pedidos

### 1. Route

`/pedidos`

Parámetros reconocidos:

- `pais`
- `estado_crm`
- `nivel_riesgo`
- `q`
- `detalle`
- `page`
- `fecha_desde`
- `fecha_hasta`

El listado muestra 24 pedidos por página. Ordena por fecha del pedido descendente, con fechas nulas al final, y después por fecha de creación descendente.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado con borde inferior:
   - Eyebrow `Pedidos`.
   - Título `Lista de pedidos`.
   - Botón `Refrescar` a la derecha desde `sm`; debajo del título en móvil.
   - Mensaje de resultado debajo del botón después de sincronizar.
2. Tarjeta de filtros:
   - `País`.
   - `Estado CRM`.
   - `Riesgo`.
   - `Fecha`, con popover.
   - `Buscar`.
   - `Limpiar filtros`, solo con algún filtro activo.
3. Resumen de resultados:
   - Conteo.
   - `pedido` o `pedidos`.
   - Descripción del día/rango cuando hay fecha.
4. Contenido:
   - Cuadrícula de tarjetas si hay resultados: una columna en móvil, dos desde `md`, tres desde `xl`.
   - Tarjeta de estado vacío si no hay resultados.
5. Paginación:
   - `Anterior`.
   - `Página {n}`.
   - `Siguiente`.
6. Drawer `Detalle de pedido`, cuando la URL contiene `detalle`.

#### Tarjeta de pedido

1. Indicador circular de riesgo.
2. Nombre del cliente.
3. Número de orden o `ID {id}`.
4. Badge de estado CRM.
5. Ciudad y departamento.
6. Nombre del producto.
7. Separador.
8. Etiqueta y total monetario.
9. Etiqueta y fecha del pedido.

#### Drawer `Detalle de pedido`

Es un panel fijo a la derecha, de ancho completo en pantallas pequeñas y ancho máximo `xl`. No tiene overlay visual y el diálogo es no modal.

1. Cabecera fija:
   - `Detalle de pedido`.
   - `Historial y tareas asociadas`.
   - Botón iconográfico `Cerrar detalle`.
2. Área desplazable:
   - Tres skeletons durante la carga, sin texto.
   - Tarjeta de error si falla la carga.
   - Tarjeta de resumen.
   - Tarjeta de perfil de riesgo.
   - Tarjeta de historial de estados.
   - Tarjeta de tareas.
   - Tarjeta de comentarios.

#### Resumen del pedido en el drawer

1. Indicador de riesgo.
2. Cliente.
3. Número de orden o ID.
4. Badge de estado CRM.
5. Cuadrícula con `Producto`, `Ubicación`, `Teléfono`, `Estado Dropi` y `Guía`.
6. La fila de teléfono cambia a formulario cuando se edita.

#### Perfil de riesgo

1. `Perfil de riesgo del cliente`.
2. `Historial capturado desde Dropi`.
3. Badge de riesgo.
4. Con historial: total de pedidos, entregados, devueltos y tasa de devolución.
5. Sin historial: estado vacío.
6. Con teléfono: enlace `Ver perfil del cliente`.

#### Historial de estados

1. `Historial de estados`.
2. Registros del más reciente al más antiguo.
3. Cada registro: estado Dropi, transportadora, fecha/hora y novedad opcional.
4. Estado vacío.

#### Tareas asociadas

1. `Tareas`.
2. Lista por creación descendente.
3. Cada tarea: tipo, título, estado, intento desde el segundo, fecha límite y nota de finalización opcional.
4. Estado vacío.

#### Comentarios

1. `Comentarios`.
2. Lista por creación descendente.
3. Cada comentario: origen, fecha/hora y texto.
4. Estado vacío.

#### Loading de ruta

`src/app/(app)/pedidos/loading.tsx` muestra dos skeletons para encabezado, uno para filtros y seis tarjetas skeleton. No contiene copy ni texto accesible de carga.

### 3. Todo el copy literal

#### Encabezado y sincronización

- `Pedidos`
- `Lista de pedidos`
- `Refrescar`
- `Actualizando...`
- `Debes iniciar sesión para actualizar los pedidos.`
- `No se pudieron actualizar los pedidos. Intenta nuevamente.`
- `Actualización parcial: CO {falló|N conciliados}, MX {falló|N conciliados}. Intenta nuevamente.`
- `Actualizado: {N} pedidos conciliados (CO {N}, MX {N}).`

Variantes posibles del mensaje parcial:

- `Actualización parcial: CO falló, MX falló. Intenta nuevamente.`
- `Actualización parcial: CO falló, MX {N} conciliados. Intenta nuevamente.`
- `Actualización parcial: CO {N} conciliados, MX falló. Intenta nuevamente.`

#### Filtros

- `País`
- `Estado CRM`
- `Riesgo`
- `Fecha`
- `Buscar`
- Opciones de país: `Todos`, `CO`, `MX`
- Opciones de estado: `Todos`, `Nuevo`, `En ruta`, `Entregado`, `Cancelado`, `Devolución`
- Opciones de riesgo: `Todos`, `Alto`, `Medio`, `Bajo`, `Sin datos`
- `Todas las fechas`
- `Un día`
- `Rango`
- `Quitar fecha`
- `Aplicar`
- Placeholder: `Cliente o número de orden`
- `Limpiar filtros`

Etiquetas dinámicas de fecha:

- `{d} {MMM}`
- `{d} {MMM} – {d} {MMM}`

El calendario muestra meses, días de semana y fechas en español. Conserva estas etiquetas accesibles predeterminadas en inglés:

- `Go to the Previous Month`
- `Go to the Next Month`
- `Today, {fecha localizada}` para hoy.
- `{fecha localizada}, selected` para una fecha seleccionada.
- Si hoy también está seleccionado: `Today, {fecha localizada}, selected`.

#### Conteo, paginación y estado vacío

- `pedido`
- `pedidos`
- `Anterior`
- `Página {n}`
- `Siguiente`
- ` del {d} de {mes}`
- ` del {d} al {d} de {mes}`
- ` del {d} de {mes} al {d} de {mes}`
- `No hay pedidos que coincidan con estos filtros.`
- Error lanzado: `No se pudieron cargar los pedidos: {mensaje de Supabase}`

#### Tarjeta de pedido

- Estados: `Nuevo`, `En ruta`, `Entregado`, `Cancelado`, `Devolución`
- `Total`
- `Fecha`
- `Sin total`
- `Sin fecha`
- `Fecha inválida`
- `Cliente sin nombre`
- `Ubicación pendiente`
- `Producto sin nombre`
- `ID {id}`
- Etiquetas accesibles: `Riesgo bajo`, `Riesgo medio`, `Riesgo alto`, `Riesgo sin datos`

#### Drawer: cabecera y carga

- `Detalle de pedido`
- `Historial y tareas asociadas`
- `Cerrar detalle`
- `Pedido no encontrado o sin acceso.`
- `No se pudo cargar el detalle del pedido.`

#### Drawer: resumen y teléfono

- Estados: `Nuevo`, `En ruta`, `Entregado`, `Cancelado`, `Devolución`
- `Producto`
- `Producto sin nombre`
- `Ubicación`
- `Ubicación pendiente`
- `Teléfono`
- `Sin teléfono`
- `Estado Dropi`
- `Sin estado`
- `Guía`
- `Sin guía`
- `Cliente sin nombre`
- `ID {id}`
- `Editar teléfono`
- `Nuevo teléfono`
- `Guardar`
- `Cancelar edición del teléfono`
- `Teléfono actualizado.`
- `No se pudo actualizar el teléfono.`
- `Pedido inválido.`
- `El teléfono no puede estar vacío.`
- `No se pudo identificar el usuario activo.`
- `Pedido no encontrado o sin acceso.`

#### Drawer: perfil de riesgo

- `Perfil de riesgo del cliente`
- `Historial capturado desde Dropi`
- `Riesgo alto`
- `Riesgo medio`
- `Riesgo bajo`
- `Sin datos`
- `Total de pedidos`
- `Entregados`
- `Devueltos`
- `Tasa de devolución`
- `Cliente sin historial en Dropi`
- `Ver perfil del cliente`

#### Drawer: historial

- `Historial de estados`
- `Sin transportadora`
- `Sin fecha`
- `Fecha inválida`
- `Sin historial registrado.`

El estado y la novedad son texto de datos sin traducción adicional.

#### Drawer: tareas

- `Tareas`
- `Pendiente`
- `En progreso`
- `Completada`
- `Cancelada`
- `Intento {n}`
- `Vence {fecha}`
- `Nota:`
- `Sin fecha`
- `Fecha inválida`
- `Sin tareas asociadas.`

El tipo sustituye `_` por espacios; tipo, título y nota proceden de datos.

#### Drawer: comentarios

- `Comentarios`
- `Sin comentarios.`
- `Sin fecha`
- `Fecha inválida`

Origen y comentario proceden de datos.

### 4. Todos los elementos interactivos

- `Refrescar` ejecuta sincronización Dropi de CO y después MX; intenta MX aunque CO falle. Mientras corre, se deshabilita y muestra `Actualizando...`. Al terminar refresca la ruta y muestra un resultado conjunto.
- `País`, `Estado CRM` y `Riesgo` abren menús. Elegir una opción actualiza/elimina su parámetro y elimina `page`.
- `Sin datos` en riesgo incluye valores nulos y `sin_datos`.
- Los filtros de país, estado y riesgo se guardan en `localStorage` bajo `pedidos-filters`. Fecha y búsqueda no se guardan.
- Si la URL no trae país, estado, riesgo o fecha, se restauran los tres filtros persistidos. Una `q` aislada no impide esa restauración.
- `Fecha` abre un popover con modos `Un día` y `Rango`; muestra uno o dos meses, deshabilita fechas futuras, ordena extremos invertidos y exige selección completa para habilitar `Aplicar`.
- `Quitar fecha` elimina ambos extremos y `page`; se deshabilita sin fecha activa.
- El campo `Buscar` es controlado y el formulario se envía normalmente con Enter; busca sin distinguir mayúsculas en nombre, apellido o número de orden. No hay botón visible de submit.
- `Limpiar filtros` aparece solo con filtros activos; limpia el borrador, el almacenamiento y navega a `/pedidos`, eliminando también `page` y `detalle`.
- Toda tarjeta es activable por clic, Enter o barra espaciadora. Agrega `detalle={id}` sin scroll; una segunda activación de la seleccionada lo elimina. Conserva los demás filtros.
- `Anterior` y `Siguiente` conservan parámetros y cambian `page`; quedan deshabilitados en sus límites. Un `detalle` abierto se conserva al paginar.
- El drawer solicita `/api/orders/{id}`. `Cerrar detalle` y Escape eliminan `detalle`; clic/interacción fuera están bloqueados.
- El drawer no modal permite activar otra tarjeta visible para cambiar la selección.
- `Editar teléfono` abre el formulario. `Guardar` se deshabilita durante la acción o con texto en blanco. Cancelar restaura el valor anterior.
- Guardar teléfono recorta espacios, actualiza el dato del drawer, sale de edición, refresca la ruta y muestra feedback durante tres segundos.
- `Ver perfil del cliente` aparece solo con teléfono y navega a `/clientes/{telefono codificado}`.
- Historial, tareas y comentarios del drawer son de solo lectura.

### 5. Datos mostrados

#### Listado

- Cantidad total filtrada.
- Nombre y apellido.
- Número de orden o ID interno.
- Estado CRM.
- Riesgo mediante color y etiqueta accesible.
- Ciudad y departamento.
- Producto.
- Total del pedido.
- Fecha del pedido.

Los montos usan COP para CO y MXN para MX, sin decimales visibles. Las fechas de tarjeta usan locale `es-CO`, día, mes abreviado y año.

#### Drawer

- Resumen: cliente, orden/ID, riesgo, estado CRM, producto, ciudad/departamento, teléfono, estado Dropi y guía.
- Perfil: nivel de riesgo, total histórico, entregados, devueltos y porcentaje de devolución con hasta un decimal.
- Historial: estado, transportadora, fecha/hora y novedad opcional.
- Tareas: tipo, título, estado, intento, fecha límite y nota opcional de completado.
- Comentarios: origen, fecha/hora y contenido.

Las fechas del drawer usan `es-CO` con día, mes abreviado, año, hora y minuto; no fijan zona horaria explícita.

### 6. Notablemente ausente

- No hay selección múltiple, acciones masivas, ordenamiento visible, selector de tamaño de página ni navegación directa a un número de página.
- No hay botón visible para enviar la búsqueda.
- El país no aparece textualmente en tarjeta ni drawer; solo afecta el formato monetario de la tarjeta.
- El drawer no muestra total, fecha del pedido ni dirección más detallada que ciudad/departamento.
- No hay WhatsApp, gestión de tareas, cambio de estado ni creación de comentario dentro del drawer.
- Historial, tareas y comentarios son de solo lectura.
- No hay deshacer para la edición de teléfono una vez guardada.
- No hay reintento dentro del error del drawer.
- La consulta principal lanza excepción; no hay `error.tsx` local ni error inline propio.
- Los skeletons no incluyen `Cargando...`, `aria-busy` ni región live propia.
- El drawer bloquea expresamente el cierre por clic fuera.
- La sincronización no pide confirmación, no permite escoger país y no muestra progreso separado de CO/MX antes del resultado final.

## Tareas

### 1. Route

`/tareas`

Parámetros reconocidos:

- `estado_vista`: `abiertas`, `completadas`, `todas`.
- `tipo`: uno de los cinco tipos de tarea.
- `pais`: `CO` o `MX`.
- `vencidas`: `true` o `false`.
- `q`.
- `detalle`: ID interno del pedido del drawer.
- `tareaId`: tarea seleccionada dentro del pedido.

La vista predeterminada es `abiertas`. Valores inválidos de vista, tipo o país se ignoran. Las tareas con `snoozed_until` futuro se excluyen de todas las vistas. El orden es fecha límite ascendente, con fechas nulas al final.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - Eyebrow `Operación`.
   - Título `Tareas`.
   - Subtítulo.
2. Selector segmentado `Abiertas`, `Completadas`, `Todas`.
3. Tarjeta de filtros:
   - `Tipo`.
   - `País`.
   - `Vencimiento`.
   - `Buscar`.
   - `Limpiar filtros`, condicional.
4. Barra de resumen:
   - Total según la vista.
   - Conteo vencido si es mayor que cero y la vista no es `completadas`.
5. Lista vertical de filas/tarjetas con animación escalonada.
6. Estado vacío si no hay coincidencias.
7. Drawer lateral derecho si existe `detalle`.

#### Fila de tarea

1. Icono circular por tipo.
2. Badge de tipo.
3. Badge de estado.
4. Badge de intento desde el intento 2.
5. Selector de responsable.
6. Título.
7. Cliente y número de orden.
8. A la derecha:
   - Fecha límite o información de finalización.
   - `Ver pedido`.
   - Menú `Posponer` para tareas pendientes o en progreso.

#### Drawer `Detalle de tarea`

1. Encabezado:
   - `Detalle de tarea`.
   - `Gestión activa y contexto del pedido`.
   - Control `Cerrar detalle`.
2. Área desplazable:
   - Tres skeletons durante carga, sin texto.
   - Error de carga.
   - Tarjeta destacada de la tarea seleccionada.
   - `Otras tareas de este pedido`.
   - `Detalles del pedido`, colapsado inicialmente.
   - `Detalles de novedad`, colapsado inicialmente.
   - `Historial de estados`, colapsado inicialmente.

#### Tarea seleccionada

1. Tipo, estado e intento.
2. Título.
3. Cliente y orden.
4. Control de ID Dropi, si existe.
5. Vencimiento o finalización.
6. Teléfono.
7. `WhatsApp` si el teléfono se puede formatear.
8. Formulario de cierre si el estado no es `completada`.

Si `tareaId` falta, es inválido o no pertenece al pedido cargado, el drawer selecciona la primera tarea cuyo estado no sea `completada`; si no existe, usa la primera tarea. Si el pedido no contiene tareas, no renderiza cuerpo de detalle.

### 3. Todo el copy literal

#### Encabezado y vistas

- `Operación`
- `Tareas`
- `Gestión activa ordenada por urgencia. Lo vencido y más próximo aparece primero.`
- Etiqueta accesible: `Vista de tareas`
- `Abiertas`
- `Completadas`
- `Todas`

#### Filtros

- `Tipo`
- `Todos`
- `Llamar confirmación`
- `Notificar guía`
- `Presionar entrega`
- `Próximo a llegar`
- `Resolver novedad`
- `País`
- `Todos`
- `CO`
- `MX`
- `Vencimiento`
- `Todas`
- `Vencidas`
- `A tiempo`
- `Buscar`
- Placeholder: `Cliente o número de orden`
- `Limpiar filtros`

#### Resumen, filas y vacío

- `{n} tarea pendiente`
- `{n} tareas pendientes`
- `{n} tarea completada`
- `{n} tareas completadas`
- `{n} tarea en total`
- `{n} tareas en total`
- `{n} vencida`
- `{n} vencidas`
- `No hay tareas que coincidan con estos filtros.`
- Errores lanzados: `No se pudieron cargar las tareas: {mensaje de Supabase}` y `No se pudieron cargar los usuarios activos: {mensaje de Supabase}`

Tipos:

- `Llamar confirmación`
- `Notificar guía`
- `Presionar entrega`
- `Próximo a llegar`
- `Resolver novedad`

Estados y fallbacks:

- `Pendiente`
- `En progreso`
- `Completada`
- `Cancelada`
- `Intento {n}`
- `Pedido sin contexto`
- `Cliente sin nombre`
- `Orden no disponible`
- `ID {order.id}`
- `Sin fecha`
- `Fecha inválida`
- `Sin fecha límite`
- `Vencida {fecha}`
- `Vence {fecha}`
- `Completada`
- `Completada {fecha}`
- `Completada {fecha} · {completado_por}`
- Etiqueta accesible: `Asignado a`
- `Sin asignar`
- `{email del responsable}`
- `Ver pedido`

#### Posponer y reasignar

- `Posponer`
- `1 hora`
- `3 horas`
- `Mañana`
- `Tarea inválida.`
- `La nueva fecha debe estar en el futuro.`
- `No se pudo posponer la tarea.`
- Resultado de servidor no mostrado inline: `No se pudo reasignar la tarea.`

#### Drawer

- `Detalle de tarea`
- `Gestión activa y contexto del pedido`
- `Cerrar detalle`
- `Pedido no encontrado o sin acceso.`
- `No se pudo cargar el detalle del pedido.`

ID Dropi:

- `ID Dropi {id}`
- `Copiado`
- Etiqueta accesible: `Copiar ID Dropi {id}`

Teléfono y acción externa:

- `Teléfono cliente`
- `Sin teléfono`
- `WhatsApp`

Finalización:

- `Nota de cierre (opcional)`
- Placeholder: `Ej. Cliente confirmó recepción por WhatsApp`
- `Confirmar`
- `Tarea inválida.`
- `No se pudo identificar el usuario activo.`
- `No se pudo completar la tarea.`

#### Otras tareas

- `Otras tareas de este pedido`
- `No hay otras tareas asociadas a este pedido.`
- Tipos transformados: `llamar confirmacion`, `notificar guia`, `presionar entrega`, `notificar proximo llegar`, `resolver novedad`
- `Intento {n}`
- `Vencida {fecha}`
- `Vence {fecha}`
- Las mismas variantes `Completada...` de la fila principal.

#### Detalles del pedido, novedad e historial

- `Detalles del pedido`
- `Producto`
- `Sin producto registrado`
- `Ciudad / departamento`
- `Sin ubicación registrada`
- `País`
- `Sin país registrado`
- `Detalles de novedad`
- `Sin novedad registrada`
- `Historial de estados ({n} eventos)`
- `Sin transportadora`
- `Sin historial registrado.`

Novedad, estado Dropi, transportadora y fechas son texto de datos.

#### Títulos automáticos que pueden aparecer

- `Llamar para confirmar pedido {número}`
- `Toque {2–6}: llamar para confirmar pedido {número}`
- `Cancelar pedido {número} por falta de confirmación`
- `Notificar guía de seguimiento al cliente`
- `Confirmar que el cliente esté pendiente de recibir`
- `Avisar al cliente que debe recoger el paquete en oficina`
- `Presionar entrega, intento fallido`
- `Revisar y gestionar novedad`
- `Avisar al cliente que el paquete está próximo a llegar`
- `Pedido confirmado sin guía generada hace más de 2 días`
- `Guía generada pero sin movimiento hace más de 2 días`
- `Pedido en tránsito sin actualización hace más de 2 días`
- `Presionar entrega, sin avance hace más de 2 días`
- `Cerca de destino sin avance hace más de 2 días`
- `Estado sin clasificar, revisar pedido estancado`

Autores de cierre automático visibles:

- `sistema (cambio de estado automático)`
- `sistema (pedido confirmado, avanzó de estado)`

Los cierres manuales muestran el email del usuario.

#### Mensajes prellenados de WhatsApp

Saludo con nombre:

```text
Hola {nombre}! 😊 Te escribe Leidy de Pakora.
```

Saludo sin nombre:

```text
Hola! 😊 Te escribe Leidy de Pakora.
```

Confirmación, solo CO:

```text
{saludo}

Estamos realizando la validación final de tu pedido antes de prepararlo y generar la guía de envío 📦✅

Por favor, confírmanos que los siguientes datos son correctos:

Nombre: {nombre completo}
Teléfono: {teléfono}
Producto: {producto y cantidad}
Valor a pagar: {valor}
Dirección: {dirección completa}

¿Nos confirmas que podemos realizar el envío con estos datos? Si necesitas corregir algo, indícanos por favor.

Quedamos atentos. 💛
```

Guía, CO y MX:

```text
{saludo}

Tu guía de envío ya fue generada 📦✅

Número de guía: {guía}
Transportadora: {transportadora}

Con este número puedes rastrear el estado de tu paquete directamente con la transportadora 🚚💨

Quedamos atentos a cualquier cosa. 💛
```

Próximo a llegar, CO y MX:

```text
{saludo}

¡Buenas noticias! Tu pedido ya esta en reparto y llegará pronto 📦🚚

La entrega puede realizarse durante el día de hoy o mañana. Por favor, mantente pendiente de tu teléfono por si el repartidor necesita contactarte.

Quedamos atentos a cualquier cosa. 💛
```

`presionar_entrega` originada en `en_reparto`, CO y MX:

```text
{saludo}

¡Buenas noticias! Tu pedido ya fue asignado a un mensajero y llegará pronto 📦🚚

La entrega puede realizarse durante el día de hoy o mañana. Por favor, mantente pendiente de tu teléfono por si el repartidor necesita contactarte.

Quedamos atentos a cualquier cosa. 💛
```

No hay texto prellenado para `llamar_confirmacion` en MX, `resolver_novedad`, `presionar_entrega` que no tenga exactamente el título `Confirmar que el cliente esté pendiente de recibir` con descripción vacía, ni otros tipos no contemplados. Con teléfono válido, el botón `WhatsApp` sigue abriendo WhatsApp sin parámetro `text`.

#### Notificación por reasignación

- Título: `📋 Te asignaron una tarea`
- Mensaje: `{título de tarea} · pedido {número}`
- Fallback: `{título de tarea} · pedido sin número`
- Telegram agrega `🇨🇴 ` o `🇲🇽 ` al inicio.

### 4. Todos los elementos interactivos

- `Abiertas`, `Completadas` y `Todas` cambian `estado_vista`.
- `Tipo`, `País` y `Vencimiento` abren menús y actualizan la URL.
- `Vencidas` filtra fechas anteriores al momento actual; `A tiempo`, fechas iguales o posteriores; `Todas` elimina el filtro.
- `Buscar` se envía con Enter, no tiene botón visible, busca nombre, apellido o número de orden y elimina `%` y `,` antes de consultar.
- `Limpiar filtros` elimina todos los parámetros, incluido un drawer abierto.
- La fila abre/cierra el drawer por clic, Enter o barra espaciadora.
- El selector `Asignado a` ofrece `Sin asignar` y perfiles activos por email. Reasigna y refresca. Solo crea notificación cuando la tarea existente se cargó, el nuevo responsable no es nulo y realmente cambió; desasignar no notifica. Telegram solo se intenta si ese responsable tiene `telegram_chat_id` y el país del pedido está disponible.
- `Ver pedido` navega a `/pedidos?detalle={orderId}`.
- `Posponer` oculta la tarea hasta una hora, tres horas o las 09:00 del día siguiente en `America/Bogota`.
- `Cerrar detalle` y Escape eliminan `detalle` y `tareaId`. El clic fuera del drawer está bloqueado.
- `ID Dropi` copia al portapapeles y muestra `Copiado` durante 1,5 segundos.
- `WhatsApp` abre una pestaña nueva. CO usa prefijo `57`; MX usa `521` si el número nacional resultante tiene 10 dígitos.
- `Confirmar` completa con nota opcional; después abre la siguiente tarea visible o cierra el drawer si no existe.
- Los encabezados `Detalles del pedido`, `Detalles de novedad` e `Historial de estados` expanden/colapsan su contenido.
- Los elementos de `Otras tareas de este pedido` son de solo lectura.

### 5. Datos mostrados

#### Lista

- Tipo, estado e intento.
- Responsable por email o `Sin asignar`.
- Título.
- Cliente.
- Número de orden o ID.
- Fecha límite y condición vencida.
- Fecha de finalización y quién completó.
- Conteo total filtrado y conteo vencido.

#### Drawer

- Datos principales de la tarea.
- ID Dropi.
- Teléfono.
- Producto.
- Ciudad/departamento.
- País.
- Otras tareas: tipo, título, estado, intento y vencimiento/finalización.
- Última novedad no vacía: texto, estado y fecha.
- Historial: estado, transportadora, fecha y novedad.

Las fechas usan locale `es-CO`, día/mes abreviado, año, hora y minuto. La visualización no fija zona; `Mañana` sí se calcula en Bogotá.

### 6. Notablemente ausente

- No hay paginación/cargar más, selección múltiple, acciones masivas, creación de tarea ni selector de ordenamiento.
- No se muestra prioridad explícita; el orden efectivo usa `fecha_limite`.
- No hay botón visible de búsqueda ni loading local de página completa.
- El drawer tiene skeleton sin texto y no ofrece reintento.
- Si el pedido carga sin tareas, el cuerpo no tiene empty state específico.
- Los errores devueltos por reasignación no se presentan; el componente ignora ese resultado.
- No hay confirmación ni deshacer al completar, ni feedback de éxito al reasignar o posponer.
- No hay vista de tareas pospuestas antes de `snoozed_until`.
- `task.descripcion` y `task.notas_completado` no se renderizan en esta pantalla.
- Los comentarios cargados por el endpoint de detalle no se renderizan.
- El drawer no muestra responsable, reasignación, `Posponer` ni `Ver pedido`; esas acciones existen solo en la fila.
- `Otras tareas de este pedido` no cambia la selección.
- No hay feedback si falla la copia al portapapeles.
- El país no aparece en la fila; solo en el filtro y dentro del panel colapsable.
- El formulario de finalización se muestra para cualquier estado distinto de `completada`, incluido `cancelada`; la acción del servidor solo actualiza `pendiente` o `en_progreso` y no comprueba cuántas filas cambió.

## Command Center — landing

### 1. Route

`/command-center`

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado con eyebrow, título y subtítulo.
2. Cuadrícula de tres tarjetas-enlace:
   1. Finanzas.
   2. Métricas.
   3. Investigación.
3. Cada tarjeta contiene eyebrow, título, icono, descripción y línea de apertura.

### 3. Todo el copy literal

- `Command Center`
- `Torre de control`
- `Elige una vista para revisar la operación financiera, las métricas comerciales o nuevas oportunidades de producto.`
- Tarjeta Finanzas:
  - `Command Center`
  - `Finanzas`
  - `Ganancia neta y movimientos por categoría.`
  - `Abrir Finanzas`
- Tarjeta Métricas:
  - `Command Center`
  - `Métricas`
  - `Pedidos, estados y desempeño por producto.`
  - `Abrir Métricas`
- Tarjeta Investigación:
  - `Command Center`
  - `Investigación`
  - `Productos sugeridos para testear.`
  - `Abrir Investigación`

### 4. Todos los elementos interactivos

- Toda la tarjeta Finanzas enlaza a `/command-center/finanzas`.
- Toda la tarjeta Métricas enlaza a `/command-center/metricas`.
- Toda la tarjeta Investigación enlaza a `/command-center/investigacion`.
- Las tarjetas tienen estados de hover y foco; no contienen acciones secundarias.

### 5. Datos mostrados

No consulta ni presenta datos operativos. Todo el contenido de la landing es estático.

### 6. Notablemente ausente

- No hay métricas-resumen, alertas, filtros ni datos en la landing.
- No hay enlaces secundarios distintos de las tres tarjetas.
- El Sidebar no expone directamente las tres subrutas.

## Command Center — Finanzas

### 1. Route

`/command-center/finanzas`

Parámetros reconocidos:

- `range`: `7`, `30`, `90` o `custom`.
- `from`: fecha `YYYY-MM-DD` para rango personalizado.
- `to`: fecha `YYYY-MM-DD` para rango personalizado.

La opción predeterminada está rotulada `30 días`. `Dinero en la calle` no usa estos parámetros.

La función resta el valor completo al día actual y ambos extremos se incluyen: las opciones rotuladas 7, 30 y 90 días abarcan respectivamente 8, 31 y 91 fechas de calendario. El rango predeterminado rotulado `30 días` incluye 31 fechas.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - Eyebrow `Command Center`.
   - Título `Finanzas`.
   - Subtítulo.
   - Rango crudo `YYYY-MM-DD - YYYY-MM-DD`.
   - A la derecha, selector de rango 7/30/90 y popover personalizado.
2. Sección `Operación` / `Utilidad operativa neta`:
   - Tarjeta Colombia.
   - Tarjeta México.
3. Sección `Foto actual, sin filtro de fechas` / `Dinero en la calle`:
   - Subtítulo que declara independencia del rango.
   - Tarjeta Colombia con total y lista de productos.
   - Tarjeta México con total y lista de productos.
4. Sección `Fuera de la operación`:
   - Título de movimientos de capital y explicación.
   - Tarjeta Colombia.
   - Tarjeta México.
5. Cuadrícula de desglose por categoría:
   - Colombia.
   - México.

#### Tarjeta de utilidad operativa

1. País y `Utilidad operativa neta`.
2. Icono de tendencia.
3. Con movimientos:
   - Neto prominente.
   - Comparación contra período anterior.
   - Entradas operativas.
   - Salidas operativas.
4. Sin movimientos:
   - Empty state, monto cero y comparación.
5. Gráfico `Tendencia diaria`, con neto por día y tooltip.

#### Tarjeta de dinero en la calle

1. País.
2. `Dinero en la calle`.
3. Total prominente.
4. `Total actual pendiente de entrega`.
5. Con datos: encabezados `Producto`, `Pedidos por entregar`, `Dinero en la calle` y filas ordenadas por monto descendente.
6. Sin datos: estado vacío por país.

#### Tarjeta de capital

1. País y `Capital`.
2. Icono.
3. Recargas a la billetera.
4. Retiros de la billetera.
5. Mensaje vacío si no existen movimientos.

#### Desglose por categoría

1. País, título y subtítulo.
2. Lista por valor neto absoluto descendente.
3. Cada categoría muestra neto, barra proporcional, entrada y salida.
4. Estado vacío.

### 3. Todo el copy literal

#### Encabezado

- `Command Center`
- `Finanzas`
- `Utilidad operativa por país, separada de las recargas y retiros de capital.`
- `{dateFrom} - {dateTo}`

#### Selector de fechas

- Etiqueta accesible: `Rango de fechas`
- `7 días`
- `30 días`
- `90 días`
- `Rango personalizado`
- Rango seleccionado: `{dd MMM} - {dd MMM}`
- `Aplicar`

El calendario muestra meses, días y fechas en español. Conserva copy accesible predeterminado en inglés:

- `Go to the Previous Month`
- `Go to the Next Month`
- `Today, {fecha localizada}`
- `{fecha localizada}, selected`
- `Today, {fecha localizada}, selected` cuando ambas condiciones coinciden.

#### Operación y utilidad

- `Operación`
- `Utilidad operativa neta`
- Países: `Colombia`, `México`
- `Sin base anterior`
- `{valor}% vs. período anterior`
- `Entradas operativas`
- `Salidas operativas`
- `Sin movimientos en este rango`
- `Tendencia diaria`
- `Neto por día`
- Etiqueta accesible: `Tendencia diaria {Colombia|México}`
- Nombre accesible de serie: `Neto diario`

El tooltip muestra fecha localizada y monto; no agrega otra etiqueta literal.

#### Dinero en la calle

- `Foto actual, sin filtro de fechas`
- `Dinero en la calle`
- `Ganancia esperada de los pedidos confirmados que siguen en tránsito. Este snapshot no cambia con el rango de fechas seleccionado.`
- Países: `Colombia`, `México`
- `Total actual pendiente de entrega`
- `Producto`
- `Pedidos por entregar`
- `Dinero en la calle`
- Etiqueta accesible: `Pedidos y dinero en la calle por producto en {Colombia|México}`
- `Sin pedidos en tránsito pendientes de entrega.`

Los nombres de producto proceden de datos.

#### Capital

- `Fuera de la operación`
- `Movimientos de capital (no cuentan como ganancia)`
- `Dinero ingresado o retirado por el dueño, mostrado sin mezclarlo con la utilidad operativa.`
- Países: `Colombia`, `México`
- `Capital`
- `Recargas a la billetera`
- `Retiros de la billetera`
- `Sin movimientos de capital en este rango.`

#### Desglose por categoría

- Países: `Colombia`, `México`
- `Desglose por categoría`
- `Entradas, salidas y neto`
- Categorías: `Ganancia`, `Costo de flete`, `Devolución de flete`, `Indemnización`, `Comisión de referido`, `Retiro`, `Recarga`, `Corrección`, `Fulfillment`, `Software`, `Otro`
- Fallback: `Sin categoría`
- Etiqueta accesible: `Neto de {categoría}`
- `Entrada`
- `Salida`
- `Sin movimientos en este rango.`

#### Errores lanzados por la página

- `No se pudo cargar el resumen financiero: {mensaje}`
- `No se pudo cargar la tendencia financiera: {mensaje}`
- `No se pudo cargar el período anterior: {mensaje}`
- `No se pudo cargar el dinero en la calle: {mensaje}`

### 4. Todos los elementos interactivos

- `7 días`, `30 días` y `90 días` actualizan `range`, eliminan `from`/`to` y navegan con query string.
- `Rango personalizado` abre un popover de calendario de dos meses.
- Al abrir el popover se restablece el borrador al rango activo.
- El calendario deshabilita fechas futuras y permite seleccionar intervalo.
- `Aplicar` queda deshabilitado sin ambos extremos; establece `range=custom`, `from` y `to`, navega y cierra el popover.
- El gráfico diario muestra tooltip al interactuar con puntos/área.
- Las tarjetas, filas de productos, capital y categorías no tienen enlaces ni acciones.

### 5. Datos mostrados

- Rango actual y período anterior de igual longitud.
- Por país: entradas operativas, salidas operativas, neto y variación porcentual.
- Serie de neto diario, completada con ceros para días sin dato.
- Por país: total actual de `dinero_en_la_calle`; por producto, pedidos por entregar y monto.
- Por país: recargas y retiros.
- Por categoría: entradas, salidas, neto y magnitud relativa.

Formateo:

- Los componentes de utilidad, capital y categorías usan COP/MXN sin decimales visibles.
- Dinero en la calle usa COP sin decimales y MXN con dos decimales.
- El total de dinero en la calle suma las filas del país.

### 6. Notablemente ausente

- No hay exportación, descarga, drill-down ni enlaces desde métricas/categorías/productos.
- No hay botón de refresh manual.
- No hay total combinado de países.
- El popover personalizado no tiene un botón literal de cancelar o limpiar; se cierra por el comportamiento del popover.
- No hay `loading.tsx` ni `error.tsx` específico en la ruta.
- Los errores de RPC se lanzan y no tienen presentación inline propia.
- El snapshot de dinero en la calle no muestra fecha/hora de última actualización.

## Command Center — Métricas

### 1. Route

`/command-center/metricas`

No reconoce filtros de URL. La vista usa histórico completo.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - `Command Center`.
   - `Métricas`.
   - Descripción del reporte.
   - Aclaración de histórico completo.
2. Dos secciones en columnas:
   - Colombia.
   - México.
3. Cada sección contiene encabezado `Pedidos por producto`, subtítulo y tarjetas ordenadas por total descendente.
4. Cada tarjeta:
   - Producto.
   - Total.
   - Chips de estados con conteo mayor a cero.
   - Cuatro porcentajes.
5. Empty state por país.

### 3. Todo el copy literal

- `Command Center`
- `Métricas`
- `Pedidos por producto, estados y porcentajes sobre el histórico completo.`
- `Histórico completo, todos los períodos.`
- Países: `Colombia`, `México`
- `Pedidos por producto`
- `Total y estados críticos`
- `Total`
- Estados: `Pendientes`, `Confirmados`, `En tránsito`, `Entregados`, `Cancelados`, `Devoluciones`
- Porcentajes: `Confirmación`, `Entrega`, `Cancelación`, `Devolución`
- Fallback porcentual: `—`
- `Sin datos`
- Error lanzado: `No se pudo cargar el resumen por producto: {mensaje}`

Los nombres de producto proceden de datos.

### 4. Todos los elementos interactivos

No hay botones, enlaces, filtros, tabs, tooltips ni controles dentro del contenido de esta ruta.

### 5. Datos mostrados

Por país y producto:

- Total de pedidos.
- Pendientes.
- Confirmados.
- En tránsito.
- Entregados.
- Cancelados.
- Devoluciones.
- Porcentajes de confirmación, entrega, cancelación y devolución, con un decimal.

Los chips de estado con conteo cero se omiten. Si el total es cero o el porcentaje no es finito/nulo, se muestra `—`.

### 6. Notablemente ausente

- No hay selector de fechas porque el reporte declara histórico completo.
- No hay búsqueda de producto, filtros, ordenamiento visible, paginación, exportación ni drill-down.
- No hay estado de carga propio ni error inline; la página lanza el error del RPC.
- No se muestra `confirmados_alguna_vez`, aunque el RPC lo devuelve.

## Command Center — Investigación

### 1. Route

`/command-center/investigacion`

Parámetros reconocidos:

- `vista=guardados`; cualquier otro valor muestra `sugeridos`.
- `producto={id}`.
- `pais_producto=CO|MX`; cualquier otro valor usa CO.

Estados visuales internos de consulta: idle, encontrado, no encontrado y error.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - Eyebrow `Command Center`.
   - Título `Investigación`.
   - Dos párrafos descriptivos.
   - Botón `Refrescar` y feedback a la derecha.
2. Tabs `Sugeridos` y `Guardados`.
3. Tarjeta `Consulta puntual`:
   - Título y descripción.
   - Formulario ID + país + `Buscar`.
   - Estado no encontrado/error o tarjeta de resultado.
4. Contenido según tab:
   - Sugeridos: columnas `Sweet spots` para Colombia y México, máximo 10 candidatos por país.
   - Guardados: encabezado `Productos guardados`, conteo y grilla compartida.

#### Tarjeta de producto sugerido/consultado

1. Imagen o placeholder.
2. Nombre y precio.
3. Resumen dinámico de demanda/tendencia.
4. Solo consulta puntual: bloque `Percentil` y comparación con muestra.
5. Si tendencia ≥ 1,2: `Tendencia reciente` y badge con tooltip.
6. Botón `Guardar`, `Guardando...` o `Guardado`.
7. `Datos duros`: ventas, períodos, competencia y demanda.
8. Solo consulta puntual: `Señales calculadas`.
9. Si existe UUID, toda la tarjeta abre Dropkiller en pestaña nueva.

#### Tarjeta de producto guardado

1. Imagen o placeholder.
2. País, nombre, precio e icono externo.
3. `Datos guardados`: vendidas, últimos 7/30 días y competencia.
4. `Quitar de guardados`.
5. Si existe UUID, toda la tarjeta abre Dropkiller.

### 3. Todo el copy literal

#### Encabezado, refresh y tabs

- `Command Center`
- `Investigación`
- `Productos sugeridos para testear según su nivel de demanda, consistencia y tendencia ascendente.`
- `Curado automáticamente desde Dropkiller.`
- `Refrescar`
- `Actualizando...`
- `No se pudo actualizar Dropkiller. Intenta nuevamente.`
- `Debes iniciar sesión para actualizar la investigación.`
- `{totalProductsStored} productos actualizados, {providersCountResolved} finalistas con datos de competencia.`
- Etiqueta accesible: `Vista de investigación`
- `Sugeridos`
- `Guardados`

#### Consulta puntual

- `Consulta puntual`
- `Analizar producto por ID`
- `Consulta el producto en vivo y compara su ritmo con la muestra diaria almacenada para el país seleccionado.`
- `ID Dropi / Dropkiller`
- Placeholder: `Ej. 2091078`
- `País`
- `Colombia`
- `México`
- `Buscar`
- `Producto {productId} no encontrado en {Colombia|México}.`
- `No se pudo consultar Dropkiller en este momento. Intenta nuevamente.`
- `Limpiar consulta`
- `Comparado contra los {comparisonSize} productos de mayor movimiento hoy en {Colombia|México}.`
- Error de guardados de página: `No se pudieron cargar los productos guardados: {mensaje}`
- Error de sugeridos de página: `No se pudieron cargar los productos sugeridos: {mensaje}`

#### Secciones sugeridas y guardadas

- Países: `Colombia`, `México`
- `Sweet spots`
- `Productos sugeridos`
- `Sin datos`
- `Lista compartida`
- `Productos guardados`
- `{n} producto`
- `{n} productos`
- `Aún no hay productos guardados.`

#### Tarjeta sugerida/consultada

- `Producto sin nombre`
- Texto accesible: `Abrir {productName} en Dropkiller`
- Texto accesible: `Imagen no disponible`
- `Percentil`
- `Tendencia reciente`
- Badges: `🔥 Explosivo`, `📈 Acelerando`, `↗ Subiendo`
- `Guardar`
- `Guardando...`
- `Guardado`
- `Datos duros`
- `Vendidas`
- `Últimos 7 días`
- `Últimos 30 días`
- `Competencia`
- `Demanda`
- `Sin datos`
- `{n} vendedor`
- `{n} vendedores`
- Demanda: `Sin clasificar`, `Alta`, `Media-alta`, `Media`, `Baja`
- `Señales calculadas`
- `Ritmo reciente`
- `Días con venta 7d`
- `Tercio 1`
- `Tercio 2`
- `Tercio 3`
- `Tendencia`
- Fallback numérico: `—`
- Sufijos de señal: `/día`, ` días`, `x`

Resúmenes dinámicos posibles:

- `Su demanda aún no tiene percentil en {country}, pero {trend}.`
- `Dentro de la muestra diaria de {country}, se ubica en demanda alta y {trend}.`
- `Dentro de la muestra diaria de {country}, se ubica en demanda media-alta y {trend}.`
- `Dentro de la muestra diaria de {country}, se mueve en la franja media y {trend}.`
- `Dentro de la muestra diaria de {country}, aún está en una franja de demanda baja, aunque {trend}.`
- `Está entre los productos de demanda alta en {country} y {trend}.`
- `Tiene una demanda media-alta en {country} y {trend}.`
- `Se mueve en la franja media de demanda en {country} y {trend}.`
- `Aún está en una franja de demanda baja en {country}, aunque {trend}.`

Valores posibles de `{trend}`:

- `su tendencia reciente está pendiente de clasificación`
- `su ritmo de venta se disparó en el tramo más reciente`
- `sus ventas están ganando velocidad`
- `mantiene una subida clara en el tramo reciente`
- `muestra una subida gradual`
- `mantiene un ritmo reciente estable`

Tooltips de momentum:

- Explosivo: `El ritmo se disparó: en los primeros 10 días del período vendía ~{firstThirdPace} unidades por día; en los últimos 10 días ya vende ~{latestThirdPace}/día, {ratio}x el ritmo inicial.`
- Acelerando: `La demanda ganó velocidad: pasó de ~{firstThirdPace} unidades por día en el primer tercio a ~{latestThirdPace}/día en el tercio más reciente, un ritmo {ratio}x mayor.`
- Subiendo: `La tendencia va al alza: el promedio pasó de ~{firstThirdPace} unidades por día en los primeros 10 días a ~{latestThirdPace}/día en los últimos 10 días, una relación de {ratio}x.`

#### Tarjeta guardada

- `Producto sin nombre`
- Texto accesible: `Abrir {productName} en Dropkiller`
- Texto accesible: `Imagen no disponible`
- Países: `Colombia`, `México`
- `Datos guardados`
- `Vendidas`
- `Últimos 7 días`
- `Últimos 30 días`
- `Competencia`
- `Sin datos`
- `{n} vendedor`
- `{n} vendedores`
- `Quitar de guardados`
- `Quitando...`
- Fallback numérico: `—`

#### Errores de acciones de guardado/remoción

- `Debes iniciar sesión para guardar productos.`
- `No se pudo guardar el producto: {mensaje}`
- `El producto guardado no es válido.`
- `Debes iniciar sesión para quitar productos guardados.`
- `No se pudo quitar el producto: {mensaje}`
- `El país del producto no es válido.`
- `El campo {field} es obligatorio.`

Estos errores se lanzan desde acciones; las tarjetas no tienen un bloque inline propio para mostrarlos.

### 4. Todos los elementos interactivos

- `Refrescar` ejecuta la sincronización Dropkiller manual, se deshabilita, muestra spinner/`Actualizando...`, refresca la ruta si tiene éxito y presenta feedback de éxito/error.
- `Sugeridos` navega a `/command-center/investigacion`.
- `Guardados` navega a `/command-center/investigacion?vista=guardados`.
- El formulario exige ID, limita a 100 caracteres y usa un input de texto con teclado numérico sugerido mediante `inputMode="numeric"`; permite elegir Colombia/México.
- `Buscar` ejecuta una server action que redirige a la misma ruta con `producto` y `pais_producto`, conservando `vista=guardados` cuando corresponde.
- `Limpiar consulta` elimina los parámetros de consulta, conservando el tab guardados si está activo.
- Una tarjeta con UUID abre `https://www.dropkiller.com/dashboard/products/{uuid}` en pestaña nueva.
- Las imágenes hacen fallback al icono si falta URL o falla la carga.
- El badge de momentum es un botón de ayuda y muestra tooltip por hover/foco.
- `Guardar` ejecuta upsert por `external_id,country_code`, queda deshabilitado si ya está guardado, no hay ID o está pendiente, y revalida la ruta.
- `Quitar de guardados` elimina el registro, usa estado `Quitando...` y revalida.
- Los formularios de guardar/quitar permanecen interactivos sobre la tarjeta-enlace sin activar el enlace externo.

### 5. Datos mostrados

#### Sugeridos/consulta

- Imagen, nombre y precio de venta.
- País por agrupación; la tarjeta sugerida no repite país.
- Resumen calculado.
- Percentil y tamaño de muestra en consulta puntual.
- Tendencia/momentum.
- Ventas totales, últimos 7 y 30 días.
- Proveedores/vendedores.
- Clasificación de demanda y percentil.
- En consulta: ritmo reciente, días con venta, promedios de tercios y ratio de tendencia.

#### Guardados

- País, imagen, nombre, precio guardado, ventas totales, ventas 7/30 días y competencia.

Precios usan COP para CO y MXN para MX, sin decimales visibles. Conteos se localizan por país.

### 6. Notablemente ausente

- La vista Sugeridos limita a 10 candidatos por país y no tiene paginación, cargar más ni control de ese límite.
- No hay filtros ni ordenamiento visible dentro de sugeridos o guardados.
- El formulario puntual no tiene estado pendiente visible ni deshabilita `Buscar` durante la server action.
- No hay confirmación ni deshacer al quitar un guardado.
- Guardar/quitar no muestran feedback inline de éxito o error; dependen de revalidación o error de acción.
- No hay edición de productos guardados.
- No hay enlaces internos a pedidos/costeos desde productos.
- Las tarjetas sin UUID no ofrecen una acción alternativa para abrir detalle.
- No hay fecha visible de captura en tarjetas, aunque `captured_at` forma parte del candidato.
- No se muestran `platform`, `suggested_price`, `stock`, ni los booleanos de clasificación.

## Costeos — redirección

### 1. Route

`/costeos`

### 2. Jerarquía visual de arriba hacia abajo

No renderiza pantalla; redirige inmediatamente a `/costeos/co`.

### 3. Todo el copy literal

No contiene copy visible.

### 4. Todos los elementos interactivos

No contiene controles propios.

### 5. Datos mostrados

No consulta ni muestra datos propios.

### 6. Notablemente ausente

No existe una landing de selección: la ruta resuelve directamente a Colombia.

## Costeos — Colombia

### 1. Route

`/costeos/co`

Parámetros usados:

- `costeo={id}` selecciona un costeo guardado.
- `guardado=1` muestra confirmación de guardado.
- `importe=1` muestra confirmación de importe para un costeo seleccionado.

Los costeos CO se cargan por `created_at` descendente.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - Eyebrow `COSTEOS`.
   - Título `Colombia`.
   - Subtítulo.
2. Tabs de país:
   - `Colombia`, activo.
   - `México`, inactivo.
3. Calculadora:
   - Tarjeta de formulario a la izquierda.
   - Tarjeta `Resultados` y su subtítulo a la derecha.
4. Con costeo seleccionado:
   - `Proyección de campaña`.
   - `Packs por cantidad`.
5. `Costeos guardados`.

#### Formulario de calculadora

1. `Calculadora de costeos` para nuevo o `Editar costeo` para selección.
2. Descripción.
3. Confirmación condicional de guardado.
4. Campos de producto, precios, tasas, costos y CPA.
5. Botón de guardar.

#### Resultados

1. Métricas monetarias y de ROAS/breakeven.
2. Subsección `Distribución sobre precio` con porcentajes de cada componente.

#### Proyección de campaña

1. `Etapa 2`.
2. Título y descripción.
3. Confirmación condicional de importe.
4. Campo de importe y guardar.
5. Nueve resultados proyectados.

#### Packs por cantidad

1. `Promociones`.
2. Título y descripción.
3. Porcentaje de ganancia extra.
4. `Agregar cantidad`.
5. Tabla de packs.

#### Costeos guardados

1. Eyebrow.
2. `Productos CO`.
3. `Nuevo costeo`.
4. Grilla o empty state.

### 3. Todo el copy literal

#### Encabezado y tabs

- `COSTEOS`
- `Colombia`
- `México`
- Etiqueta accesible de tabs: `Países de costeos`
- `Calculadora operativa para validar margen antes de escalar producto.`

#### Calculadora

- `Calculadora de costeos`
- `Editar costeo`
- `Ajusta los supuestos de venta, entrega y pauta para ver la economía unitaria en vivo.`
- `Costeo guardado correctamente.`
- `Producto`
- Placeholder: `Nombre del producto`
- `Precio proveedor`
- `Precio venta`
- `% descuento mostrado`
- `Calcula el precio de comparación automáticamente.`
- `Debe ser menor a 100%.`
- `Flete base`
- `Tasa efectividad`
- `Costos administrativos`
- `Fullfilment`
- `CPA ads`
- `Restablecer a objetivo`
- `CPA automático: usa el porcentaje objetivo.`
- `CPA manual: no se actualiza al cambiar el precio.`
- `% CPA objetivo`
- `Tasa cancelación`
- `Guardar`
- `Guardar cambios`
- `Guardando...`
- Prefijos/sufijos: `$`, `%`

Validaciones/errores de acción:

- `El campo {nombre_del_campo} debe ser un número válido.`
- `El país del costeo debe ser CO o MX.`
- `El % descuento mostrado debe ser menor a 100.`
- `El nombre del producto es obligatorio.`
- `No se pudo guardar el costeo: {mensaje}`
- `No se pudo actualizar el costeo: {mensaje}`

Errores de carga de página:

- `No se pudieron cargar los costeos: {mensaje}`
- `No se pudo cargar el costeo: {mensaje}`

#### Resultados

- `Resultados`
- `Cálculos derivados de la lógica original de calcucrm.`
- `Flete con devoluciones`
- `CPA con devoluciones y cancelaciones`
- `Costos totales`
- `Utilidad por pedido entregado`
- `Utilidad promedio por pedido Shopify`
- `Precio comparación`
- `Breakeven`
- `ROAS`
- Fallback: `—`
- Precio inválido: `Inválido`

Distribución:

- `Distribución sobre precio`
- `Proveedor`
- `Flete con devoluciones`
- `Costos administrativos`
- `Fullfilment`
- `CPA ajustado`
- `Costos totales`
- `Utilidad promedio Shopify`

#### Proyección de campaña

- `Etapa 2`
- `Proyección de campaña`
- `Usa los valores actuales de la calculadora, incluso si estás explorando cambios sin guardarlos.`
- `Importe gastado guardado correctamente.`
- `Importe gastado`
- `$`
- `Guardar importe gastado`
- `Guardando...`
- `Pedidos totales`
- `Valor facturación`
- `Pedidos despachados`
- `Valor despachado`
- `Pedidos entregados`
- `Valor entregado`
- `Utilidad neta`
- `CPA real`
- `CPA real %`
- Fallback: `—`
- `No se pudo guardar el importe gastado: {mensaje}`

#### Packs por cantidad

- `Promociones`
- `Packs por cantidad`
- `Calcula precios para ofertas por volumen usando los valores actuales del costeo.`
- `% ganancia extra por unidad adicional`
- `%`
- `Agregar cantidad`
- `Cantidad`
- `Precio total`
- `Precio por unidad`
- `Tu ganancia total`
- `Ahorro del cliente`
- `Ahorro %`
- Fallback: `—`

#### Costeos guardados

- `Costeos guardados`
- `Productos CO`
- `Nuevo costeo`
- `Producto sin nombre`
- `Sin fecha`
- Fallback: `—`
- `Aún no hay costeos guardados para Colombia.`

### 4. Todos los elementos interactivos

- Tabs `Colombia` y `México` navegan a `/costeos/co` y `/costeos/mx`.
- Todos los resultados de la calculadora se recalculan al escribir.
- Cambiar precio de venta o CPA objetivo recalcula CPA mientras permanezca automático.
- Editar CPA directamente activa modo manual; `Restablecer a objetivo` vuelve a automático.
- `Guardar` crea; `Guardar cambios` actualiza el seleccionado.
- Los errores de acciones se lanzan; la calculadora no tiene bloque inline propio para ellos.
- `Importe gastado` recalcula proyección; `Guardar importe gastado` persiste y redirige con `importe=1`.
- La proyección usa valores actuales del formulario, incluso no guardados.
- El porcentaje de packs se edita y recalcula todas las filas.
- Packs inicia con cantidades 2 y 3. `Agregar cantidad` agrega 4 a 10 y se deshabilita al llegar a 10.
- `Nuevo costeo` elimina `costeo`, `guardado` e `importe`.
- Cada tarjeta guardada selecciona mediante `?costeo={id}`; la activa usa `aria-current="page"`.

### 5. Datos mostrados

#### Entradas y resultados de calculadora

- Producto, proveedor, venta, descuento, flete, efectividad, administrativos, fulfillment, CPA, CPA objetivo y cancelación.
- Flete ajustado por devoluciones.
- CPA ajustado por devoluciones/cancelaciones.
- Costos totales.
- Utilidad por entregado y utilidad promedio Shopify.
- Precio de comparación, breakeven y ROAS.
- Distribución porcentual del precio.

Valores iniciales para nuevo CO:

- Tasa de efectividad: 75%.
- CPA objetivo: 20%.

#### Proyección

- Importe, pedidos, facturación, despachos, entregas, utilidad y CPA real.

#### Packs

- Cantidad, precio total/unitario, ganancia total y ahorro absoluto/porcentual.

#### Guardados

- Producto, precio de venta y fecha de creación.

Los montos se muestran en COP. La lista está ordenada por creación descendente.

### 6. Notablemente ausente

- No hay borrar, duplicar ni aviso de cambios sin guardar.
- Los inputs monetarios muestran `$`, no un código de moneda junto al campo.
- No hay error de acción inline.
- La proyección no tiene período, restablecer importe ni historial de importes.
- Las cantidades de packs no se pueden quitar ni editar directamente; los packs no se guardan, copian ni exportan.
- La lista guardada no tiene búsqueda, filtros, orden, paginación, conteo ni acciones directas por tarjeta.
- No hay modal/drawer ni confirmación para guardar.

## Costeos — México

### 1. Route

`/costeos/mx`

Usa los mismos parámetros `costeo`, `guardado` e `importe`. Carga costeos MX por `created_at` descendente.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - `COSTEOS`.
   - `México`.
   - Subtítulo.
2. Tabs: Colombia inactivo, México activo.
3. Calculadora:
   - Formulario.
   - Bloque `Ver importes en COP`.
   - `Resultados` y el subtítulo `Cálculos derivados de la lógica original de calcucrm.`.
4. Con selección:
   - Proyección de campaña.
   - Packs por cantidad.
5. Costeos guardados.

La estructura de formulario, resultados, proyección, packs y lista es la misma que en Colombia, con las diferencias de moneda/comportamiento indicadas abajo.

### 3. Todo el copy literal

#### Encabezado y conversión

- `COSTEOS`
- `Colombia`
- `México`
- Etiqueta accesible de tabs: `Países de costeos`
- `Calculadora operativa para validar margen antes de escalar producto.`
- `Ver importes en COP`
- `Los valores se guardan siempre en MXN.`
- `Consultando tasa de cambio...`
- `1 MXN = {tasa} COP`
- `No se pudo obtener la tasa de cambio`

#### Calculadora compartida

- `Calculadora de costeos`
- `Editar costeo`
- `Ajusta los supuestos de venta, entrega y pauta para ver la economía unitaria en vivo.`
- `Costeo guardado correctamente.`
- `Producto`
- `Nombre del producto`
- `Precio proveedor`
- `Precio venta`
- `% descuento mostrado`
- `Calcula el precio de comparación automáticamente.`
- `Debe ser menor a 100%.`
- `Flete base`
- `Tasa efectividad`
- `Costos administrativos`
- `Fullfilment`
- `CPA ads`
- `Restablecer a objetivo`
- `CPA automático: usa el porcentaje objetivo.`
- `CPA manual: no se actualiza al cambiar el precio.`
- `% CPA objetivo`
- `Tasa cancelación`
- `Guardar`
- `Guardar cambios`
- `Guardando...`
- `$`
- `%`

Validaciones/errores:

- `El campo {nombre_del_campo} debe ser un número válido.`
- `El país del costeo debe ser CO o MX.`
- `El % descuento mostrado debe ser menor a 100.`
- `El nombre del producto es obligatorio.`
- `No se pudo guardar el costeo: {mensaje}`
- `No se pudo actualizar el costeo: {mensaje}`
- `No se pudieron cargar los costeos: {mensaje}`
- `No se pudo cargar el costeo: {mensaje}`

#### Resultados compartidos

- `Resultados`
- `Cálculos derivados de la lógica original de calcucrm.`
- `Flete con devoluciones`
- `CPA con devoluciones y cancelaciones`
- `Costos totales`
- `Utilidad por pedido entregado`
- `Utilidad promedio por pedido Shopify`
- `Precio comparación`
- `Breakeven`
- `ROAS`
- `Distribución sobre precio`
- `Proveedor`
- `Costos administrativos`
- `Fullfilment`
- `CPA ajustado`
- `Utilidad promedio Shopify`
- Fallback: `—`
- `Inválido`

#### Proyección compartida

- `Etapa 2`
- `Proyección de campaña`
- `Usa los valores actuales de la calculadora, incluso si estás explorando cambios sin guardarlos.`
- `Importe gastado guardado correctamente.`
- `Importe gastado`
- `$`
- `Guardar importe gastado`
- `Guardando...`
- `Pedidos totales`
- `Valor facturación`
- `Pedidos despachados`
- `Valor despachado`
- `Pedidos entregados`
- `Valor entregado`
- `Utilidad neta`
- `CPA real`
- `CPA real %`
- Fallback: `—`
- `No se pudo guardar el importe gastado: {mensaje}`

#### Packs compartidos

- `Promociones`
- `Packs por cantidad`
- `Calcula precios para ofertas por volumen usando los valores actuales del costeo.`
- `% ganancia extra por unidad adicional`
- `Agregar cantidad`
- `Cantidad`
- `Precio total`
- `Precio por unidad`
- `Tu ganancia total`
- `Ahorro del cliente`
- `Ahorro %`
- Fallback: `—`

#### Lista guardada reutilizada

- `Costeos guardados`
- `Productos CO`
- `Nuevo costeo`
- `Producto sin nombre`
- `Sin fecha`
- Fallback: `—`
- `Aún no hay costeos guardados para Colombia.`

`Productos CO` y `Aún no hay costeos guardados para Colombia.` aparecen literalmente también en esta ruta MX.

### 4. Todos los elementos interactivos

- Tabs, formulario, modo CPA, guardado, proyección, packs, selección y `Nuevo costeo` se comportan como en CO.
- `Ver importes en COP` es un switch. La primera activación solicita `/api/fx/mxn-cop`; las siguientes reutilizan la tasa en estado.
- Activado, convierte visualmente campos monetarios y resultados a COP. Los valores ocultos enviados permanecen en MXN.
- Si falla la tasa, aparece `No se pudo obtener la tasa de cambio`; el switch queda deshabilitado porque el error persiste en estado.
- La proyección se renderiza para una selección MX, pero su acción de guardado filtra `pais = "CO"` y redirige a `/costeos/co?costeo={id}&importe=1`.
- La lista selecciona costeos MX mediante `?costeo={id}`.

### 5. Datos mostrados

- La calculadora y packs muestran MXN normalmente; con conversión activada, la calculadora muestra COP.
- Valores iniciales de un costeo nuevo MX: tasa de efectividad 0% y CPA objetivo 0%.
- Los mismos inputs, resultados, distribución, proyección y métricas de packs descritos en CO.
- La lista muestra producto, precio y fecha de creación.
- La lista guardada formatea el precio siempre como COP, también en MX.
- La proyección formatea todos los montos como COP, también para el costeo MX.

### 6. Notablemente ausente

- El switch tiene `role="switch"` y estado accesible, pero no `aria-label` ni asociación explícita con un label.
- Los campos usan `$`, sin código de moneda junto al input.
- Se mantienen las ausencias de CO: no borrar/duplicar, no aviso de cambios sin guardar, sin error de acción inline, sin período/historial de proyección, packs no removibles/guardables y lista sin búsqueda/filtros/paginación.
- La lista no tiene copy específico de México.
- El flujo de guardar importe no permanece en la ruta MX.

## Perfil del cliente

### 1. Route

`/clientes/[telefono]`

No tiene enlace en Sidebar o TopBar. Se alcanza desde `Ver perfil del cliente` en `OrderDetailDrawer`, cuando el pedido tiene teléfono.

Si falta teléfono o no existen pedidos para ese teléfono, llama `notFound()`; no muestra empty state propio.

### 2. Jerarquía visual de arriba hacia abajo

1. Encabezado:
   - `Volver a pedidos`.
   - Eyebrow `Perfil del cliente`.
   - Nombre.
   - Teléfono.
   - Badge de riesgo.
2. Cuatro tarjetas:
   - Total pedidos.
   - Entregados.
   - Cancelados.
   - Devueltos.
3. Tarjeta de historial:
   - `Historial completo`.
   - `Pedidos del cliente`.
   - Lista por creación descendente.
4. Cada fila: orden/ID, fecha, producto y badge de estado.

### 3. Todo el copy literal

- `Volver a pedidos`
- `Perfil del cliente`
- `Cliente sin nombre`
- `Riesgo alto`
- `Riesgo medio`
- `Riesgo bajo`
- `Sin datos`
- `Total pedidos`
- `Entregados`
- `Cancelados`
- `Devueltos`
- `Historial completo`
- `Pedidos del cliente`
- Estados: `Nuevo`, `En ruta`, `Entregado`, `Cancelado`, `Devolución`
- `ID {id}`
- `Sin fecha`
- `Producto sin nombre`
- `No se pudo cargar el perfil del cliente: {mensaje}`
- `No se pudo clasificar el historial del cliente: {mensaje}`

### 4. Todos los elementos interactivos

- `Volver a pedidos` navega a `/pedidos`.
- Cada fila navega a `/pedidos?detalle={order.id}`.
- No hay otros controles en la pantalla.

### 5. Datos mostrados

- Nombre/apellido y riesgo del pedido más reciente.
- Teléfono tomado de la URL.
- Total de pedidos con ese teléfono.
- Conteos entregados, cancelados y devueltos según la categoría clasificada del estado Dropi.
- Por pedido: número/ID, fecha del pedido con fallback a `created_at`, producto y estado CRM.

### 6. Notablemente ausente

- No hay edición de cliente ni acciones de llamada, WhatsApp o email.
- No hay filtros, búsqueda ni paginación del historial.
- No se muestra país, dirección, ciudad, email, guía, transportadora ni valores monetarios.
- No se muestran tareas o notificaciones.
- Ningún ítem del Sidebar aparece activo en esta ruta.

## Cobertura de archivos leídos

### Shell, navegación y rutas globales

- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/notifications-actions.ts`
- `src/app/(app)/search-actions.ts`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/BackgroundBlobs.tsx`
- `src/components/nav/Sidebar.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/search/GlobalSearch.tsx`
- `src/components/ui/theme-toggle.tsx`

### Pedidos y cliente

- `src/app/(app)/pedidos/page.tsx`
- `src/app/(app)/pedidos/loading.tsx`
- `src/app/(app)/pedidos/actions.ts`
- `src/app/(app)/clientes/[telefono]/page.tsx`
- `src/app/api/orders/[id]/route.ts`
- `src/components/orders/OrderCardLink.tsx`
- `src/components/orders/OrderCard.tsx`
- `src/components/orders/RiskOrb.tsx`
- `src/components/orders/OrderFilters.tsx`
- `src/components/orders/RefreshOrdersButton.tsx`
- `src/components/orders/OrderDetailDrawer.tsx`

### Tareas

- `src/app/(app)/tareas/page.tsx`
- `src/app/(app)/tareas/actions.ts`
- `src/components/tasks/TaskFilters.tsx`
- `src/components/tasks/TaskSummaryBar.tsx`
- `src/components/tasks/TaskRow.tsx`
- `src/components/tasks/TaskDetailDrawer.tsx`
- `src/lib/whatsapp/buildTaskMessage.ts`
- `src/lib/whatsapp/formatPhoneForWhatsApp.ts`
- `src/lib/tasks/processOrderEvent.ts`
- `src/lib/tasks/checkStaleOrders.ts`
- `src/lib/tasks/checkConfirmationFollowups.ts`
- `src/app/api/webhooks/shopify/[country]/route.ts`

### Command Center

- `src/app/(app)/command-center/page.tsx`
- `src/app/(app)/command-center/finanzas/page.tsx`
- `src/app/(app)/command-center/metricas/page.tsx`
- `src/app/(app)/command-center/investigacion/page.tsx`
- `src/app/(app)/command-center/investigacion/actions.ts`
- `src/components/command-center/CapitalMovementsCard.tsx`
- `src/components/command-center/DateRangeSelector.tsx`
- `src/components/command-center/DineroEnLaCalleTable.tsx`
- `src/components/command-center/MovementBreakdownTable.tsx`
- `src/components/command-center/NetProfitCard.tsx`
- `src/components/command-center/ProductSummaryTable.tsx`
- `src/components/command-center/RefreshDropkillerButton.tsx`
- `src/components/command-center/SavedProductCard.tsx`
- `src/components/command-center/SweetSpotCard.tsx`
- `src/components/command-center/MomentumBadge.tsx`

### Costeos

- `src/app/(app)/costeos/page.tsx`
- `src/app/(app)/costeos/co/page.tsx`
- `src/app/(app)/costeos/mx/page.tsx`
- `src/app/(app)/costeos/actions.ts`
- `src/app/api/fx/mxn-cop/route.ts`
- `src/components/costeos/CosteoCalculator.tsx`
- `src/components/costeos/CampaignProjection.tsx`
- `src/components/costeos/CosteoList.tsx`
- `src/components/costeos/PromotionsPanel.tsx`

### UI primitives revisados por su impacto directo

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
