# DESIGN.md — CRM Pakora Design System (v3, dual-theme)

## Dirección visual
SaaS profesional, cálido y vibrante — evolución del sistema anterior con mayor precisión: logo propio, barra superior con búsqueda/notificaciones/avatar, íconos contextuales en filtros y cards, líneas de ruta decorativas en el fondo y sparklines reales en métricas. Soporta modo claro y oscuro con toggle explícito (no depende de preferencia del sistema operativo). Basado en mockups aprobados por Alejo (ambos temas, 3 pantallas: Pedidos, Tareas, Torre de control).

## Color — modo claro
- `--color-bg-page: #FFFFFF` con líneas de ruta punteadas muy sutiles en los bordes, usando el acento violeta a baja opacidad (decorativas, nunca compiten con contenido)
- `--color-bg-surface: #FFFFFF` (cards), con sombra suave (`shadow-md`) para separarse del fondo
- `--color-accent: #7C3AED`, degradado accesible `--color-accent-from: #6D28D9` → `--color-accent-to: #7C3AED` para pills/botones primarios
- `--color-text-primary: #0F172A`
- `--color-text-secondary: #617187`
- `--color-border: #87919F` (frontera operativa con contraste no textual AA; separadores puramente decorativos pueden reducir su opacidad si no son la única señal)
- `--color-positive: #15803D` con `--color-positive-bg: #DCFCE7` (ganancias, entradas, deltas positivos)
- `--color-negative: #B91C1C` con `--color-negative-bg: #FEE2E2` (salidas, deltas negativos, riesgo alto)
- `--color-risk-medium: #B45309` con `--color-risk-medium-bg: #FEF3C7`
- `--color-badge-nuevo: #7C3AED` con `--color-badge-nuevo-bg: #EDE9FE`
- `--color-badge-en-ruta: #C2410C` con `--color-badge-en-ruta-bg: #FFEDD5`
- `--color-accent-blue: #1D4ED8` con `--color-accent-blue-bg: #DBEAFE`
- `--color-accent-pink: #BE185D` con `--color-accent-pink-bg: #FCE7F3`
- `--color-accent-orange: #C2410C` con `--color-accent-orange-bg: #FFEDD5`

## Color — modo oscuro
- `--color-bg-page: #0A0D18` con el mismo motivo de ruta punteada, usando el acento del tema oscuro a baja opacidad
- `--color-bg-surface: #12151F` (cards), borde sutil `1px` en vez de solo sombra (la sombra se nota menos en fondo oscuro)
- `--color-accent: #A78BFA` (más claro que en modo claro, para contraste sobre fondo oscuro), degradado accesible `--color-accent-from: #A78BFA` → `--color-accent-to: #C4B5FD`
- `--color-text-primary: #F8FAFC`
- `--color-text-secondary: #94A3B8`
- `--color-border: #627085` (frontera operativa con contraste no textual AA en las superficies oscuras declaradas)
- `--color-positive: #4ADE80` con `--color-positive-bg: rgba(34,197,94,0.12)`
- `--color-negative: #F87171` con `--color-negative-bg: rgba(239,68,68,0.12)`
- `--color-risk-medium: #FBBF24` con `--color-risk-medium-bg: rgba(245,158,11,0.14)`
- `--color-badge-nuevo: #C4B5FD` con `--color-badge-nuevo-bg: rgba(139,92,246,0.18)`
- `--color-badge-en-ruta: #FBBF24` con `--color-badge-en-ruta-bg: rgba(217,119,6,0.16)`
- `--color-accent-blue: #60A5FA` con `--color-accent-blue-bg: rgba(59,130,246,0.16)`
- `--color-accent-pink: #F472B6` con `--color-accent-pink-bg: rgba(236,72,153,0.16)`
- `--color-accent-orange: #FB923C` con `--color-accent-orange-bg: rgba(249,115,22,0.16)`

Regla de contraste (ambos temas, no negociable): fondo pastel + texto SATURADO/SÓLIDO del mismo color semántico — nunca una versión clara como texto. Debe leerse sin esfuerzo a tamaño pequeño.

## Extensión de tokens — rediseño CRM v5, fase 2

