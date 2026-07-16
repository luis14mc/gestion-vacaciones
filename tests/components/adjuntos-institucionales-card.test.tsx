/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdjuntosInstitucionalesCard } from '@/components/solicitudes/AdjuntosInstitucionalesCard';

const PDF_DATA = 'data:application/pdf;base64,JVBERi0xLjQK';

vi.mock('@/lib/solicitudes/registrar-visualizacion-adjunto', () => ({
  registrarVisualizacionAdjunto: vi.fn().mockResolvedValue(undefined),
}));

import { registrarVisualizacionAdjunto } from '@/lib/solicitudes/registrar-visualizacion-adjunto';

describe('AdjuntosInstitucionalesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra adjuntos VoBo en detalle de solicitud aprobada_rrhh', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={100}
        autorizado
        documentosAdjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo_jefe.pdf',
            data: PDF_DATA,
          },
        ]}
      />
    );

    expect(screen.getByText('Adjuntos institucionales')).toBeTruthy();
    expect(screen.getByText('VoBo del Jefe inmediato')).toBeTruthy();
  });

  it('muestra adjuntos en solicitud rechazada_jefe', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={101}
        autorizado
        documentosAdjuntos={[
          {
            tipo: 'vobo_director',
            nombre: 'rechazo.pdf',
            data: PDF_DATA,
          },
        ]}
      />
    );

    expect(screen.getByText('VoBo del Director de Área')).toBeTruthy();
  });

  it('muestra mensaje para solicitud antigua sin adjuntos', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={102}
        autorizado
        documentosAdjuntos={null}
      />
    );

    expect(screen.getByText('Sin adjunto registrado.')).toBeTruthy();
  });

  it('muestra adjuntos para usuario que subió el VoBo', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={103}
        autorizado
        documentosAdjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo.pdf',
            data: PDF_DATA,
            uploadedBy: 30,
            uploadedByNombre: 'Jefe Inmediato',
          },
        ]}
      />
    );

    expect(screen.getByText('Subido por: Jefe Inmediato')).toBeTruthy();
  });

  it('calcula autorización con session y accesoSolicitud', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={104}
        session={{
          id: 10,
          esAdmin: false,
          esRrhh: false,
          esJefe: false,
          esDirector: false,
          esSecretarioGeneral: false,
        }}
        accesoSolicitud={{ usuarioId: 10 }}
        documentosAdjuntos={[
          { tipo: 'vobo_jefe', nombre: 'vobo.pdf', data: PDF_DATA },
        ]}
      />
    );

    expect(screen.getByText('VoBo del Jefe inmediato')).toBeTruthy();
  });

  it('registra auditoría al visualizar adjunto', () => {
    render(
      <AdjuntosInstitucionalesCard
        solicitudId={42}
        autorizado
        documentosAdjuntos={[
          { tipo: 'vobo_jefe', nombre: 'vobo.pdf', data: PDF_DATA },
        ]}
      />
    );

    fireEvent.click(screen.getByTitle('Visualizar'));

    expect(registrarVisualizacionAdjunto).toHaveBeenCalledWith(42, 0);
  });
});
