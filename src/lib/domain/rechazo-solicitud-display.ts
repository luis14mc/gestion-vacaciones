import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { nivelRechazoDesdeEstado } from '@/lib/domain/rechazo-solicitud';

export interface CamposRechazoSolicitud {
  estado: string;
  motivoRechazo?: string | null;
  rechazadaPor?: number | null;
  rechazadaFecha?: string | null;
}

export interface RechazoSolicitudDisplay {
  motivoRechazo: string | null;
  rechazadaPor: number | null;
  rechazadaFecha: string | null;
  nivelRechazo: string | null;
  rechazadaPorNombre: string | null;
}

export function mapRechazoDisplay(
  sol: CamposRechazoSolicitud,
  nombresPorId?: Map<number, string>
): RechazoSolicitudDisplay {
  const rechazadaPor =
    typeof sol.rechazadaPor === 'number' ? sol.rechazadaPor : null;

  return {
    motivoRechazo: sol.motivoRechazo ?? null,
    rechazadaPor,
    rechazadaFecha: sol.rechazadaFecha ?? null,
    nivelRechazo: nivelRechazoDesdeEstado(sol.estado),
    rechazadaPorNombre:
      rechazadaPor != null ? (nombresPorId?.get(rechazadaPor) ?? null) : null,
  };
}

export async function enriquecerRechazoSolicitudes<
  T extends CamposRechazoSolicitud,
>(lista: T[]): Promise<Array<T & RechazoSolicitudDisplay>> {
  if (lista.length === 0) return [];

  const ids = new Set<number>();
  for (const sol of lista) {
    if (typeof sol.rechazadaPor === 'number') ids.add(sol.rechazadaPor);
  }

  const nombresPorId = new Map<number, string>();
  if (ids.size > 0) {
    const rows = await db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
      })
      .from(usuarios)
      .where(inArray(usuarios.id, [...ids]));

    for (const row of rows) {
      nombresPorId.set(row.id, `${row.nombre} ${row.apellido}`.trim());
    }
  }

  return lista.map((sol) => ({
    ...sol,
    ...mapRechazoDisplay(sol, nombresPorId),
  }));
}
