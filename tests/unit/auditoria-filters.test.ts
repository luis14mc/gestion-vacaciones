import { describe, expect, it } from 'vitest';
import { parseFiltrosAuditoria } from '@/lib/domain/auditoria/filters';

describe('auditoria filters', () => {
  it('parsea paginación y filtros avanzados', () => {
    const params = new URLSearchParams({
      pagina: '2',
      limite: '25',
      q: 'login',
      accion: 'login_fallido',
      tabla: 'usuarios',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-30',
      email: 'admin@cni.hn',
      ipAddress: '10.0',
      registroId: '99',
      evento: 'exportar_reporte',
      modulo: 'reportes',
    });

    const filtros = parseFiltrosAuditoria(params);
    expect(filtros.pagina).toBe(2);
    expect(filtros.limite).toBe(25);
    expect(filtros.q).toBe('login');
    expect(filtros.accion).toBe('login_fallido');
    expect(filtros.registroId).toBe(99);
    expect(filtros.evento).toBe('exportar_reporte');
  });

  it('limita limite máximo a 200', () => {
    const filtros = parseFiltrosAuditoria(new URLSearchParams({ limite: '999' }));
    expect(filtros.limite).toBe(200);
  });
});
