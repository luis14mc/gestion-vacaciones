import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';

export function extraerIdsUploadersDeSolicitudes(
  solicitudesConAdjuntos: Array<{ documentosAdjuntos?: unknown }>
): number[] {
  const ids = new Set<number>();
  for (const sol of solicitudesConAdjuntos) {
    if (!Array.isArray(sol.documentosAdjuntos)) continue;
    for (const adj of sol.documentosAdjuntos) {
      if (
        adj &&
        typeof adj === 'object' &&
        typeof (adj as { uploadedBy?: unknown }).uploadedBy === 'number'
      ) {
        ids.add((adj as { uploadedBy: number }).uploadedBy);
      }
    }
  }
  return [...ids];
}

export async function cargarNombresUsuariosPorIds(
  ids: number[]
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
    })
    .from(usuarios)
    .where(inArray(usuarios.id, ids));

  return new Map(
    rows.map((row) => [row.id, `${row.nombre} ${row.apellido}`.trim()])
  );
}

export function enriquecerAdjuntosConNombresSubidor(
  documentosAdjuntos: unknown,
  nombresPorId: Map<number, string>
): unknown {
  if (!Array.isArray(documentosAdjuntos)) return documentosAdjuntos;

  return documentosAdjuntos.map((adj) => {
    if (!adj || typeof adj !== 'object') return adj;
    const uploadedBy = (adj as { uploadedBy?: unknown }).uploadedBy;
    if (typeof uploadedBy !== 'number') return adj;

    const uploadedByNombre = nombresPorId.get(uploadedBy);
    if (!uploadedByNombre) return adj;

    return { ...adj, uploadedByNombre };
  });
}

export async function enriquecerAdjuntosSolicitudes<T extends { documentosAdjuntos?: unknown }>(
  solicitudesLista: T[]
): Promise<T[]> {
  if (solicitudesLista.length === 0) return solicitudesLista;

  const ids = extraerIdsUploadersDeSolicitudes(solicitudesLista);
  const nombresPorId = await cargarNombresUsuariosPorIds(ids);

  if (nombresPorId.size === 0) return solicitudesLista;

  return solicitudesLista.map((sol) => ({
    ...sol,
    documentosAdjuntos: enriquecerAdjuntosConNombresSubidor(
      sol.documentosAdjuntos,
      nombresPorId
    ),
  }));
}
