# Diseño: Dashboard distinto por rol (F2)

**Fecha:** 2026-09-15
**Fuente:** `tareas_faltantes_frontend_fase_1.md`, tarea F2. Mapeo de roles y sustitución del gap de Instalación confirmados por el usuario.

## Mapeo rol → variante

```ts
type DashboardVariante = 'completo' | 'comercial' | 'compras' | 'taller' | 'instalacion' | 'bitacora' | 'basico'
```

| Rol | Variante |
|---|---|
| supervisor | `completo` |
| comercial | `comercial` |
| compras | `compras` |
| produccion, metalmecanica | `taller` |
| instalacion | `instalacion` |
| auditoria, ingenieria | `bitacora` |
| lectura | `basico` |

## Composición de widgets por variante

Todas reutilizan `puedeVerCostos` (ya existente, F1) para decidir si el KPI "Valor Total" aparece — ninguna variante fuerza mostrar costos a un rol que F1 ya se los oculta.

- **completo** (supervisor): igual al Dashboard actual — Calendario, 4 KPIs, gráfica 7 días, últimos 10 movimientos. Sin cambios.
- **comercial**: Calendario, KPIs (Total Unidades, Movimientos del Día, Stock Bajo — sin Valor Total), gráfica, últimos 10 movimientos, + accesos rápidos a Vehículos e Inventario.
- **compras**: Calendario, KPIs (con Valor Total, `compras` sí ve costos), gráfica, **lista de productos con stock bajo** (nueva, top 5), accesos rápidos a Importar CSV y Entradas, últimos 10 movimientos.
- **taller** (produccion/metalmecanica): Calendario, KPIs (sin Valor Total, sin gráfica — pensado liviano por la conexión mala de Metalmecánica), accesos rápidos a Vehículos VIN / Formularios / Ajustes, últimos 10 movimientos.
- **instalacion**: Calendario, KPIs (sin Valor Total), accesos rápidos a Vehículos VIN, tabla "Vehículos con movimiento reciente" (reusa `UltimosMovimientosTable`, no es tracking de fase — eso sigue bloqueado, sin sistema de fases todavía).
- **bitacora** (auditoria/ingenieria): KPIs (Valor Total solo para auditoria vía `puedeVerCostos`), **bitácora de actividad** (`UltimosMovimientosTable` con 25 filas en vez de 10). Sin calendario ni gráfica — vista enfocada en auditoría.
- **basico** (lectura): solo KPIs (Total Unidades, Stock Bajo). Sin gráfica, tabla, calendario ni accesos rápidos.

## Piezas nuevas

- `lib/permissions/dashboard-variante.ts` — `DashboardVariante`, `VARIANTE_POR_ROL: Record<Role, DashboardVariante>`.
- `getDashboardData(limiteMovimientos: number = 10)` — se le agrega un parámetro opcional para pedir 25 filas en la variante `bitacora` en vez de duplicar la función.
- `fetchProductosBajoStock(limite: number): Promise<{codigo, nombre, saldo}[]>` — nueva función en `inventario-saldos-actions.ts`, solo usada por la variante `compras`.
- `components/dashboard/QuickLinksCard.tsx` — Card genérica de accesos rápidos, recibe una lista de `{label, href, icon}`.
- `components/dashboard/LowStockList.tsx` — Card con la lista de productos en `fetchProductosBajoStock`.

## Fuera de alcance

- Tracking real de fase del vehículo para Instalación (subsistema grande, bloqueado — ver hoja de ruta).
- Que "faltantes" en Compras dispare una alerta (eso es F9/WhatsApp, bloqueado).
- Personalización del Dashboard por el propio usuario (esto es fijo por rol, no configurable).
