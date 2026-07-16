/**
 * Metadata liviana de adjuntos para listados (sin base64 ni data URLs).
 */

export interface ResumenAdjuntosSolicitud {
  tieneAdjuntos: boolean;
  cantidadAdjuntos: number;
  tiposAdjuntos: string[];
  nombresAdjuntos: string[];
}

export function obtenerResumenAdjuntos(documentosAdjuntos: unknown): ResumenAdjuntosSolicitud {
  const adjuntos = Array.isArray(documentosAdjuntos) ? documentosAdjuntos : [];

  const tiposAdjuntos = adjuntos
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const adj = a as { tipo?: string; nombre?: string };
      return adj.tipo || adj.nombre || 'adjunto';
    })
    .filter((t): t is string => Boolean(t));

  const nombresAdjuntos = adjuntos
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const nombre = (a as { nombre?: string }).nombre;
      return typeof nombre === 'string' && nombre.length > 0 ? nombre : null;
    })
    .filter((n): n is string => Boolean(n));

  return {
    tieneAdjuntos: adjuntos.length > 0,
    cantidadAdjuntos: adjuntos.length,
    tiposAdjuntos,
    nombresAdjuntos,
  };
}

/** True si algún adjunto en el payload incluye contenido embebido (data/base64). */
export function adjuntosIncluyenContenido(documentosAdjuntos: unknown): boolean {
  if (!Array.isArray(documentosAdjuntos)) return false;
  return documentosAdjuntos.some((a) => {
    if (!a || typeof a !== 'object') return false;
    const data = (a as { data?: unknown }).data;
    return typeof data === 'string' && data.length > 0;
  });
}
