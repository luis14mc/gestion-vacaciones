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

const flujoJefeDirAdmin = {
  requiereVoBoMinistro: false,
  requiereAprobacionJefe: false,
  requiereAprobacionDirector: false,
  pasaDirectoRrhh: true,
  flujoEspecial: 'jefe_direccion_administrativa_sin_director',
  mensajeFlujo:
    'Esta solicitud será derivada directamente a Recursos Humanos por excepción temporal: Jefatura de Dirección Administrativa sin Director asignado.',
  pasosProceso: [
    'Derivación directa a Recursos Humanos por excepción temporal',
    'Revisión y aprobación de Recursos Humanos',
    'Notificación al solicitante',
  ],
};

const flujoDirector = {
  requiereVoBoMinistro: true,
  requiereAprobacionJefe: false,
  requiereAprobacionDirector: false,
  pasaDirectoRrhh: false,
  mensajeFlujo: 'Como Director, debe adjuntar el VoBo del Ministro.',
  pasosProceso: [
    'VoBo Ministro (Mediante documento adjunto)',
    'Revisión y validación de Recursos Humanos',
    'Notificación al solicitante',
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

describe('FormularioSolicitud — flujo de aprobación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('Jefe de Dirección Administrativa no ve VoBo Ministro', async () => {
    mockFetchFlujo({ vacaciones: flujoJefeDirAdmin, licencia_medica: flujoJefeDirAdmin });
    renderFormulario();

    await waitFor(() => {
      expect(screen.queryByText(/VoBo del Ministro/i)).toBeNull();
    });
    expect(
      screen.getByText(/Derivación directa a Recursos Humanos por excepción temporal/i)
    ).toBeTruthy();
    expect(screen.getByText(/Jefatura de Dirección Administrativa sin Director asignado/i)).toBeTruthy();
  });

  it('Director normal sí ve VoBo Ministro', async () => {
    mockFetchFlujo({ vacaciones: flujoDirector, licencia_medica: flujoDirector });
    renderFormulario();

    await waitFor(() => {
      expect(screen.getByText(/VoBo del Ministro \(Obligatorio\)/i)).toBeTruthy();
    });
  });

  it('Licencia médica siempre pide constancia médica', async () => {
    mockFetchFlujo({ vacaciones: flujoJefeDirAdmin, licencia_medica: flujoJefeDirAdmin });
    renderFormulario();

    await waitFor(() => {
      expect(screen.queryByText(/VoBo del Ministro/i)).toBeNull();
    });

    await seleccionarTipo('Licencia médica');

    await waitFor(() => {
      expect(screen.getByText(/Constancia Médica \(Obligatorio\)/i)).toBeTruthy();
    });
    expect(screen.queryByText(/VoBo del Ministro/i)).toBeNull();
  });

  it('Texto de proceso para jefe de Dirección Administrativa muestra derivación directa a RRHH', async () => {
    mockFetchFlujo({ vacaciones: flujoJefeDirAdmin });
    renderFormulario();

    await waitFor(() => {
      expect(screen.getByText(/Proceso de aprobación:/i)).toBeTruthy();
      expect(
        screen.getByText(/Derivación directa a Recursos Humanos por excepción temporal/i)
      ).toBeTruthy();
      expect(screen.getByText(/Revisión y aprobación de Recursos Humanos/i)).toBeTruthy();
    });
  });
});
