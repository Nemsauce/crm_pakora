# DESIGN.md — CRM Pakora Design System (v3, dual-theme)

## Dirección visual
SaaS profesional, cálido y vibrante — evolución del sistema anterior con mayor precisión: logo propio, barra superior con búsqueda/notificaciones/avatar, íconos contextuales en filtros y cards, líneas de ruta decorativas en el fondo y sparklines reales en métricas. Soporta modo claro y oscuro con toggle explícito (no depende de preferencia del sistema operativo). Basado en mockups aprobados por Alejo (ambos temas, 3 pantallas: Pedidos, Tareas, Torre de control).

## Color — modo claro
- `--color-bg-page: #FFFFFF` con líneas de ruta punteadas muy sutiles en los bordes, usando el acento violeta a baja opacidad (decorativas, nunca compiten con contenido)
- `--color-bg-surface: #FFFFFF` (cards), con sombra suave (`shadow-md`) para separarse del fondo
- `--color-accent: #7C3AED`, degradado `--color-accent-from: #8B5CF6` → `--color-accent-to: #A78BFA` para pills/botones primarios
- `--color-text-primary: #0F172A`
- `--color-text-secondary: #64748B`
- `--color-border: #E5E7EB` (mínimo, la sombra separa más que el borde)
- `--color-positive: #16A34A` con `--color-positive-bg: #DCFCE7` (ganancias, entradas, deltas positivos)
- `--color-negative: #DC2626` con `--color-negative-bg: #FEE2E2` (salidas, deltas negativos, riesgo alto)
- `--color-risk-medium: #F59E0B` con `--color-risk-medium-bg: #FEF3C7`
- `--color-badge-nuevo: #7C3AED` con `--color-badge-nuevo-bg: #EDE9FE`
- `--color-badge-en-ruta: #C2410C` con `--color-badge-en-ruta-bg: #FFEDD5`

## Color — modo oscuro
- `--color-bg-page: #0A0D18` con el mismo motivo de ruta punteada, usando el acento del tema oscuro a baja opacidad
- `--color-bg-surface: #12151F` (cards), borde sutil `1px` en vez de solo sombra (la sombra se nota menos en fondo oscuro)
- `--color-accent: #A78BFA` (más claro que en modo claro, para contraste sobre fondo oscuro), degradado `--color-accent-from: #8B5CF6` → `--color-accent-to: #C4B5FD`
- `--color-text-primary: #F8FAFC`
- `--color-text-secondary: #94A3B8`
- `--color-border: #1E2433`
- `--color-positive: #4ADE80` con `--color-positive-bg: rgba(34,197,94,0.12)`
- `--color-negative: #F87171` con `--color-negative-bg: rgba(239,68,68,0.12)`
- `--color-risk-medium: #FBBF24` con `--color-risk-medium-bg: rgba(245,158,11,0.14)`
- `--color-badge-nuevo: #C4B5FD` con `--color-badge-nuevo-bg: rgba(139,92,246,0.18)`
- `--color-badge-en-ruta: #FBBF24` con `--color-badge-en-ruta-bg: rgba(217,119,6,0.16)`

Regla de contraste (ambos temas, no negociable): fondo pastel + texto SATURADO/SÓLIDO del mismo color semántico — nunca una versión clara como texto. Debe leerse sin esfuerzo a tamaño pequeño.

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
