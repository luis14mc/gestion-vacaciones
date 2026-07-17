'use client';

import { useMemo } from 'react';
import { contarDiasHabiles } from '@/lib/domain/labor-days';

/**
 * Días laborables inclusivos para el formulario de solicitud.
 * Reutiliza la misma función autoritativa del backend (`contarDiasHabiles`)
 * para que el valor mostrado coincida con el guardado en historial.
 */
export function useLaborDays(fechaInicio?: string, fechaFin?: string) {
  const diasLaborables = useMemo(() => {
    if (!fechaInicio || !fechaFin) return 0;
    return contarDiasHabiles(fechaInicio, fechaFin);
  }, [fechaInicio, fechaFin]);

  return { diasLaborables };
}