Esta fase solo declara infraestructura. Ningún alias consumido por las pantallas actuales (`--background`, `--card`, `--chart-1`…`--chart-5`, etc.) apunta todavía a estos tokens, por lo que agregarlos no cambia la interfaz renderizada. Su adopción se hará explícitamente en fases posteriores.

### Nuevos tokens de color — modo claro

| Token | Valor | Propósito |
|---|---|---|
| `--color-bg-surface-base` | `#F8FAFC` | Lienzo base para zonas de trabajo densas. |
| `--color-bg-surface-subtle` | `#FAF9FF` | Superficie secundaria para agrupar contenido o anidar bloques sin añadir sombras. |
| `--color-bg-surface-elevated` | `#FFFFFF` | Nivel elevado para cards, paneles flotantes y diálogos. |
| `--color-bg-hover` | `#F8FAFC` | Feedback de hover sobre filas, items y controles. |
| `--color-bg-selected` | `#FAF9FF` | Fondo de selección; se usa junto con `--color-border-selected`, nunca como única señal. |
| `--color-border-hover` | `#64748B` | Contorno perceptible para controles con hover cuando el fondo no basta. |
| `--color-border-selected` | `#7C3AED` | Contorno o indicador de selección con contraste no textual AA. |
| `--color-overlay` | `rgba(15, 23, 42, 0.56)` | Scrim detrás de drawers y diálogos; no es una superficie para texto. |
| `--color-on-accent` | `#FFFFFF` | Texto e íconos sobre `--color-accent`. |
| `--color-on-success` | `#FFFFFF` | Texto e íconos sobre el sólido `--color-positive`. |
| `--color-on-warning` | `#FFFFFF` | Texto e íconos sobre el sólido `--color-risk-medium`. |
| `--color-on-danger` | `#FFFFFF` | Texto e íconos sobre el sólido `--color-negative`. |
| `--color-chart-revenue` | `#1D4ED8` | Serie de ingresos brutos. |
| `--color-chart-profit` | `#15803D` | Serie de utilidad o ganancia. |
| `--color-chart-cost` | `#B45309` | Serie de costos y egresos operativos. |
| `--color-chart-refund` | `#B91C1C` | Serie de devoluciones, reembolsos o pérdidas. |
| `--color-chart-net` | `#6D28D9` | Serie de resultado neto, conservando el violeta de marca. |

### Nuevos tokens de color — modo oscuro

| Token | Valor | Propósito |
|---|---|---|
| `--color-bg-surface-base` | `#0A0D18` | Lienzo base para zonas de trabajo densas. |
| `--color-bg-surface-subtle` | `#0F1320` | Superficie secundaria para agrupar contenido o anidar bloques sin añadir sombras. |
| `--color-bg-surface-elevated` | `#171B2A` | Nivel elevado para cards, paneles flotantes y diálogos. |
| `--color-bg-hover` | `#1E2433` | Feedback de hover sobre filas, items y controles. |
| `--color-bg-selected` | `#251E42` | Fondo de selección; se usa junto con `--color-border-selected`, nunca como única señal. |
| `--color-border-hover` | `#64748B` | Contorno perceptible para controles con hover cuando el fondo no basta. |
| `--color-border-selected` | `#A78BFA` | Contorno o indicador de selección con contraste no textual AA. |
| `--color-overlay` | `rgba(2, 6, 23, 0.72)` | Scrim detrás de drawers y diálogos; no es una superficie para texto. |
| `--color-on-accent` | `#1E1035` | Texto e íconos sobre `--color-accent`. |
| `--color-on-success` | `#052E16` | Texto e íconos sobre el sólido `--color-positive`. |
| `--color-on-warning` | `#451A03` | Texto e íconos sobre el sólido `--color-risk-medium`. |
| `--color-on-danger` | `#450A0A` | Texto e íconos sobre el sólido `--color-negative`. |
| `--color-chart-revenue` | `#60A5FA` | Serie de ingresos brutos. |
| `--color-chart-profit` | `#4ADE80` | Serie de utilidad o ganancia. |
| `--color-chart-cost` | `#FB923C` | Serie de costos y egresos operativos. |
| `--color-chart-refund` | `#F87171` | Serie de devoluciones, reembolsos o pérdidas. |
| `--color-chart-net` | `#C4B5FD` | Serie de resultado neto, conservando el violeta de marca. |

