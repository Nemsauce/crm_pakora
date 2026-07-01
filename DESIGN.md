# DESIGN.md — CRM Pakora Design System

## Dirección visual
Torre de control operativo, no landing page. Lenguaje líquido/glassmorphism como identidad estructural (chrome, navegación, fondo ambiental) — pero superficies de datos siempre opacas, planas, alto contraste. La regla no negociable: **blur y transparencia nunca sobre contenido que el usuario necesita escanear rápido** (tablas, montos, listas de tareas, estados). El glass es para el marco de la app, no para la información.

## Color
- `--color-bg-base: #0A0B12` — fondo base (casi negro, tinte azul-violeta)
- `--color-bg-surface: #151725` — superficie de card/panel (opaco, para data)
- `--color-accent-from: #7C5CFF` — inicio de gradiente líquido primario (violeta)
- `--color-accent-to: #22D3EE` — fin de gradiente líquido primario (cian)
- `--color-risk-high: #FB7185` — alerta / novedad / riesgo alto
- `--color-risk-medium: #F5B942` — riesgo medio / pendiente
- `--color-risk-low: #34D399` — entregado / éxito / riesgo bajo
- `--color-text-primary: #E7E9F5`
- `--color-text-secondary: #8B90A8`

Estos van como CSS variables en globals.css y como tokens de Tailwind (extend.colors), no hardcodeados en componentes.

## Tipografía
- **Display** (headers, hero): Space Grotesk — vía next/font/google
- **Body/UI**: Inter — vía next/font/google
- **Datos/números** (montos, guías, IDs, cualquier cifra): JetBrains Mono, con `font-variant-numeric: tabular-nums` — vía next/font/google

Regla: cualquier número que el usuario compara visualmente (montos, cantidades, IDs) usa la fuente mono con tabular figures. Texto narrativo usa Inter. Headers/títulos de sección usan Space Grotesk.

## Layout
Sidebar densa + contenido principal (para cuando se construya el dashboard real). Fondo con gradiente líquido ambiental sutil y mayormente estático. Paneles de navegación/header con glassmorphism real (blur + transparencia). Cards de datos: opacas, planas, sin blur.

## Elemento firma (pendiente de construir)
"Orbe de riesgo": blob animado junto a cada pedido que encapsula `nivel_riesgo` — pulso lento verde (bajo), ámbar medio, rojo rápido/inquieto (alto). Se construye cuando exista la pantalla de lista de pedidos, no antes (necesita datos reales de `orders.nivel_riesgo`).

## Motion
Animación deliberada, no decorativa. Pantallas utilitarias (login, formularios, placeholders) llevan movimiento mínimo. El morphing/liquid motion se reserva para el fondo ambiental y para el orbe de riesgo (donde el movimiento comunica urgencia real). Siempre respetar `prefers-reduced-motion`.
