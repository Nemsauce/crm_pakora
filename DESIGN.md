# DESIGN.md — CRM Pakora Design System

## Dirección visual
SaaS profesional claro, cálido, vibrante — "Light Blobmorphism". Shell de la app insertado con margen (flota sobre el fondo, no full-bleed), cards blancas con sombra real y profundidad, acentos de color en círculos/pills recurrentes. El color vive en el contenido — círculos de acento pastel, badges saturados, futuros gráficos/sparklines de color — no en un fondo decorado. El fondo se mantiene limpio y casi blanco para que el color del contenido resalte. Basado en referencia de Figma aprobada por Alejo — cada elemento de esa referencia (color, sombra, forma, acento) es intencional y debe reflejarse, salvo el copy/contenido/ubicación específica de paneles, que es solo demostrativa. Sigue siendo una torre de control operativa: la calidez y el color no deben sacrificar legibilidad ni densidad de datos en listas/montos/estados.

## Color
- `--color-bg-page`: gradiente diagonal cálido a lavanda `#FDF4F0 → #F5EAFB → #EAF0FB` — wash muy sutil o base casi blanca del fondo de la app, nunca un fondo decorado que compita con contenido opaco de borde a borde
- `--color-bg-surface: #FFFFFF` — cards y paneles
- `--color-accent: #7C3AED` — violeta primario
- `--color-accent-from: #8B5CF6` / `--color-accent-to: #D946EF` — degradado violeta→fucsia, botones primarios y acentos de contenido
- `--color-text-primary: #1E1B2E`
- `--color-text-secondary: #6B7280`
- `--color-border: #F1EEF9`
- `--color-risk-high: #EF4444` / `--color-risk-high-bg: #FEE2E2`
- `--color-risk-medium: #F59E0B` / `--color-risk-medium-bg: #FEF3C7`
- `--color-risk-low: #10B981` / `--color-risk-low-bg: #D1FAE5`
- `--color-positive: #16A34A`
- `--color-negative: #DC2626`
- Colores de acento secundarios para círculos/iconos (inspirados en la referencia, uso libre para categorías/iconos que no sean semánticas de riesgo): azul `#3B82F6`/`#DBEAFE`, rosa `#EC4899`/`#FCE7F3`, naranja `#F97316`/`#FFEDD5` — cada uno con su versión pastel-bg + sólido-texto siguiendo la misma regla de contraste

## Tipografía
Sin cambios: Space Grotesk (display), Inter (body/UI), JetBrains Mono tabular-nums (datos/números).

## Shell insertado (estructural, no negociable)
El shell completo de la app (sidebar + área de contenido) NO es full-bleed. Vive insertado dentro del viewport con margen visible en los 4 lados (ej. `p-4` a `p-6` alrededor de todo el shell), esquinas redondeadas grandes (`rounded-2xl` o mayor) en el contenedor exterior, y sombra propia (`shadow-xl` o similar) que lo separa del fondo limpio/casi blanco. Esto aplica a TODAS las pantallas autenticadas (sidebar + pedidos + futuras). Las pantallas de auth (login/set-password) ya tienen esto naturalmente por ser una card centrada sobre el fondo.

## Fondo de la app
El fondo de la app real es casi blanco/limpio — NO lleva blobs de colores compitiendo con el contenido. Puede llevar, como máximo, un wash muy sutil del gradiente `bg-page` (apenas perceptible) o directamente un blanco/gris muy claro sólido. Los "blobs" coloridos de la referencia de Figma pertenecen al contexto de marketing alrededor del mockup del navegador, no al interior de la aplicación real — no se replican dentro del shell.

## Superficies y forma
- Cards: `rounded-2xl`, fondo blanco, **sombra con profundidad real** — `shadow-lg` o `shadow-xl` en reposo (no `shadow-sm`, eso quedó demasiado plano), la sombra es parte central del lenguaje visual, no un detalle sutil
- Badges/chips: fondo pastel + texto sólido/saturado (regla de contraste abajo), `rounded-full`, padding generoso (`px-3 py-1` mínimo)
- **Círculos de acento**: patrón recurrente de la referencia — cualquier ícono, indicador, o avatar pequeño vive dentro de un círculo con fondo pastel del color correspondiente (ej. el indicador de riesgo, iconos de tipo de tarea a futuro, avatares de cliente). No queda un ícono/punto suelto sin ese círculo contenedor cuando el contexto lo permite
- Botones primarios: degradado `accent-from → accent-to`, `rounded-full`
- Sidebar: fondo blanco, dentro del shell insertado, item activo con fondo violeta pastel y texto/ícono en `accent`

### Contraste de badges (regla no negociable)
Fondo pastel + texto SATURADO/SÓLIDO del mismo color semántico, nunca una versión clara como texto. Ejemplo: fondo `risk-high-bg` + texto `risk-high` sólido. Debe leerse sin esfuerzo a tamaño pequeño.

## Indicador de riesgo
Badge/círculo de color sólido con el mapeo semántico exacto (alto/medio/bajo/sin_datos), ejecutado con el patrón de "círculo de acento" descrito arriba — no un punto plano aislado, sino un círculo con fondo pastel + el color sólido del riesgo dentro.

## Motion
Sin blobs animados de fondo. El movimiento, si existe, vive en transiciones sutiles de hover/focus y en elementos de datos específicos (ej. sparklines, contadores animados a futuro). Siempre respetar `prefers-reduced-motion`.
