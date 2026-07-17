/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdjuntosViewer } from '@/components/solicitudes/AdjuntosViewer';

const PDF_DATA =
  'data:application/pdf;base64,JVBERi0xLjQK';

describe('AdjuntosViewer', () => {
  it('muestra adjuntos VoBo cuando hay data', () => {
    render(
      <AdjuntosViewer
        autorizado
        adjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo_jefe.pdf',
            data: PDF_DATA,
            indiceOriginal: 0,
          },
        ]}
      />
    );

    expect(screen.getByText('VoBo del Jefe inmediato')).toBeTruthy();
    expect(screen.getByText('vobo_jefe.pdf')).toBeTruthy();
  });

  it('muestra mensaje cuando no hay adjuntos', () => {
    render(<AdjuntosViewer autorizado adjuntos={[]} />);
    expect(screen.getByText('Sin adjunto registrado.')).toBeTruthy();
  });

  it('muestra mensaje de no autorizado', () => {
    render(
      <AdjuntosViewer
        autorizado={false}
        adjuntos={[{ tipo: 'vobo_jefe', data: PDF_DATA, nombre: 'x.pdf' }]}
      />
    );
    expect(
      screen.getByText(/No tiene permisos para visualizar los adjuntos/i)
    ).toBeTruthy();
  });

  it('muestra nombre del usuario que subió el adjunto', () => {
    render(
      <AdjuntosViewer
        autorizado
        adjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo.pdf',
            data: PDF_DATA,
            uploadedBy: 5,
            uploadedByNombre: 'Ana López',
          },
        ]}
      />
    );
    expect(screen.getByText('Subido por: Ana López')).toBeTruthy();
  });

  it('muestra ID cuando no hay nombre del uploader', () => {
    render(
      <AdjuntosViewer
        autorizado
        adjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo.pdf',
            data: PDF_DATA,
            uploadedBy: 5,
          },
        ]}
      />
    );
    expect(screen.getByText('Subido por usuario ID: 5')).toBeTruthy();
  });

  it('invoca callback con índice original al visualizar', () => {
    const onVisualizar = vi.fn();
    render(
      <AdjuntosViewer
        autorizado
        adjuntos={[
          {
            tipo: 'vobo_director',
            nombre: 'vobo.pdf',
            data: PDF_DATA,
            indiceOriginal: 2,
          },
        ]}
        onAdjuntoVisualizado={onVisualizar}
      />
    );

    fireEvent.click(screen.getByTitle('Visualizar'));
    expect(onVisualizar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'vobo_director' }),
      2
    );
  });

  it('usa URL same-origin de contenido para previsualizar PDF', () => {
    render(
      <AdjuntosViewer
        autorizado
        solicitudId={42}
        adjuntos={[
          {
            tipo: 'vobo_jefe',
            nombre: 'vobo.pdf',
            data: PDF_DATA,
            indiceOriginal: 0,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByTitle('Visualizar'));
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toBe(
      '/api/solicitudes/42/adjuntos/0/contenido'
    );
  });
});
