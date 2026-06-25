/**
 * Validación de conflictos de fechas por departamento según configuración admin.
 */

import { db } from '@/lib/db';
import { solicitudes, usuarios } from '@/lib/db/schema';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { obtenerConfigs, asBool, asNumber } from '@/lib/config/service';

const ESTADOS_OCUPAN_CALENDARIO = [
  'pendiente_jefe',
  'aprobada_jefe',
  'aprobada_rrhh',
  'finalizada',
] as const;

type DbOrTx = typeof db;

export async function validarConflictosDepartamento(
  params: {
    usuarioId: number;
    departamentoId: number | null;
    fechaInicio: string;
    fechaFin: string;
    excluirSolicitudId?: number;
  },
  tx: DbOrTx = db
): Promise<void> {
  if (!params.departamentoId) return;

  const configs = await obtenerConfigs([
    'departamentos.validar_conflictos',
    'departamentos.max_ausencias_simultaneas',
  ]);

  const validarConflictos = asBool(configs['departamentos.validar_conflictos']);
  const maxSimultaneas = asNumber(configs['departamentos.max_ausencias_simultaneas'], 0);

  if (!validarConflictos && maxSimultaneas <= 0) return;

  const overlapCondition = sql`
    ${solicitudes.fechaInicio} <= ${params.fechaFin}
    AND ${solicitudes.fechaFin} >= ${params.fechaInicio}
  `;

  const condicionesBase = [
    isNull(solicitudes.deletedAt),
    inArray(solicitudes.estado, [...ESTADOS_OCUPAN_CALENDARIO]),
    overlapCondition,
  ];

  if (params.excluirSolicitudId != null) {
    condicionesBase.push(ne(solicitudes.id, params.excluirSolicitudId));
  }

  if (validarConflictos) {
    const [conflictoPropio] = await tx
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(and(eq(solicitudes.usuarioId, params.usuarioId), ...condicionesBase))
      .limit(1);

    if (conflictoPropio) {
      throw new Error(
        'Ya tiene una solicitud activa que se superpone con las fechas seleccionadas.'
      );
    }
  }

  if (maxSimultaneas > 0) {
    const [resultado] = await tx
      .select({ total: sql<number>`count(distinct ${solicitudes.usuarioId})::int` })
      .from(solicitudes)
      .innerJoin(usuarios, eq(usuarios.id, solicitudes.usuarioId))
      .where(
        and(
          eq(usuarios.departamentoId, params.departamentoId),
          eq(usuarios.activo, true),
          ...condicionesBase
        )
      );

    const total = resultado?.total ?? 0;
    if (total >= maxSimultaneas) {
      throw new Error(
        `El departamento ya alcanzó el máximo de ${maxSimultaneas} ausencia(s) simultánea(s) en esas fechas.`
      );
    }
  }
}
