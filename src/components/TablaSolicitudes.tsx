'use client';

import { useState, useEffect } from 'react';
import type { SolicitudCompleta } from '@/types';

interface TablaSolicitudesProps {
  usuarioId?: number; // Si se proporciona, filtra por usuario
  esJefe?: boolean;
  esRrhh?: boolean;
  onAprobar?: (solicitud: SolicitudCompleta) => void;
}

const estadoColors: Record<string, string> = {
  borrador: 'badge-ghost',
  pendiente: 'badge-warning',
  aprobada_jefe: 'badge-info',
  aprobada: 'badge-success',
  rechazada: 'badge-error',
  cancelada: 'badge-neutral',
  en_uso: 'badge-primary'
};

const estadoTextos: Record<string, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobada_jefe: 'Aprobada por Jefe',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  en_uso: 'En Uso'
};

export default function TablaSolicitudes({ usuarioId, esJefe, esRrhh, onAprobar }: TablaSolicitudesProps) {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20'
      });

      if (usuarioId) params.append('usuarioId', usuarioId.toString());
      if (filtroEstado) params.append('estado', filtroEstado);

      const response = await fetch(`/api/solicitudes?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSolicitudes(data.data);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [page, filtroEstado, usuarioId]);

  const handleAprobar = async (solicitud: any, accion: 'aprobar_jefe' | 'aprobar_rrhh' | 'rechazar') => {
    if (!confirm(`¿Está seguro de ${accion === 'rechazar' ? 'rechazar' : 'aprobar'} esta solicitud?`)) {
      return;
    }

    let usuarioActualId = 1; // TODO: Obtener del contexto/sesión
    let motivo = '';

    if (accion === 'rechazar') {
      motivo = prompt('Motivo del rechazo:') || '';
      if (!motivo) return;
    }

    try {
      const response = await fetch('/api/solicitudes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitudId: solicitud.id,
          accion,
          usuarioId: usuarioActualId,
          motivo
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        cargarSolicitudes(); // Recargar lista
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar solicitud');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg shadow-lg p-6">
      {/* Filtros */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-base-content">
          {usuarioId ? 'Mis Solicitudes' : 'Todas las Solicitudes'}
        </h2>
        <select
          className="select select-bordered"
          value={filtroEstado}
          onChange={(e) => {
            setFiltroEstado(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada_jefe">Aprobada por Jefe</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Código</th>
              <th>Empleado</th>
              <th>Tipo</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
              <th>Días/Horas</th>
              <th>Estado</th>
              {(esJefe || esRrhh) && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {solicitudes.length === 0 ? (
              <tr>
                <td colSpan={esJefe || esRrhh ? 8 : 7} className="text-center py-8 text-base-content/60">
                  No se encontraron solicitudes
                </td>
              </tr>
            ) : (
              solicitudes.map((solicitud) => (
                <tr key={solicitud.id} className="hover">
                  <td>
                    <span className="font-mono text-sm">{solicitud.codigo || 'N/A'}</span>
                  </td>
                  <td>
                    <div>
                      <div className="font-semibold">
                        {solicitud.usuario?.nombre} {solicitud.usuario?.apellido}
                      </div>
                      <div className="text-sm text-base-content/60">
                        {solicitud.usuario?.departamento?.nombre}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span 
                      className="badge badge-sm"
                      style={{ backgroundColor: solicitud.tipoAusencia?.colorHex }}
                    >
                      {solicitud.tipoAusencia?.nombre}
                    </span>
                  </td>
                  <td>{new Date(solicitud.fechaInicio).toLocaleDateString('es-NI')}</td>
                  <td>{new Date(solicitud.fechaFin).toLocaleDateString('es-NI')}</td>
                  <td>
                    <span className="font-semibold">
                      {solicitud.cantidad} {solicitud.unidad}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${estadoColors[solicitud.estado]}`}>
                      {estadoTextos[solicitud.estado]}
                    </span>
                  </td>
                  {(esJefe || esRrhh) && (
                    <td>
                      <div className="flex gap-2">
                        {/* Botones según el rol y estado */}
                        {esJefe && solicitud.estado === 'pendiente' && (
                          <>
                            <button
                              className="btn btn-xs btn-success"
                              onClick={() => handleAprobar(solicitud, 'aprobar_jefe')}
                            >
                              Aprobar
                            </button>
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => handleAprobar(solicitud, 'rechazar')}
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {esRrhh && solicitud.estado === 'aprobada_jefe' && (
                          <>
                            <button
                              className="btn btn-xs btn-success"
                              onClick={() => handleAprobar(solicitud, 'aprobar_rrhh')}
                            >
                              Aprobar RRHH
                            </button>
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => handleAprobar(solicitud, 'rechazar')}
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {(solicitud.estado === 'aprobada' || solicitud.estado === 'rechazada') && (
                          <button className="btn btn-xs btn-outline" disabled>
                            {solicitud.estado === 'aprobada' ? '✓ Aprobada' : '✗ Rechazada'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </button>
          <span className="text-sm">
            Página {page} de {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
