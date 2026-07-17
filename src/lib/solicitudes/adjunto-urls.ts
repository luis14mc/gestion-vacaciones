/** URLs same-origin para servir adjuntos de solicitudes (visor y descarga). */

export function urlAdjuntoContenido(solicitudId: number, indice: number): string {
  return `/api/solicitudes/${solicitudId}/adjuntos/${indice}/contenido`;
}

export function urlAdjuntoDescargar(solicitudId: number, indice: number): string {
  return `/api/solicitudes/${solicitudId}/adjuntos/${indice}/descargar`;
}

export function esUrlAdjuntoContenidoValida(
  solicitudId: number | undefined,
  indice: number
): boolean {
  return (
    typeof solicitudId === 'number' &&
    Number.isFinite(solicitudId) &&
    solicitudId > 0 &&
    Number.isFinite(indice) &&
    indice >= 0
  );
}
