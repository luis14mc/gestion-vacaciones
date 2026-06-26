import type { SessionUser } from '@/types';
import { resolverIdsEquipo } from '@/lib/domain/equipo-jefe';

export interface ReportScope {
  /** null = sin filtro por usuario (alcance org/depto). [] = sin acceso a datos. */
  usuarioIds: number[] | null;
  departamentoId: number | null;
  vacio: boolean;
}

export async function resolverAlcanceReportes(
  session: SessionUser,
  filtros: { departamentoId: number | null; usuarioId: number | null }
): Promise<ReportScope> {
  const esGlobal = session.esAdmin || session.esRrhh;

  if (esGlobal) {
    return {
      usuarioIds: filtros.usuarioId ? [filtros.usuarioId] : null,
      departamentoId: filtros.departamentoId,
      vacio: false,
    };
  }

  if (session.esJefe || session.esDirector) {
    const equipoIds = await resolverIdsEquipo({
      jefeId: session.id,
      esDirector: session.esDirector,
      departamentoId: session.departamentoId,
    });

    if (equipoIds.length === 0) {
      return { usuarioIds: [], departamentoId: null, vacio: true };
    }

    if (filtros.usuarioId) {
      if (!equipoIds.includes(filtros.usuarioId)) {
        return { usuarioIds: [], departamentoId: null, vacio: true };
      }
      return { usuarioIds: [filtros.usuarioId], departamentoId: null, vacio: false };
    }

    return { usuarioIds: equipoIds, departamentoId: null, vacio: false };
  }

  return { usuarioIds: [], departamentoId: null, vacio: true };
}
