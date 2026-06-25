/**
 * Política de expiración de contraseña (seguridad.forzar_cambio_password_dias).
 */

export function passwordExpirada(
  metadata: Record<string, unknown> | null | undefined,
  diasForzar: number
): boolean {
  if (diasForzar <= 0) return false;

  const changedAt = metadata?.passwordChangedAt;
  if (typeof changedAt !== 'string' || !changedAt) {
    return true;
  }

  const cambioMs = new Date(changedAt).getTime();
  if (Number.isNaN(cambioMs)) return true;

  const limiteMs = diasForzar * 24 * 60 * 60 * 1000;
  return Date.now() - cambioMs >= limiteMs;
}

export function metadataConPasswordActualizada(
  metadata: Record<string, unknown>,
  opts?: { quitarDebeCambiar?: boolean }
): Record<string, unknown> {
  const base = opts?.quitarDebeCambiar
    ? (({ debeCambiarPassword: _omit, ...rest }) => rest)(metadata)
    : { ...metadata };

  return {
    ...base,
    passwordChangedAt: new Date().toISOString(),
  };
}
