/**
 * Alcance de equipo para métricas de jefe/director.
 *
 * 1. Subordinados directos por jefeSuperiorId (mismo criterio que aprobar solicitudes).
 * 2. Fallback solo Director: si no hay subordinados, usuarios del departamento (sin duplicar).
 */
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { and, eq, isNull, ne } from 'drizzle-orm';

export async function resolverIdsEquipo(input: {
  jefeId: number;
  esDirector: boolean;
  departamentoId?: number | null;
}): Promise<number[]> {
  const subordinados = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.jefeSuperiorId, input.jefeId), isNull(usuarios.deletedAt)));

  if (subordinados.length > 0) {
    return subordinados.map((u) => u.id);
  }

  if (input.esDirector && input.departamentoId) {
    const delDepartamento = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.departamentoId, input.departamentoId),
          ne(usuarios.id, input.jefeId),
          isNull(usuarios.deletedAt)
        )
      );
    return delDepartamento.map((u) => u.id);
  }

  return [];
}
