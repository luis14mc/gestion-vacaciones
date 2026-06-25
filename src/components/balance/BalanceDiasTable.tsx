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
}

export function BalanceDiasTable({ filas, loading, anoLaboral }: BalanceDiasTableProps) {
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
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground text-right whitespace-nowrap">
                Días vencidos
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground text-right whitespace-nowrap">
                Días proporcionales
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground text-right whitespace-nowrap">
                Días disponibles
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No hay datos de balance disponibles.
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
                  <TableCell
                    className={`text-sm text-right tabular-nums ${
                      fila.diasVencidos > 0
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                        : ''
                    }`}
                  >
                    {formatDias(fila.diasVencidos)}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {formatDias(fila.diasProporcionales)}
                  </TableCell>
                  <TableCell className="text-sm text-right font-bold tabular-nums">
                    {formatDias(fila.diasDisponibles)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-4 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
        Los días disponibles reflejan su saldo neto después de solicitudes usadas o pendientes de aprobación.
      </div>
    </div>
  );
}
