'use client';

import { useState, useEffect } from 'react';
import type { TipoAusenciaConfig, BalanceCompleto, NuevaSolicitud } from '@/types';

interface FormularioSolicitudProps {
  usuarioId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FormularioSolicitud({ usuarioId, onSuccess, onCancel }: FormularioSolicitudProps) {
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusenciaConfig[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estado del formulario
  const [formData, setFormData] = useState({
    tipoAusenciaId: '',
    tipoPermiso: '', // 1-2hrs, 2-4hrs, dia_completo
    fechaInicio: '',
    fechaFin: '',
    horaInicio: '',
    horaFin: '',
    horaSalida: '',
    horaRegreso: '',
    cantidad: '',
    unidad: 'dias' as 'dias' | 'horas',
    motivo: '',
    observaciones: ''
  });

  const [balanceSeleccionado, setBalanceSeleccionado] = useState<any>(null);
  const [diasDisponibles, setDiasDisponibles] = useState(0);
  const [diasSolicitados, setDiasSolicitados] = useState(0);
  const [diasRestantes, setDiasRestantes] = useState(0);

  // Cargar tipos de ausencia y balances
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);

        const [tiposRes, balancesRes] = await Promise.all([
          fetch('/api/tipos-ausencia'),
          fetch(`/api/balances?usuarioId=${usuarioId}&anio=${new Date().getFullYear()}`)
        ]);

        const tiposData = await tiposRes.json();
        const balancesData = await balancesRes.json();

        if (tiposData.success) setTiposAusencia(tiposData.data);
        if (balancesData.success) setBalances(balancesData.data);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [usuarioId]);

  // Actualizar balance seleccionado cuando cambia el tipo
  useEffect(() => {
    if (formData.tipoAusenciaId) {
      const balance = balances.find(
        (b: any) => b.tipo_ausencia_id === Number.parseInt(formData.tipoAusenciaId)
      );
      setBalanceSeleccionado(balance || null);
      setDiasDisponibles(balance ? Number.parseFloat(balance.cantidad_disponible) : 0);
    }
  }, [formData.tipoAusenciaId, balances]);

  // Calcular días solicitados
  useEffect(() => {
    if (formData.fechaInicio && formData.fechaFin) {
      const inicio = new Date(formData.fechaInicio);
      const fin = new Date(formData.fechaFin);
      const diff = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setDiasSolicitados(diff > 0 ? diff : 0);
      setDiasRestantes(diasDisponibles - (diff > 0 ? diff : 0));
    }
  }, [formData.fechaInicio, formData.fechaFin, diasDisponibles]);

  const handleTipoAusenciaChange = (tipoId: string) => {
    const tipo = tiposAusencia.find(t => t.id === Number.parseInt(tipoId));
    
    setFormData({
      ...formData,
      tipoAusenciaId: tipoId,
      unidad: tipo?.permiteHoras ? 'horas' : 'dias',
      tipoPermiso: tipo?.permiteHoras ? '1-2hrs' : '',
      cantidad: '',
      horaInicio: '',
      horaFin: '',
      horaSalida: '',
      horaRegreso: ''
    });
  };

  const handleTipoPermisoChange = (tipo: string) => {
    setFormData({
      ...formData,
      tipoPermiso: tipo,
      cantidad: tipo === '1-2hrs' ? '2' : tipo === '2-4hrs' ? '4' : ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const solicitud: any = {
        usuarioId,
        tipoAusenciaId: Number.parseInt(formData.tipoAusenciaId),
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        cantidad: formData.unidad === 'horas' ? formData.cantidad : diasSolicitados.toString(),
        unidad: formData.unidad,
        motivo: formData.motivo || null,
        observaciones: formData.observaciones || null
      };

      if (formData.unidad === 'horas') {
        solicitud.horaInicio = formData.horaSalida;
        solicitud.horaFin = formData.horaRegreso;
      }

      const response = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitud)
      });

      const data = await response.json();