Los gráficos no deben comunicar una diferencia únicamente por color: combinar las series con labels, marcadores, patrones de línea o símbolos. Los tokens financieros no reemplazan todavía la paleta genérica `--chart-1`…`--chart-5`.

### Verificación de contraste de los tokens nuevos

Ratios calculados con luminancia relativa WCAG 2.x en sRGB. El mínimo es `4.5:1` para texto normal y `3:1` para texto grande o elementos gráficos esenciales.

| Pareja prevista | Claro | Oscuro | Resultado |
|---|---:|---:|---|
| `--color-text-primary` sobre los tres niveles de superficie (peor caso) | `17.05:1` | `16.36:1` | AA normal |
| `--color-text-secondary` sobre los tres niveles de superficie (peor caso) | `4.75:1` | `6.68:1` | AA normal |
| `--color-text-secondary` sobre `--color-bg-hover` | `4.76:1` | `6.04:1` | AA normal |
| `--color-text-secondary` sobre `--color-bg-selected` | `4.75:1` | `6.10:1` | AA normal |
| `--color-accent` / `--color-border-selected` sobre `--color-bg-selected` | `5.44:1` | `5.75:1` | AA normal y no textual |
| `--color-border-hover` sobre `--color-bg-hover` | `4.55:1` | `3.26:1` | AA no textual |
| `--color-on-accent` sobre `--color-accent` | `5.70:1` | `6.54:1` | AA normal |
| `--color-on-success` sobre `--color-positive` | `5.02:1` | `8.55:1` | AA normal |
| `--color-on-warning` sobre `--color-risk-medium` | `5.02:1` | `8.97:1` | AA normal |
| `--color-on-danger` sobre `--color-negative` | `6.47:1` | `5.84:1` | AA normal |
| `--color-chart-revenue` sobre los tres niveles de superficie (peor caso) | `6.40:1` | `6.73:1` | AA no textual y normal |
| `--color-chart-profit` sobre los tres niveles de superficie (peor caso) | `4.79:1` | `9.82:1` | AA no textual y normal |
| `--color-chart-cost` sobre los tres niveles de superficie (peor caso) | `4.80:1` | `7.56:1` | AA no textual y normal |
| `--color-chart-refund` sobre los tres niveles de superficie (peor caso) | `6.18:1` | `6.19:1` | AA no textual y normal |
| `--color-chart-net` sobre los tres niveles de superficie (peor caso) | `6.79:1` | `9.27:1` | AA no textual y normal |

`--color-overlay` es exclusivamente un fondo de atenuación: el contenido legible se coloca sobre `--color-bg-surface-elevated`, no directamente sobre el overlay.

### Remediación de contraste WCAG AA — fase 2.1

Esta corrección sí actualiza tokens existentes y consumidos. Cambia únicamente sus valores cromáticos: no altera layout, espaciado, tipografía, estructura ni comportamiento de componentes. Los tonos se mantienen dentro de la misma familia semántica.

