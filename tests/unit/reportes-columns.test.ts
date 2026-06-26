import { describe, expect, it } from 'vitest';
import { COLUMNAS_REPORTE, filasACsv } from '@/lib/domain/reportes/columns';

describe('reportes columns', () => {
  it('balance usa columnas vencidos/proporcionales/usados/pendientes/disponibles', () => {
    const keys = COLUMNAS_REPORTE.balances.map((c) => c.key);
    expect(keys).toContain('dias_vencidos');
    expect(keys).toContain('dias_proporcionales');
    expect(keys).toContain('dias_usados');
    expect(keys).toContain('dias_pendientes');
    expect(keys).toContain('dias_disponibles');
    expect(keys).not.toContain('asignados');
  });

  it('csv incluye encabezados alineados con pantalla', () => {
    const csv = filasACsv(
      [{ colaborador: 'Ana Pérez', dias_vencidos: 12 }],
      COLUMNAS_REPORTE.balances.slice(0, 2)
    );
    expect(csv.split('\n')[0]).toContain('Colaborador');
    expect(csv.split('\n')[0]).toContain('Email');
    expect(csv.split('\n')[1]).toContain('Ana Pérez');
  });

  it('solicitudes incluye tipos, email y aprobadores', () => {
    const keys = COLUMNAS_REPORTE.solicitudes.map((c) => c.key);
    expect(keys).toContain('tipo_solicitud');
    expect(keys).toContain('email');
    expect(keys).toContain('duracion_permiso');
    expect(keys).toContain('jefe_aprobador');
    expect(keys).toContain('rrhh_aprobador');
    expect(keys).toContain('observaciones');
  });

  it('departamentos incluye codigo y totales CNI', () => {
    const keys = COLUMNAS_REPORTE.departamentos.map((c) => c.key);
    expect(keys).toContain('codigo');
    expect(keys).toContain('total_vencidos');
    expect(keys).toContain('total_proporcionales');
  });
});