      if (data.success) {
        alert('Solicitud creada exitosamente');
        onSuccess?.();
      } else {
        alert(`Error: ${data.error}`);
      }

    } catch (error) {
      console.error('Error creando solicitud:', error);
      alert('Error al crear solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const tipoSeleccionado = tiposAusencia.find(t => t.id === Number.parseInt(formData.tipoAusenciaId));
  const esPermiso = tipoSeleccionado?.permiteHoras;
  const esVacaciones = tipoSeleccionado?.tipo === 'vacaciones';

  return (
    <form onSubmit={handleSubmit} className="bg-base-100 rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="border-b-2 border-base-content pb-4 mb-6">
        <h2 className="text-2xl font-bold text-center text-base-content">
          SOLICITUD DE PERMISO / VACACIONES
        </h2>
        <p className="text-center text-sm text-base-content/60 mt-2">
          Fecha de solicitud: {new Date().toLocaleDateString('es-NI')}
        </p>
      </div>

      {/* Tipo de Ausencia */}
      <div className="mb-6">
        <label className="label">
          <span className="label-text font-semibold">Tipo de Solicitud *</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={formData.tipoAusenciaId}
          onChange={(e) => handleTipoAusenciaChange(e.target.value)}
          required
        >
          <option value="">Seleccione un tipo</option>
          {tiposAusencia.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* SECCIÓN 1: PERMISOS CON HORAS */}
      {esPermiso && (
        <div className="border-2 border-info rounded-lg p-6 mb-6 bg-info/10">
          <h3 className="text-lg font-bold text-info mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            PERMISO DE SALIDA
          </h3>

          {/* Tipo de permiso */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="tipoPermiso"
                value="1-2hrs"
                checked={formData.tipoPermiso === '1-2hrs'}
                onChange={(e) => handleTipoPermisoChange(e.target.value)}
                className="radio radio-primary mr-2"
              />
              <span className="font-semibold">1-2 Horas</span>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio"
                name="tipoPermiso"
                value="2-4hrs"
                checked={formData.tipoPermiso === '2-4hrs'}
                onChange={(e) => handleTipoPermisoChange(e.target.value)}
                className="radio radio-primary mr-2"
              />
              <span className="font-semibold">2-4 Horas</span>
            </label>
            <label className="cursor-pointer">
              <input
                type="radio"
                name="tipoPermiso"
                value="dia_completo"
                checked={formData.tipoPermiso === 'dia_completo'}
                onChange={(e) => handleTipoPermisoChange(e.target.value)}
                className="radio radio-primary mr-2"
              />
              <span className="font-semibold">Día Completo</span>
            </label>
          </div>

          {formData.tipoPermiso && formData.tipoPermiso !== 'dia_completo' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Hora de Salida *</span>
                </label>
                <input
                  type="time"
                  className="input input-bordered w-full"
                  value={formData.horaSalida}
                  onChange={(e) => setFormData({ ...formData, horaSalida: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Hora de Regreso *</span>
                </label>
                <input
                  type="time"
                  className="input input-bordered w-full"
                  value={formData.horaRegreso}
                  onChange={(e) => setFormData({ ...formData, horaRegreso: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="label">
              <span className="label-text font-semibold">Motivo *</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-20"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Describa el motivo de su permiso"
              required
            />
          </div>
        </div>
      )}

      {/* SECCIÓN 2: VACACIONES */}
      {esVacaciones && (
        <div className="border-2 border-success rounded-lg p-6 mb-6 bg-success/10">
          <h3 className="text-lg font-bold text-success mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" />
            </svg>
            VACACIONES
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">
                <span className="label-text font-semibold">Fecha de Inicio *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text font-semibold">Fecha de Fin *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.fechaFin}
                onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                min={formData.fechaInicio}
                required
              />
            </div>
          </div>

          {/* Balance visual */}
          {balanceSeleccionado && (
            <div className="bg-base-100 rounded-lg p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border-r-2">
                  <p className="text-sm text-base-content/60">Días Disponibles</p>
                  <p className="text-3xl font-bold text-accent">{diasDisponibles}</p>
                </div>
                <div className="border-r-2">
                  <p className="text-sm text-base-content/60">Días Solicitados</p>
                  <p className="text-3xl font-bold text-secondary">{diasSolicitados}</p>
                </div>
                <div>
                  <p className="text-sm text-base-content/60">Días Restantes</p>
                  <p className={`text-3xl font-bold ${diasRestantes < 0 ? 'text-error' : 'text-base-content'}`}>
                    {diasRestantes}
                  </p>
                </div>
              </div>
              {diasRestantes < 0 && (
                <div className="alert alert-error mt-4">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>No tiene suficientes días disponibles</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className="label">
              <span className="label-text font-semibold">Observaciones</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-20"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Observaciones adicionales (opcional)"
            />
          </div>
        </div>
      )}

      {/* Otros tipos de ausencia (permisos sin horas) */}
      {!esPermiso && !esVacaciones && formData.tipoAusenciaId && (
        <div className="border-2 border-gray-300 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">
                <span className="label-text font-semibold">Fecha de Inicio *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text font-semibold">Fecha de Fin *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.fechaFin}
                onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                min={formData.fechaInicio}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">
              <span className="label-text font-semibold">Motivo / Justificación *</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Describa el motivo de su solicitud"
              required
            />
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-end gap-4 mt-6 pt-6 border-t-2">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || (esVacaciones && diasRestantes < 0)}
        >
          {submitting ? (
            <>
              <span className="loading loading-spinner"></span>
              Enviando...
            </>
          ) : (
            'Enviar Solicitud'
          )}
        </button>
      </div>

      {/* Pie de página informativo */}
      <div className="mt-6 p-4 bg-base-200 rounded-lg text-xs text-base-content/60">
        <p className="font-semibold mb-2">Proceso de aprobación:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>1. Aprobación de Jefe Inmediato</li>
          <li>2. Revisión y aprobación de Recursos Humanos</li>
          <li>3. Notificación al solicitante</li>
        </ul>
      </div>
    </form>
  );
}
