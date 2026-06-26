import { describe, expect, it } from 'vitest';
import { parseFiltrosReporte, esTipoReporteValido } from '@/lib/domain/reportes/filters';

describe('reportes filters', () => {
  it('parsea tipo, fechas, departamento, estado y tipo solicitud', () => {
    const params = new URLSearchParams({
      tipo: 'solicitudes',
      anio: '2026',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-30',
      departamentoId: '3',
      tipoSolicitud: 'vacaciones',
      estado: 'aprobada_rrhh',
    });

    const filtros = parseFiltrosReporte(params);
    expect(filtros.tipo).toBe('solicitudes');
    expect(filtros.anio).toBe(2026);
    expect(filtros.departamentoId).toBe(3);
    expect(filtros.tipoSolicitud).toBe('vacaciones');
    expect(filtros.estado).toBe('aprobada_rrhh');
  });

  it('rechaza tipos inválidos con fallback balances', () => {
    expect(esTipoReporteValido('proyecciones')).toBe(false);
    const filtros = parseFiltrosReporte(new URLSearchParams({ tipo: 'proyecciones' }));
    expect(filtros.tipo).toBe('balances');
  });

  it('acepta nuevos tipos CNI', () => {
    expect(esTipoReporteValido('cierre_ano')).toBe(true);
    expect(esTipoReporteValido('cumpleanos')).toBe(true);
    expect(esTipoReporteValido('permisos_salida')).toBe(true);
  });
});
