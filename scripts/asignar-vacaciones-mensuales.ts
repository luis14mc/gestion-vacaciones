/**
 * Script CLI: Asignación mensual automática de vacaciones (Fase 5).
 *
 * Uso:
 *   pnpm tsx scripts/asignar-vacaciones-mensuales.ts --anio=2026 --mes=7
 *
 * Si --mes se omite, usa el mes actual. Si --anio se omite, usa el año actual.
 *
 * En EC2, si el host no tiene pnpm/node, se recomienda ejecutar este
 * script DENTRO del contenedor:
 *
 *   docker exec -it <contenedor> node --import tsx \
 *     scripts/asignar-vacaciones-mensuales.ts --anio=2026 --mes=7
 *
 * O vía el endpoint protegido /api/cron/asignacion-mensual usando
 * CRON_SECRET (Bearer token).
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

interface CliArgs {
  anio?: number;
  mes?: number;
  modo?: 'automatico' | 'manual' | 'sistema';
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--anio' || a === '--año') args.anio = Number(process.argv[++i]);
    else if (a === '--mes') args.mes = Number(process.argv[++i]);
    else if (a === '--modo') args.modo = process.argv[++i] as CliArgs['modo'];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const now = new Date();
  const anio = args.anio ?? now.getFullYear();
  const mes = args.mes ?? now.getMonth() + 1;
  const modo: 'automatico' | 'manual' | 'sistema' = args.modo ?? 'sistema';

  if (mes < 1 || mes > 12) {
    console.error('[Fase 5] Mes inválido. Use --mes=1..12');
    process.exit(1);
  }
  if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
    console.error('[Fase 5] Año inválido. Use --anio=YYYY (2000-2100).');
    process.exit(1);
  }

  console.log(
    `[Fase 5] Ejecutando asignación mensual: anio=${anio} mes=${mes} modo=${modo}`
  );

  // Importación dinámica para asegurar que dotenv cargó DATABASE_URL.
  const { asignarVacacionesMensuales } = await import(
    '../src/services/asignacion-vacaciones.service'
  );

  const resumen = await asignarVacacionesMensuales({
    anio,
    mes,
    origen: modo,
    ejecutadoPor: 0,
  });

  console.log(
    `[Fase 5] Resultado: usuariosProcesados=${resumen.usuariosProcesados} ` +
      `asignacionesCreadas=${resumen.asignacionesCreadas} ` +
      `usuariosOmitidos=${resumen.usuariosOmitidos} ` +
      `totalDiasAsignados=${resumen.totalDiasAsignados}`
  );

  for (const d of resumen.detalles) {
    if (d.estado === 'asignado') {
      console.log(
        `  - usuario=${d.usuarioId} (${d.nombreCompleto}) ` +
          `anios=${d.aniosAntiguedad} dias=${d.diasAsignados} ` +
          `balance ${d.balanceAnterior} → ${d.balanceNuevo}`
      );
    } else {
      console.log(
        `  - usuario=${d.usuarioId} (${d.nombreCompleto}) omitido: ${d.estado} ` +
          (d.motivoOmision ? `(${d.motivoOmision})` : '')
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Fase 5] Error:', err);
    process.exit(1);
  });