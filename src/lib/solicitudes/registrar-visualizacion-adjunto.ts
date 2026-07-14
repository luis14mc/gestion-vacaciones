/**
 * Registra en auditoría que un usuario abrió/descargó un adjunto institucional.
 * No bloquea al usuario si falla la petición.
 */
export async function registrarVisualizacionAdjunto(
  solicitudId: number,
  idx: number
): Promise<void> {
  try {
    await fetch(`/api/solicitudes/${solicitudId}/adjuntos/${idx}/ver`, {
      method: 'POST',
    });
  } catch (error) {
    console.warn('No se pudo registrar visualización de adjunto', error);
  }
}
