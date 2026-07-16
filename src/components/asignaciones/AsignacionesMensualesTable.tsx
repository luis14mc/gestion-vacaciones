'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date-format';
import { labelMes, labelOrigenAsignacion } from '@/lib/domain/asignacion-mensual-labels';

export interface FilaAsignacionMensual {
  id?: number;
  anio: number;
  mes: number;
  diasAsignados: number;
  balanceAnterior?: number;
  balanceNuevo?: number;
  aniosAntiguedad?: number;
  origen?: string;
  ejecutadoEn?: string;
}

interface AsignacionesMensualesTableProps {
  filas: FilaAsignacionMensual[];
  loading?: boolean;
  mostrarBalance?: boolean;
}

export function AsignacionesMensualesTable({
  filas,
  loading = false,
  mostrarBalance = true,
}: AsignacionesMensualesTableProps) {
  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando historial de asignaciones…
      </p>
    );
  }

  if (filas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin asignaciones mensuales registradas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Días</TableHead>
            {mostrarBalance ? (
              <>
                <TableHead className="text-right">Balance anterior</TableHead>
                <TableHead className="text-right">Balance nuevo</TableHead>
              </>
            ) : null}
            <TableHead>Antigüedad</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Ejecutado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.id ?? `${fila.anio}-${fila.mes}`}>
              <TableCell className="font-medium whitespace-nowrap">
                {labelMes(fila.mes)} {fila.anio}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                +{fila.diasAsignados.toFixed(4)}
              </TableCell>
              {mostrarBalance ? (
                <>
                  <TableCell className="text-right tabular-nums">
                    {(fila.balanceAnterior ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(fila.balanceNuevo ?? 0).toFixed(2)}
                  </TableCell>
                </>
              ) : null}
              <TableCell>
                {typeof fila.aniosAntiguedad === 'number'
                  ? `${fila.aniosAntiguedad} año(s)`
                  : '—'}
              </TableCell>
              <TableCell>
                {fila.origen ? (
                  <Badge variant="secondary" className="text-xs">
                    {labelOrigenAsignacion(fila.origen)}
                  </Badge>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {fila.ejecutadoEn ? formatDateTime(fila.ejecutadoEn) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
