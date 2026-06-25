import { sql } from 'drizzle-orm';

/** Reserva días de vacaciones al crear/enviar una solicitud. */
export async function reservarBalanceVacaciones(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: { usuarioId: number; anoLaboralId: number; dias: number }
): Promise<void> {
  const dias = Number(params.dias);
  if (dias <= 0) return;

  await tx.execute(sql`
    UPDATE balances
    SET cantidad_pendiente = cantidad_pendiente + ${dias},
        cantidad_disponible = GREATEST(0, cantidad_disponible - ${dias}),
        updated_at = NOW()
    WHERE usuario_id = ${params.usuarioId}
      AND ano_laboral_id = ${params.anoLaboralId}
      AND tipo_ausencia = 'vacaciones'
  `);
}

/** Confirma días reservados (pendiente → usada) tras aprobación RRHH. */
export async function confirmarBalanceVacaciones(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: { usuarioId: number; anoLaboralId: number; dias: number }
): Promise<void> {
  const dias = Number(params.dias);
  if (dias <= 0) return;

  await tx.execute(sql`
    UPDATE balances SET
      cantidad_pendiente = GREATEST(0, cantidad_pendiente - ${dias}),
      cantidad_usada = cantidad_usada + ${dias},
      updated_at = NOW()
    WHERE usuario_id = ${params.usuarioId}
      AND ano_laboral_id = ${params.anoLaboralId}
      AND tipo_ausencia = 'vacaciones'
  `);
}

/** Libera días desde pendiente (solicitud en curso). */
export async function liberarBalancePendiente(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: { usuarioId: number; anoLaboralId: number; dias: number }
): Promise<void> {
  const dias = Number(params.dias);
  if (dias <= 0) return;

  await tx.execute(sql`
    UPDATE balances SET
      cantidad_pendiente = GREATEST(0, cantidad_pendiente - ${dias}),
      cantidad_disponible = cantidad_disponible + ${dias},
      updated_at = NOW()
    WHERE usuario_id = ${params.usuarioId}
      AND ano_laboral_id = ${params.anoLaboralId}
      AND tipo_ausencia = 'vacaciones'
  `);
}

/** Libera días desde usada (solicitud ya confirmada por RRHH). */
export async function liberarBalanceUsada(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: { usuarioId: number; anoLaboralId: number; dias: number }
): Promise<void> {
  const dias = Number(params.dias);
  if (dias <= 0) return;

  await tx.execute(sql`
    UPDATE balances SET
      cantidad_usada = GREATEST(0, cantidad_usada - ${dias}),
      cantidad_disponible = cantidad_disponible + ${dias},
      updated_at = NOW()
    WHERE usuario_id = ${params.usuarioId}
      AND ano_laboral_id = ${params.anoLaboralId}
      AND tipo_ausencia = 'vacaciones'
  `);
}
