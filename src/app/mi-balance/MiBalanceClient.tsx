'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { Calendar, CalendarClock, FilePlus, RefreshCw } from 'lucide-react';
import type { BalanceDiasFila } from '@/lib/domain/balance-display';
import { BalanceDiasTable } from '@/components/balance/BalanceDiasTable';
import {
  AsignacionesMensualesTable,
  type FilaAsignacionMensual,
} from '@/components/asignaciones/AsignacionesMensualesTable';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BalanceResponse {
  balanceDetalle: BalanceDiasFila | null;
  anoLaboral: number;
  diasUsados: number;
  diasPendientes: number;
  enVacaciones: boolean;
}

interface MiBalanceClientProps {
  session: Session;
}

export default function MiBalanceClient({ session }: MiBalanceClientProps) {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [historial, setHistorial] = useState<FilaAsignacionMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const puedeVerHistorialAsignaciones =
    session.user.esAdmin ||
    session.user.esRrhh ||
    (!session.user.esJefe && !session.user.esDirector);

  const cargarBalance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/mi-balance', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Error cargando balance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    if (!puedeVerHistorialAsignaciones) return;
    try {
      setLoadingHistorial(true);
      const res = await fetch(
        `/api/vacaciones/asignaciones-mensuales?usuarioId=${session.user.id}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (json.success) {
        setHistorial(json.data?.historial ?? []);
      }
    } catch (error) {
      console.error('Error cargando historial de asignaciones:', error);
    } finally {
      setLoadingHistorial(false);
    }
  }, [puedeVerHistorialAsignaciones, session.user.id]);

  useEffect(() => {
    void cargarBalance();
    void cargarHistorial();
  }, [cargarBalance, cargarHistorial]);

  const filas = data?.balanceDetalle ? [data.balanceDetalle] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi balance de días</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Consulta tu saldo de vacaciones: días arrastrados, devengados y disponibles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void cargarBalance();
              void cargarHistorial();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href="/solicitudes/nueva">
              <FilePlus className="h-4 w-4" />
              Nueva solicitud
            </Link>
          </Button>
        </div>
      </div>

      {data?.enVacaciones ? (
        <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <Calendar className="h-4 w-4" />
          <AlertDescription>Tienes vacaciones aprobadas en curso.</AlertDescription>
        </Alert>
      ) : null}

      <BalanceDiasTable filas={filas} loading={loading} anoLaboral={data?.anoLaboral ?? null} />

      {data && !loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Días usados</p>
            <p className="text-lg font-semibold tabular-nums">{data.diasUsados.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Días pendientes de aprobación</p>
            <p className="text-lg font-semibold tabular-nums">{data.diasPendientes.toFixed(2)}</p>
          </div>
        </div>
      ) : null}

      {puedeVerHistorialAsignaciones ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Mis asignaciones mensuales
            </CardTitle>
            <CardDescription>
              Créditos proporcionales acreditados cada mes según su antigüedad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AsignacionesMensualesTable
              filas={historial}
              loading={loadingHistorial}
              mostrarBalance
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
