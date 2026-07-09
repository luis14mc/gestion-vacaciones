/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormularioSolicitud from '@/components/FormularioSolicitud';

const TIPOS_AUSENCIA = [
  { id: '1', nombre: 'Vacaciones', tipo: 'vacaciones', activo: true, permiteHoras: false },
  { id: '2', nombre: 'Licencia médica', tipo: 'licencia_medica', activo: true, permiteHoras: false },
  { id: '3', nombre: 'Permiso de salida', tipo: 'permiso_salida', activo: true, permiteHoras: true },
];

vi.mock('@/hooks/useTiposAusencia', () => ({
  useTiposAusencia: () => ({ data: TIPOS_AUSENCIA, isLoading: false }),
}));

vi.mock('@/hooks/useBalances', () => ({
  useBalances: () => ({ data: [] }),
}));

vi.mock('@/hooks/useLaborDays', () => ({
  useLaborDays: () => ({ diasLaborables: 0 }),
}));

vi.mock('@/lib/swal', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Flujos por tipo. La forma nueva (Fase 3) incluye adjuntosRequeridos
// directamente, que es lo que el frontend itera para pintar los
// bloques de VoBo / Constancia.
const flujoDirector = {
  requiereVoBoMinistro: true,
  requiereAprobacionJefe: false,
  requiereAprobacionDirector: false,
  pasaDirectoRrhh: true,
  mensajeFlujo: 'Como Director, debe adjuntar el VoBo del Ministro.',
  pasosProceso: ['VoBo Ministro', 'RRHH', 'Notificación'],
  requiereVoBo: true,
  tipoVoBoRequerido: 'vobo_ministro',
  etiquetaVoBo: 'VoBo del Ministro',
  requiereConstanciaMedica: false,
  adjuntosRequeridos: [
    {
      tipo: 'vobo_ministro',
      etiqueta: 'VoBo del Ministro',
      mensajeFaltante: 'Debe adjuntar el VoBo del Ministro.',
      obligatorio: true,
      acepta: '.pdf,image/*',
    },
  ],
};

const flujoLicenciaDirector = {
  requiereVoBoMinistro: true,
  requiereAprobacionJefe: false,
  requiereAprobacionDirector: false,
  pasaDirectoRrhh: true,
  mensajeFlujo: 'Como Director, debe adjuntar el VoBo del Ministro.',
  pasosProceso: ['VoBo Ministro', 'RRHH', 'Notificación'],
  requiereVoBo: true,
  tipoVoBoRequerido: 'vobo_ministro',
  etiquetaVoBo: 'VoBo del Ministro',
  requiereConstanciaMedica: true,
  adjuntosRequeridos: [
    {
      tipo: 'vobo_ministro',
      etiqueta: 'VoBo del Ministro',
      mensajeFaltante: 'Debe adjuntar el VoBo del Ministro.',
      obligatorio: true,
      acepta: '.pdf,image/*',
    },
    {
      tipo: 'constancia_medica',
      etiqueta: 'Constancia médica',
      mensajeFaltante: 'Debe adjuntar la constancia médica.',
      obligatorio: true,
      acepta: '.pdf,image/*',
    },
  ],
};

const flujoEmpleadoSinAdjuntos = {
  requiereVoBoMinistro: false,
  requiereAprobacionJefe: true,
  requiereAprobacionDirector: false,
  pasaDirectoRrhh: false,
  mensajeFlujo: 'Su solicitud será enviada a su jefe inmediato.',
  pasosProceso: ['Jefe', 'Director', 'RRHH'],
  requiereVoBo: true,
  tipoVoBoRequerido: 'vobo_jefe',
  etiquetaVoBo: 'VoBo del Jefe inmediato',
  requiereConstanciaMedica: false,
  adjuntosRequeridos: [
    {
      tipo: 'vobo_jefe',
      etiqueta: 'VoBo del Jefe inmediato',
      mensajeFaltante: 'Debe adjuntar el VoBo del Jefe inmediato.',
      obligatorio: true,
      acepta: '.pdf,image/*',
    },
  ],
};

function mockFetchFlujo(flujoPorTipo: Record<string, object>) {
  vi.mocked(global.fetch).mockImplementation((input) => {
    const url = String(input);
    if (url.includes('flujo-aprobacion')) {
      const tipo = new URL(url, 'http://localhost').searchParams.get('tipo') ?? 'vacaciones';
      const flujo = flujoPorTipo[tipo] ?? flujoPorTipo.vacaciones;
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: flujo }),
      } as Response);
    }
    if (url.includes('cumpleanos-elegibilidad')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { puedeSolicitar: false } }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);
  });
}

function renderFormulario() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FormularioSolicitud usuarioId={1} />
    </QueryClientProvider>
  );
}

async function seleccionarTipo(nombre: string) {
  fireEvent.click(screen.getByRole('combobox'));
  await waitFor(() => {
    expect(screen.getByRole('option', { name: nombre })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('option', { name: nombre }));
}

describe('FormularioSolicitud — Fase 3 adjuntos dinámicos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it('Director en vacaciones pinta bloque "VoBo del Ministro"', async () => {
    mockFetchFlujo({ vacaciones: flujoDirector, licencia_medica: flujoLicenciaDirector });
    renderFormulario();

    await waitFor(() => {
      expect(screen.getAllByText(/VoBo del Ministro/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Adjuntos institucionales \(obligatorios\)/i)).toBeTruthy();
  });

  it('Director en licencia médica pinta VoBo + Constancia', async () => {
    mockFetchFlujo({ vacaciones: flujoDirector, licencia_medica: flujoLicenciaDirector });
    renderFormulario();

    await seleccionarTipo('Licencia médica');

    await waitFor(() => {
      expect(screen.getAllByText(/VoBo del Ministro/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Constancia médica/i).length).toBeGreaterThan(0);
    });
  });

  it('Empleado normal pinta VoBo del Jefe inmediato', async () => {
    mockFetchFlujo({ vacaciones: flujoEmpleadoSinAdjuntos });
    renderFormulario();

    await waitFor(() => {
      expect(screen.getAllByText(/VoBo del Jefe inmediato/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Constancia médica/i)).toBeNull();
  });

  it('No pinta bloque de adjuntos si el flujo no los requiere', async () => {
    mockFetchFlujo({
      vacaciones: { ...flujoEmpleadoSinAdjuntos, adjuntosRequeridos: [] },
    });
    renderFormulario();

    await waitFor(() => {
      expect(screen.queryByText(/Adjuntos institucionales/i)).toBeNull();
    });
  });
});