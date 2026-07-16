/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BalanceVacacionesClient from '@/app/rrhh/balances/BalanceVacacionesClient';

const resumen = {
  totalColaboradores: 2,
  totalActivos: 2,
  totalConAsignacionMesActual: 1,
  totalPendientesAsignacionMesActual: 1,
  totalConInconsistencias: 0,
};

const fila = {
  usuarioId: 10,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@cni.hn',
  departamento: 'RRHH',
  cargo: 'Analista',
  fechaIngreso: '2020-01-01',
  activo: true,
  antiguedad: { anios: 6, meses: 0, dias: 0, texto: '6 años' },
  reglaVacaciones: { diasAnualesAplicables: 20, diasMensualesAplicables: 1.6667 },
  balance: {
    diasVencidos: 10,
    diasProporcionales: 5,
    diasAsignados: 15,
    diasUsados: 3,
    diasPendientes: 2,
    diasDisponibles: 10,
  },
  asignacionMensual: {
    ultimoMesAsignado: 7,
    ultimoAnioAsignado: 2026,
    diasUltimaAsignacion: 1.6667,
    fechaUltimaAsignacion: '2026-07-01T07:00:00Z',
    estadoMesActual: 'asignado' as const,
  },
  validacion: { consistente: true, diferencia: 0, mensaje: null },
};

describe('BalanceVacacionesClient — UI RRHH', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/departamentos')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [{ id: 1, nombre: 'RRHH' }] }),
        } as Response;
      }
      if (url.includes('/api/rrhh/balances-vacaciones')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [fila],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            resumen,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ success: true }) } as Response;
    });
  });

  it('RRHH ve cards resumen y tabla de balances', async () => {
    render(<BalanceVacacionesClient />);
    expect(screen.getByRole('heading', { name: /control de vacaciones/i })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Colaboradores activos')).toBeTruthy();
      expect(screen.getByText('Asignados este mes')).toBeTruthy();
      expect(screen.getByText('Pendientes de asignación')).toBeTruthy();
      expect(screen.getByText('Inconsistencias')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeTruthy();
      expect(screen.getByText('ana@cni.hn')).toBeTruthy();
    });
  });

  it('muestra botón ejecutar asignación mensual', async () => {
    render(<BalanceVacacionesClient />);
    expect(
      screen.getByRole('button', { name: /ejecutar asignación mensual/i })
    ).toBeTruthy();
  });

  it('muestra estado vacío cuando no hay filas', async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/departamentos')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          resumen: {
            totalColaboradores: 0,
            totalActivos: 0,
            totalConAsignacionMesActual: 0,
            totalPendientesAsignacionMesActual: 0,
            totalConInconsistencias: 0,
          },
        }),
      } as Response;
    });

    render(<BalanceVacacionesClient />);
    await waitFor(() => {
      expect(
        screen.getByText(/sin colaboradores para los filtros seleccionados/i)
      ).toBeTruthy();
    });
  });
});