| Token o pareja corregida | Valor anterior → nuevo | Ratio anterior → nuevo | Criterio |
|---|---|---:|---|
| `--color-positive` sobre `--color-positive-bg` (claro) | `#16A34A` → `#15803D` | `3.00:1` → `4.57:1` | AA texto normal |
| `--color-positive` directamente sobre blanco (claro) | mismo ajuste | `3.30:1` → `5.02:1` | AA texto normal |
| `--color-negative` sobre `--color-negative-bg` (claro) | `#DC2626` → `#B91C1C` | `3.95:1` → `5.30:1` | AA texto normal |
| `--color-risk-medium` sobre `--color-risk-medium-bg` (claro) | `#F59E0B` → `#B45309` | `1.93:1` → `4.51:1` | AA texto normal |
| `--color-accent-blue` sobre su fondo (claro) | `#3B82F6` → `#1D4ED8` | `3.01:1` → `5.49:1` | AA texto normal |
| `--color-accent-pink` sobre su fondo (claro) | `#EC4899` → `#BE185D` | `3.00:1` → `5.14:1` | AA texto normal |
| `--color-accent-orange` sobre su fondo (claro) | `#F97316` → `#C2410C` | `2.45:1` → `4.52:1` | AA texto normal |
| `--muted-foreground` sobre el `--muted` calculado (claro) | `--color-text-secondary: #64748B` → `#617187` | `4.38:1` → `4.58:1` | AA texto normal |
| Degradado primario con texto blanco (claro) | `#8B5CF6 → #A78BFA` pasa a `#6D28D9 → #7C3AED` | extremos `4.23:1 → 2.72:1` pasan a `7.10:1 → 5.70:1` | AA normal en todo el rango |
| Degradado primario con texto `#12151F` (oscuro) | inicio `#8B5CF6` → `#A78BFA`; final `#C4B5FD` sin cambio | extremos `4.30:1 → 9.87:1` pasan a `6.69:1 → 9.87:1` | AA normal en todo el rango |
| `--chart-2` sobre blanco (claro) | hereda el nuevo `--color-accent-to` | `2.72:1` → `5.70:1` | Supera AA no textual (`3:1`) |
| `--chart-4` sobre blanco (claro) | hereda el nuevo `--color-risk-medium` | `2.15:1` → `5.02:1` | Supera AA no textual (`3:1`) |
| `--color-border` sobre la superficie actual (claro) | `#E5E7EB` → `#87919F` | `1.24:1` → `3.19:1` | AA no textual |
| `--color-border` sobre la superficie actual (oscuro) | `#1E2433` → `#627085` | `1.18:1` → `3.62:1` | AA no textual |

Los bordes se verificaron también contra todas las superficies extendidas: el peor caso es `3.05:1` en claro y `3.08:1` en oscuro. `--color-border` se considera una frontera operativa porque hoy sirve tanto a inputs y controles como a separadores. Un borde con opacidad reducida solo puede usarse como decoración cuando otra señal —fondo, forma, espaciado o estado— comunica el límite.

Los cambios semánticos exigieron dos ajustes dependientes: `--color-on-success` cambia de `#052E16` a `#FFFFFF` (`4.52:1` → `5.02:1`) y `--color-on-warning` de `#451A03` a `#FFFFFF` (`6.97:1` → `5.02:1`). `--color-on-danger` no cambia, pero mejora de `4.83:1` a `6.47:1` por el nuevo rojo. Los aliases `--color-risk-low`, `--color-risk-high`, `--destructive`, `--chart-3`, `--chart-4` y `--chart-5` heredan las correcciones sin duplicar valores.

Los degradados se muestrearon en `100001` puntos tanto con interpolación sRGB como Oklab; el peor caso ocurre en un extremo. Incluso con el `opacity: 0.9` usado en hover, sus mínimos son `4.78:1` en claro y `5.64:1` en oscuro. La pareja oficial es texto blanco en claro y `--color-bg-surface` (`#12151F`) en oscuro.

Excepción preexistente y fuera del alcance de esta fase: los tabs activos de `costeos/co/page.tsx` y `costeos/mx/page.tsx` usan `text-white` fijo también en oscuro. Ningún fondo puede alcanzar `4.5:1` simultáneamente contra blanco y contra `#12151F`; esos dos consumidores deberán adoptar el foreground semántico en una fase de componentes. No se modifican aquí por la restricción explícita de trabajar solo en tokens.

Los semánticos oscuros no necesitaron cambio y fueron revalidados con composición alpha a precisión completa sobre sus fondos translúcidos: positive `8.66:1`, negative `5.90:1`, warning `8.63:1`, blue `5.90:1`, pink `5.77:1` y orange `6.47:1`. `--muted-foreground` oscuro conserva `6.64:1`; `--chart-2` y `--chart-4` oscuros conservan `9.87:1` y `10.91:1` sobre la superficie esperada.

### Duraciones de motion

Estas variables son iguales en modo claro y oscuro; `.dark` las hereda de `:root`. Aún no se aplican a ninguna transición.

