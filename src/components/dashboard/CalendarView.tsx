'use client';

import React from 'react';
import { Calendar, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DiaCalendario {
  dia: number;
  fecha: string;
  diaSemana: number;
  solicitudes: Array<{ id: number; usuario: string; estado: string }>;
  tieneVacaciones: boolean;
  esFinde: boolean;
}

interface CalendarioData {
  mes: number;
  anio: number;
  nombreMes: string;
  dias: DiaCalendario[];
  estadisticas: {
    totalDiasConVacaciones: number;
    usuariosEnVacaciones: number;
    totalSolicitudes: number;
  };
}

interface CalendarViewProps {
  calendario: CalendarioData | null;
  mesSeleccionado: number;
  anioSeleccionado: number;
  onMesChange: (mes: number) => void;
  onAnioChange: (anio: number) => void;
}

const DIAS_HEADER = ['L', 'M', 'X', 'J', 'V'];

export function CalendarView({
  calendario,
  mesSeleccionado,
  anioSeleccionado,
  onMesChange,
  onAnioChange,
}: CalendarViewProps) {
  return (
    <div className="bg-card border text-card-foreground shadow-sm rounded-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3.5 border-b">
        <h2 className="text-[13px] font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          {calendario?.nombreMes || '...'} {anioSeleccionado}
        </h2>
        <div className="flex gap-2">
          <Select value={String(mesSeleccionado)} onValueChange={(val) => onMesChange(Number(val))}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {new Date(2000, m - 1, 1).toLocaleDateString('es-ES', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anioSeleccionado)} onValueChange={(val) => onAnioChange(Number(val))}>
            <SelectTrigger className="h-8 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4">
        {/* Stats badges */}
        {calendario && calendario.estadisticas.totalSolicitudes > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground bg-muted px-2.5 py-1 rounded-full">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              {calendario.estadisticas.totalDiasConVacaciones} días
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground bg-muted px-2.5 py-1 rounded-full">
              <Users className="w-3 h-3 text-muted-foreground" />
              {calendario.estadisticas.usuariosEnVacaciones} personas
            </span>
          </div>
        )}

        {/* Calendar grid */}
        {!calendario ? (
          <div className="flex justify-center py-8">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : calendario.dias.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin vacaciones este mes</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-px bg-border rounded-xl overflow-hidden">
              {/* Day headers */}
              {DIAS_HEADER.map((d, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-2 bg-muted/30">
                  {d}
                </div>
              ))}

              {/* Days */}
              {calendario.dias
                .filter((dia) => !dia.esFinde)
                .map((dia, index) => {
                  const diaSemana = dia.diaSemana === 0 ? 6 : dia.diaSemana - 1;
                  const esPrimero = index === 0;

                  return (
                    <React.Fragment key={dia.fecha}>
                      {esPrimero &&
                        diaSemana > 0 &&
                        Array.from({ length: diaSemana }).map((_, i) => (
                          <div key={`empty-${i}`} className="bg-background" />
                        ))}
                      <div
                        className={`
                          aspect-square flex flex-col items-center justify-center text-[13px] bg-background
                          transition-all duration-200
                          ${dia.tieneVacaciones
                            ? 'bg-primary/10 font-semibold'
                            : 'hover:bg-muted/50'
                          }
                        `}
                        title={dia.solicitudes.map((s) => s.usuario).join(', ')}
                      >
                        <span className={dia.tieneVacaciones ? 'text-primary' : 'text-foreground/80'}>
                          {dia.dia}
                        </span>
                        {dia.solicitudes.length > 0 && (
                          <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Con vacaciones
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                Sin vacaciones
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
