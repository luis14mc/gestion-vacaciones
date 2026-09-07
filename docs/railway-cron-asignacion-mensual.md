# Railway — Cron de asignación mensual de vacaciones

La asignación mensual acredita días **el día de ingreso de cada colaborador**
(devengo proporcional según el año laboral en curso). El cron debe ejecutarse
**todos los días** con `soloAniversario: true`, no solo el día 1 del mes.

## Opción A — Worker con acceso a BD (recomendada)

1. En el proyecto Railway, **New Service** → mismo repositorio.
2. **Settings → Config file path:** `railway.cron.toml`
3. Variables compartidas con la app web:
   - `DATABASE_URL`
   - `CRON_SECRET` (opcional para auditoría; el script usa BD directa)
4. El servicio corre a las **13:00 UTC** (≈ 07:00 Honduras) y termina.

Comando equivalente local:

```bash
pnpm cron:asignacion-mensual
```

## Opción B — HTTP contra la app web

Si el worker no debe tener `DATABASE_URL`:

1. Variables en el servicio cron:
   - `APP_URL` — URL pública (p. ej. `https://vacaciones.cni.hn`)
   - `CRON_SECRET` — igual que en la app
2. **Start command:**

```bash
pnpm tsx scripts/cron-http-asignacion-mensual.ts
```

3. **Cron schedule:** `0 13 * * *` (UTC)

## Verificación

Tras el primer día de prueba, revisar:

- `/asignaciones-mensuales` — filas nuevas con origen `automatico`
- `/configuracion` — tarjeta de asignación mensual
- Auditoría — acción `asignacion_vacaciones_mensual_batch`

## Regla de devengo (resumen)

| Años cumplidos | Año en devengo | Anual | Mensual |
|---|---|---|---|
| 0 | 1.er año | 10 | 0.8333 |
| 1 | 2.º año | 12 | 1.0000 |
| 2 | 3.er año | 15 | 1.2500 |
| 3 | 4.º año | 20 | 1.6667 |
| ≥ 4 | 5.º+ | 20 | 1.6667 |

Detalle: [fase-5-asignacion-mensual.md](./fase-5-asignacion-mensual.md)