| Token | Valor en ambos temas | Rango acordado | Uso |
|---|---:|---:|---|
| `--motion-duration-micro` | `120ms` | `100–160ms` | Confirmaciones inmediatas, presses y cambios mínimos. |
| `--motion-duration-hover-focus` | `140ms` | `120–160ms` | Hover y focus sin sensación de retraso. |
| `--motion-duration-drawer` | `240ms` | `220–260ms` | Entrada y salida de drawers. |
| `--motion-duration-content` | `200ms` | `180–240ms` | Cambios de contenido, filtros y vistas. |
| `--motion-duration-task-completion` | `440ms` | `380–480ms` | Confirmación perceptible al completar una tarea. |

### Densidad

| Token | Valor en ambos temas | Uso |
|---|---:|---|
| `--density-row-height-compact` | `2.5rem` (`40px`) | Tablas y listas operativas de alta densidad. |
| `--density-row-height-comfortable` | `3rem` (`48px`) | Paneles de detalle y contextos de lectura cómoda. |

### Escala de z-index

La escala es igual en ambos temas y deja intervalos de diez para insertar capas futuras sin valores ad hoc. Cada capa superior debe usarse solo cuando deba cubrir todas las anteriores.

| Token | Valor | Capa documentada |
|---|---:|---|
| `--z-index-ambient` | `0` | Fondo ambiental y decoración de ruta. |
| `--z-index-shell` | `10` | Shell, navegación y estructura persistente. |
| `--z-index-sticky-header` | `20` | Headers y barras operativas sticky. |
| `--z-index-dropdown-popover` | `30` | Dropdowns, menús contextuales, tooltips y popovers. |
| `--z-index-assistant-drawer` | `40` | Drawer del asistente. |
| `--z-index-operational-drawer` | `50` | Drawers operativos de pedido, tarea o cliente. |
| `--z-index-dialog` | `60` | Diálogos modales y sus overlays. |
| `--z-index-toast` | `70` | Toasts y avisos críticos efímeros. |

## Tipografía
Space Grotesk (display/headers), Manrope (body/UI), JetBrains Mono tabular-nums (montos, IDs, fechas).

## Elementos nuevos de este sistema (v3)
- **Logo**: ícono de flor de 4 pétalos en degradado violeta junto al texto "CRM Pakora"
- **Barra superior**: búsqueda, notificaciones, avatar circular con iniciales — presente en todas las pantallas autenticadas
- **Íconos contextuales**: cada filtro (país/estado/riesgo) lleva un ícono prefijo; cada card de pedido lleva ícono de pin antes de la ciudad y de calendario antes de la fecha
- **Blob decorativo por card**: forma orgánica de color sutil en la esquina inferior derecha de cada card, tono relacionado al estado del pedido, muy baja opacidad, puramente decorativo
- **Sparkline real**: en las cards de "Ganancia neta" de la Torre de control, una forma compacta de área/gráfico basada en la utilidad neta diaria del rango seleccionado
- **Círculos de ícono por tipo de tarea**: en `/tareas`, cada tarea lleva un círculo de color con ícono según su tipo (teléfono para llamar confirmación, camión para notificar guía, alerta para presionar entrega/resolver novedad)

## Superficies y forma
- Cards: `rounded-2xl`, sombra suave, sin blur/glass en ningún tema
- Sidebar: item activo como pill con degradado sutil (claro) o borde/glow violeta (oscuro), items inactivos en texto secundario plano
- Botones primarios: degradado `accent-from → accent-to`, `rounded-full`

## Motion
Motivo de ruta de fondo: líneas punteadas estáticas y de muy baja opacidad en los bordes. Riesgo alto: un único pulso de radar discreto que se desactiva con `prefers-reduced-motion`; los demás niveles permanecen estáticos. Listas (pedidos, tareas): animación de entrada notoria (fade + slide sutil) al cargar, escalonada entre items (stagger corto). Transiciones de tema (claro↔oscuro): instantáneas o con transición muy breve de color, nunca un fundido lento que se sienta lag. Hover en cards/botones: transición sutil de sombra/color.

## Theme toggle
Toggle explícito (no sigue preferencia del sistema), persistido en localStorage vía next-themes, sin flash de tema incorrecto al cargar (`suppressHydrationWarning`).
