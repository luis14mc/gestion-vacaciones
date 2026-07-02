/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginClient from '@/app/login/LoginClient';
import DashboardClient from '@/app/dashboard/DashboardClient';
import NuevaSolicitudClient from '@/app/solicitudes/nueva/NuevaSolicitudClient';
import AprobarSolicitudesClient from '@/app/aprobar-solicitudes/AprobarSolicitudesClient';
import ConfiguracionClient from '@/app/configuracion/ConfiguracionClient';

const mockSession = {
  user: {
    id: 1,
    email: 'test@cni.hn',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 3600_000).toISOString(),
  id: 1,
  nombre: 'Test',
  apellido: 'User',
  departamentoId: 1,
  permisos: ['solicitudes.crear'],
  roles: [{ id: 1, codigo: 'EMPLEADO', nombre: 'Empleado' }],
  esAdmin: false,
  esRrhh: false,
  esDirector: false,
  esJefe: false,
} as any;

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe('Smoke tests — pantallas críticas', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], usuarios: [], solicitudes: [] }),
    } as Response);
  });

  it('LoginClient muestra el formulario de acceso', () => {
    render(<LoginClient />);
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('DashboardClient renderiza el encabezado', () => {
    render(<DashboardClient session={mockSession} />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeTruthy();
  });

  it('NuevaSolicitudClient renderiza el formulario', () => {
    renderWithQuery(<NuevaSolicitudClient session={mockSession} />);
    expect(screen.getByRole('heading', { name: /nueva solicitud/i })).toBeTruthy();
  });

  it('AprobarSolicitudesClient renderiza la bandeja', () => {
    render(<AprobarSolicitudesClient session={mockSession} />);
    expect(screen.getByRole('heading', { name: /aprobar solicitudes/i })).toBeTruthy();
  });

  it('ConfiguracionClient renderiza la página de ajustes', () => {
    render(<ConfiguracionClient session={mockSession} />);
    expect(screen.getByRole('heading', { name: /configuración del sistema/i })).toBeTruthy();
  });
});
