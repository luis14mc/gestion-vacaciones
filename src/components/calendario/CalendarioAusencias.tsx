'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';

// =====================================================
// TIPOS
// =====================================================

interface AusenciaDia {
  id: number;
  codigo: string;
  tipo: string;
  usuario: string;
  departamento: string;
}

interface CalendarioData {
  mes: number;
  anio: number;
  dias: Record<string, AusenciaDia[]>;
}

interface CalendarioAusenciasProps {
  departamentoId?: number;
}

// =====================================================
// CONSTANTES
// =====================================================

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const TIPO_COLORS: Record<string, string> = {
  vacaciones: 'bg-blue-200 text-blue-800',
  permiso_salida: 'bg-amber-200 text-amber-800',
  licencia_medica: 'bg-red-200 text-red-800',
  permiso_personal: 'bg-purple-200 text-purple-800',
};

// =====================================================
// COMPONENTE
// =====================================================

export function CalendarioAusencias({ departamentoId }: CalendarioAusenciasProps) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [data, setData] = useState<CalendarioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (departamentoId) params.set('departamentoId', String(departamentoId));

      const res = await fetch(`/api/calendario/ausencias?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error cargando calendario:', err);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, departamentoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAnio(anio - 1); }
    else setMes(mes - 1);
  };

  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAnio(anio + 1); }
    else setMes(mes + 1);
  };

  // Generar grid del mes
  const primerDiaMes = new Date(anio, mes - 1, 1);
  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  // Lunes = 0... Domingo = 6
  let startDay = primerDiaMes.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const dias: Array<{ fecha: string | null; dia: number | null }> = [];

  // Espacios vacíos antes del primer día
  for (let i = 0; i < startDay; i++) {
    dias.push({ fecha: null, dia: null });
  }

  // Días del mes
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dias.push({ fecha, dia: d });
  }

  const hoy = now.toISOString().split('T')[0];

  return (
    <Card title="Calendario de Ausencias">
      {/* Navegación */}
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>
          ◀
        </button>
        <span className="font-semibold text-lg">
          {MESES[mes - 1]} {anio}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>
          ▶
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Grid calendario */}
          <div className="grid grid-cols-7 gap-px bg-base-200 rounded-lg overflow-hidden">
            {/* Headers */}
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="bg-base-100 text-center text-xs font-semibold text-base-content/60 py-2"
              >
                {d}
              </div>
            ))}

            {/* Días */}
            {dias.map((item, i) => {
              const ausencias = item.fecha && data?.dias[item.fecha];
              const count = ausencias ? ausencias.length : 0;
              const esHoy = item.fecha === hoy;

              return (
                <div
                  key={i}
                  className={`
                    bg-base-100 min-h-[60px] p-1 cursor-pointer transition-colors
                    ${item.dia ? 'hover:bg-base-200' : ''}
                    ${esHoy ? 'ring-2 ring-primary ring-inset' : ''}
                    ${selectedDay === item.fecha ? 'bg-primary/10' : ''}
                  `}
                  onClick={() => item.fecha && setSelectedDay(
                    selectedDay === item.fecha ? null : item.fecha
                  )}
                >
                  {item.dia && (
                    <>
                      <span className={`text-xs ${esHoy ? 'font-bold text-primary' : 'text-base-content/70'}`}>
                        {item.dia}
                      </span>
                      {count > 0 && (
                        <div className="mt-0.5">
                          <span className="inline-block w-5 h-5 rounded-full bg-primary text-primary-content text-[10px] font-bold leading-5 text-center">
                            {count}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detalle del día seleccionado */}
          {selectedDay && data?.dias[selectedDay] && (
            <div className="mt-4 border rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-2">
                Ausencias del {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-HN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h4>
              <div className="space-y-2">
                {data.dias[selectedDay].map((a) => (
                  <div
                    key={`${a.id}-${selectedDay}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[a.tipo] || 'bg-gray-200 text-gray-700'}`}>
                      {a.tipo.replace('_', ' ')}
                    </span>
                    <span className="font-medium">{a.usuario}</span>
                    <span className="text-base-content/50">— {a.departamento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDay && !data?.dias[selectedDay] && (
            <div className="mt-4 text-center text-sm text-base-content/50 py-4">
              Sin ausencias este día
            </div>
          )}
        </>
      )}
    </Card>
  );
}
