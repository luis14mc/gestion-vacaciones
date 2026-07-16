'use client';

import { useEffect, useState } from 'react';

export interface SolicitudDetalleAdjuntos {
  documentosAdjuntos?: unknown;
  puedeVerAdjuntos?: boolean;
}

export function useSolicitudDetalle(solicitudId: number | null, enabled: boolean) {
  const [detalle, setDetalle] = useState<SolicitudDetalleAdjuntos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !solicitudId) {
      setDetalle(null);
      setError(null);
      return;
    }

    let cancelado = false;
    setCargando(true);
    setError(null);

    fetch(`/api/solicitudes/${solicitudId}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'No se pudo cargar la solicitud');
        }
        if (!cancelado) {
          setDetalle(json.data as SolicitudDetalleAdjuntos);
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setDetalle(null);
          setError(err instanceof Error ? err.message : 'Error al cargar');
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [solicitudId, enabled]);

  return { detalle, cargando, error };
}
