'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import type { AccionSolicitud } from '@/lib/domain/state-machine';

interface UseSolicitudActionsOptions {
  onSuccess?: () => void;
}

/**
 * Hook para ejecutar acciones del workflow sobre solicitudes.
 * Integra la API de acciones con el sistema de toast.
 */
export function useSolicitudActions(opts?: UseSolicitudActionsOptions) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const ejecutar = useCallback(
    async (
      solicitudId: number,
      accion: AccionSolicitud,
      payload?: {
        comentario?: string;
        motivoRechazo?: string;
        motivoCancelacion?: string;
      }
    ) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/solicitudes/${solicitudId}/accion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion, ...payload }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          toast.error(data.error || 'Error al ejecutar la acción');
          return null;
        }

        const messages: Partial<Record<AccionSolicitud, string>> = {
          aprobar_jefe: 'Solicitud aprobada por jefe',
          aprobar_rrhh: 'Solicitud aprobada por RRHH',
          aprobar_ejecutiva: 'Solicitud autorizada',
          rechazar_jefe: 'Solicitud rechazada',
          rechazar_rrhh: 'Solicitud rechazada por RRHH',
          rechazar_ejecutiva: 'Solicitud rechazada por ejecutiva',
          cancelar: 'Solicitud cancelada',
          enviar: 'Solicitud enviada',
        };

        toast.success(messages[accion] || 'Acción ejecutada correctamente');
        opts?.onSuccess?.();
        return data;
      } catch (err) {
        toast.error('Error de conexión al servidor');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast, opts]
  );

  const obtenerAcciones = useCallback(async (solicitudId: number): Promise<AccionSolicitud[]> => {
    try {
      const res = await fetch(`/api/solicitudes/${solicitudId}/accion`);
      const data = await res.json();
      return data.success ? data.data : [];
    } catch {
      return [];
    }
  }, []);

  return { ejecutar, obtenerAcciones, loading };
}
