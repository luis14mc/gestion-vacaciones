'use client';

import { formatDias, type BalanceDiasFila } from '@/lib/domain/balance-display';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BalanceDiasTableProps {
  filas: BalanceDiasFila[];
  loading?: boolean;
  anoLaboral?: number | null;
  emptyMessage?: string;
  /** Si false, oculta columnas intermedias y muestra solo vencidos/proporcionales/disponibles. */
  compacto?: boolean;
}

const DEFAULT_EMPTY_MESSAGE = 'No hay datos de balance disponibles.';

const COLUMNAS_COMPLETAS = [
  { key: 'vencidos', label: 'Días vencidos' },
  { key: 'proporcionales', label: 'Días proporcionales' },
  { key: 'asignados', label: 'Días asignados' },
  { key: 'usados', label: 'Días usados' },
  { key: 'pendientes', label: 'Días pendientes' },
  { key: 'disponibles', label: 'Días disponibles' },
] as const;

export function BalanceDiasTable({
  filas,
  loading,
  anoLaboral,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  compacto = false,
}: BalanceDiasTableProps) {
  const columnas = compacto
    ? COLUMNAS_COMPLETAS.filter((c) =>
        ['vencidos', 'proporcionales', 'disponibles'].includes(c.key)
      )
    : COLUMNAS_COMPLETAS;

  if (loading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-sky-100/80 dark:bg-sky-950/40 px-4 py-3 border-b">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  function valorCelda(fila: BalanceDiasFila, key: (typeof COLUMNAS_COMPLETAS)[number]['key']) {
    switch (key) {
      case 'vencidos':
        return formatDias(fila.diasVencidos);
      case 'proporcionales':
        return formatDias(fila.diasProporcionales);
      case 'asignados':
        return formatDias(fila.diasAsignados);
      case 'usados':
        return formatDias(fila.diasUsados);
      case 'pendientes':
        return formatDias(fila.diasPendientes);
      case 'disponibles':
        return formatDias(fila.diasDisponibles);
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="bg-sky-100/80 dark:bg-sky-950/40 px-4 py-3 border-b flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Balance de días</h2>
        {anoLaboral ? (
          <span className="text-xs text-muted-foreground">Año laboral {anoLaboral}</span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sky-50/90 dark:bg-sky-950/20 hover:bg-sky-50/90 dark:hover:bg-sky-950/20">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground whitespace-nowrap">
                Colaborador
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground whitespace-nowrap">
                Fecha de ingreso
              </TableHead>
              {columnas.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-xs font-semibold uppercase tracking-wide text-foreground text-right whitespace-nowrap"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2 + columnas.length}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.colaborador}>
                  <TableCell className="text-sm font-medium whitespace-nowrap">
                    {fila.colaborador}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums">
                    {fila.fechaIngreso}
                  </TableCell>
                  {columnas.map((col) => (
                    <TableCell
                      key={col.key}
                      className={`text-sm text-right tabular-nums ${
                        col.key === 'vencidos' && fila.diasVencidos > 0
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                          : col.key === 'disponibles'
                            ? 'font-bold'
                            : ''
                      }`}
                    >
                      {valorCelda(fila, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
        Los días disponibles = días vencidos + días proporcionales − días usados − días pendientes.
      </div>
    </div>
  );
}
