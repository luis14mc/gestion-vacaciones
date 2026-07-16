/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RechazoSolicitudResumen } from '@/components/solicitudes/RechazoSolicitudResumen';

describe('RechazoSolicitudResumen', () => {
  it('muestra motivo y nivel para rechazada_director', () => {
    render(
      <RechazoSolicitudResumen
        estado="rechazada_director"
        motivoRechazo="No hay cobertura en el área"
        rechazadaFecha="2026-07-10T15:00:00.000Z"
        rechazadaPorNombre="Ana Director"
      />
    );

    expect(screen.getByText('Solicitud rechazada')).toBeTruthy();
    expect(screen.getByText('Nivel: Director de Área')).toBeTruthy();
    expect(screen.getByText('No hay cobertura en el área')).toBeTruthy();
    expect(screen.getByText(/Rechazada por: Ana Director/)).toBeTruthy();
  });

  it('no renderiza nada si el estado no es rechazo', () => {
    const { container } = render(
      <RechazoSolicitudResumen estado="pendiente_rrhh" motivoRechazo={null} />
    );

    expect(container.firstChild).toBeNull();
  });
});
