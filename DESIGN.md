# DESIGN.md — CRM Pakora Design System

## Dirección visual
Reemplaza la dirección anterior (dark liquid-glass). Ahora: SaaS profesional claro, cálido y confiable — fondo con gradiente suave diagonal, cards blancas con sombra suave y esquinas muy redondeadas, acento violeta. Basado en referencia de Figma aprobada por Alejo. Sigue siendo una torre de control operativa: la calidez del fondo no debe sacrificar legibilidad ni densidad de datos donde se necesite escanear rápido (listas de pedidos, montos, estados).

## Color
- `--color-bg-page`: gradiente diagonal `#FDF4F0 → #F5EAFB → #EAF0FB` (cálido a lavanda, fondo general de la app)
- `--color-bg-surface: #FFFFFF` — cards y paneles, opacas, sombra suave (`shadow-sm`/`shadow-md`), sin necesidad de blur
- `--color-accent: #7C3AED` — violeta primario (texto de acento, iconos activos)
- `--color-accent-from: #8B5CF6` / `--color-accent-to: #D946EF` — degradado violeta→fucsia, reservado para el logo y botones primarios/CTAs, no para superficies de datos
- `--color-text-primary: #1E1B2E`
- `--color-text-secondary: #6B7280`
- `--color-border: #F1EEF9` — bordes casi invisibles, la separación la da la sombra, no el borde
- `--color-risk-high: #EF4444` / `--color-risk-high-bg: #FEE2E2`
- `--color-risk-medium: #F59E0B` / `--color-risk-medium-bg: #FEF3C7`
- `--color-risk-low: #10B981` / `--color-risk-low-bg: #D1FAE5`
- `--color-positive: #16A34A` (deltas positivos, métricas al alza)
- `--color-negative: #DC2626` (deltas negativos)

## Tipografía
Sin cambios respecto al sistema anterior:
- Display (headers): Space Grotesk
- Body/UI: Inter
- Datos/números (montos, guías, IDs): JetBrains Mono, tabular-nums

## Superficies y forma
- Cards: `rounded-2xl`, fondo blanco sólido, `shadow-sm` en reposo, sin bordes marcados, sin blur — nunca glassmorphism en este tema
- Badges/chips de estado: fondo pastel + texto saturado del mismo color (ej. riesgo alto = texto `risk-high` sobre fondo `risk-high-bg`), `rounded-full`, padding generoso
- Iconos en cards de métricas: dentro de un círculo con fondo pastel suave del color correspondiente
- Botones primarios: degradado `accent-from → accent-to`, `rounded-full` o `rounded-lg` según contexto
- Sidebar: fondo blanco/casi blanco, item activo con fondo violeta pastel (`accent` al 10-15% opacidad) y texto/ícono en `accent`

### Contraste de badges (regla no negociable)
Cada badge/pill de estado usa fondo pastel + texto en la versión SATURADA/SÓLIDA del mismo color semántico — nunca una versión clara/tenue del color como texto. Ejemplo correcto: fondo `risk-high-bg` (#FEE2E2) + texto `risk-high` (#EF4444, sólido, no aclarado). El texto debe leerse sin esfuerzo a tamaño pequeño. Si un token de color no ofrece suficiente contraste como texto sobre su propio fondo pastel, ese token necesita ajustarse — nunca se resuelve bajando el estándar de legibilidad.

## Fondo con blobs
El fondo de página (`bg-page`) no es solo un gradiente plano — incluye 3-4 formas orgánicas grandes (blobs), ancladas en las esquinas/bordes del viewport, en tonos del gradiente `accent-from`/`accent-to` y complementarios cálidos, a baja opacidad (suficiente para verse, no para competir con el contenido central). El centro de la pantalla donde vive el contenido principal queda visualmente limpio. Los blobs animan con morphing lento (15-25s de ciclo), nunca rápido ni llamativo.

## Indicador de riesgo (reemplaza el "orbe líquido" del tema anterior)
Sigue siendo el elemento de negocio no-negociable: cada pedido muestra su `nivel_riesgo` visualmente. En este tema se expresa como un badge/chip de color sólido (no un blob animado con glow) — punto de color + texto opcional, usando `risk-high/medium/low`. Se mantiene el mapeo semántico exacto (alto/medio/bajo/sin_datos), cambia solo la ejecución visual a algo plano y consistente con el resto del sistema de cards.

## Motion
Los blobs de fondo SÍ animan — morphing orgánico lento (border-radius + transform derivando con el tiempo), anclados en las esquinas del viewport, grandes, suaves, de baja opacidad para no competir con el contenido. Esto es el elemento central de "Light Blobmorphism": el fondo se siente vivo sin distraer. Las superficies de datos (cards, drawer, listas) permanecen estáticas — el movimiento vive solo en el fondo ambiental, nunca en elementos que el usuario necesita leer con precisión. Siempre respetar `prefers-reduced-motion` (fallback: blobs estáticos, sin animación).
