'use client';

import React, { createContext, use, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Palmtree, Users } from 'lucide-react';
import { es } from 'react-day-picker/locale';
import type { DayButton } from 'react-day-picker';

import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

const VacationContext = createContext<Map<string, DiaCalendario>>(new Map());

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function formatDiaLargo(fecha: string): string {
  return parseDateKey(fecha).toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDiaCorto(fecha: string): string {
  return parseDateKey(fecha).toLocaleDateString('es-HN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function VacationDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const diasPorFecha = use(VacationContext);
  const info = diasPorFecha.get(toDateKey(day.date));
  const count = info?.solicitudes.length ?? 0;
  const hasVacation = count > 0;

  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      className={cn(
        hasVacation &&
          'bg-primary/10 text-primary hover:bg-primary/15 data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
        info?.esFinde && !hasVacation && 'text-muted-foreground/70',
        className
      )}
      {...props}
    >
      <span>{day.date.getDate()}</span>
      {hasVacation ? (
        <span
          className={cn(
            'rounded-full bg-primary',
            count > 1 ? 'min-w-4 px-1 text-[9px] leading-none text-primary-foreground' : 'size-1.5'
          )}
          aria-hidden
        >
          {count > 1 ? count : null}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <Skeleton className="h-[280px] w-full rounded-xl" />
    </div>
  );
}

function EmptyMonthMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Palmtree className="size-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-foreground">Sin ausencias aprobadas</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        No hay vacaciones registradas para este mes en su alcance de visualización.
      </p>
    </div>
  );
}

export function CalendarView({
  calendario,
  mesSeleccionado,
  anioSeleccionado,
  onMesChange,
  onAnioChange,
}: CalendarViewProps) {
  const visibleMonth = useMemo(
    () => new Date(anioSeleccionado, mesSeleccionado - 1, 1),
    [anioSeleccionado, mesSeleccionado]
  );

  const diasPorFecha = useMemo(() => {
    const map = new Map<string, DiaCalendario>();
    calendario?.dias.forEach((dia) => map.set(dia.fecha, dia));
    return map;
  }, [calendario]);

  const diasConAusencias = useMemo(
    () =>
      (calendario?.dias ?? [])
        .filter((dia) => dia.tieneVacaciones)
        .toSorted((a, b) => a.fecha.localeCompare(b.fecha)),
    [calendario]
  );

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!calendario) return;

    const hoy = new Date();
    const hoyKey = toDateKey(hoy);
    const hoyEnMes =
      hoy.getFullYear() === calendario.anio && hoy.getMonth() + 1 === calendario.mes;

    if (hoyEnMes && diasPorFecha.get(hoyKey)?.tieneVacaciones) {
      setSelectedDate(hoy);
      return;
    }

    const primerDiaConAusencia = diasConAusencias[0];
    setSelectedDate(
      primerDiaConAusencia ? parseDateKey(primerDiaConAusencia.fecha) : hoyEnMes ? hoy : undefined
    );
  }, [calendario, diasPorFecha, diasConAusencias]);

  const selectedKey = selectedDate ? toDateKey(selectedDate) : undefined;
  const diaSeleccionado = selectedKey ? diasPorFecha.get(selectedKey) : undefined;

  const vacationDates = useMemo(
    () =>
      diasConAusencias.map((dia) => parseDateKey(dia.fecha)),
    [diasConAusencias]
  );

  const startMonth = useMemo(() => new Date(new Date().getFullYear() - 1, 0, 1), []);
  const endMonth = useMemo(() => new Date(new Date().getFullYear() + 2, 11, 31), []);

  const tituloMes = calendario?.nombreMes
    ? `${calendario.nombreMes.charAt(0).toUpperCase()}${calendario.nombreMes.slice(1)} ${anioSeleccionado}`
    : 'Calendario de ausencias';

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Calendario de ausencias
            </CardTitle>
            <CardDescription>{tituloMes}</CardDescription>
          </div>

          {calendario && calendario.estadisticas.totalSolicitudes > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <CalendarDays />
                {calendario.estadisticas.totalDiasConVacaciones} días hábiles
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users />
                {calendario.estadisticas.usuariosEnVacaciones} personas
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Palmtree />
                {calendario.estadisticas.totalSolicitudes} solicitudes
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="py-5">
        {!calendario ? (
          <CalendarSkeleton />
        ) : calendario.dias.length === 0 || diasConAusencias.length === 0 ? (
          <EmptyMonthMessage />
        ) : (
          <VacationContext.Provider value={diasPorFecha}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
              <div className="flex justify-center rounded-xl border bg-muted/20 p-2 sm:p-4">
                <Calendar
                  mode="single"
                  locale={es}
                  weekStartsOn={1}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={visibleMonth}
                  onMonthChange={(date) => {
                    onMesChange(date.getMonth() + 1);
                    onAnioChange(date.getFullYear());
                  }}
                  captionLayout="dropdown"
                  startMonth={startMonth}
                  endMonth={endMonth}
                  modifiers={{ vacation: vacationDates }}
                  modifiersClassNames={{
                    vacation: 'font-semibold',
                  }}
                  components={{ DayButton: VacationDayButton }}
                  className="w-full max-w-none [--cell-size:2.5rem] sm:[--cell-size:2.75rem]"
                />
              </div>

              <div className="flex min-h-[280px] flex-col rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Detalle del día
                  </p>
                  <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                    {selectedDate
                      ? formatDiaLargo(toDateKey(selectedDate))
                      : 'Seleccione un día'}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                  {!diaSeleccionado || diaSeleccionado.solicitudes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {selectedDate
                        ? 'Sin ausencias aprobadas este día.'
                        : 'Haga clic en un día resaltado para ver el detalle.'}
                    </p>
                  ) : (
                    diaSeleccionado.solicitudes.map((solicitud) => (
                      <div
                        key={solicitud.id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          {solicitud.usuario}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          Aprobada
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {diasConAusencias.length > 0 && (
              <>
                <Separator className="my-5" />
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Resumen del mes
                  </h3>
                  <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                    {diasConAusencias.map((dia) => (
                      <button
                        key={dia.fecha}
                        type="button"
                        onClick={() => setSelectedDate(parseDateKey(dia.fecha))}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                          selectedKey === dia.fecha && 'border-primary/40 bg-primary/5'
                        )}
                      >
                        <span className="w-24 shrink-0 text-xs font-medium capitalize text-muted-foreground">
                          {formatDiaCorto(dia.fecha)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-foreground">
                          {dia.solicitudes.map((s) => s.usuario).join(' · ')}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {dia.solicitudes.length}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </VacationContext.Provider>
        )}
      </CardContent>

      <CardFooter className="border-t py-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            Día con ausencias aprobadas
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
            Hoy
          </span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 min-w-4 rounded-full bg-primary px-1 text-[9px] leading-none text-primary-foreground">
              2
            </span>
            Cantidad de personas
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
