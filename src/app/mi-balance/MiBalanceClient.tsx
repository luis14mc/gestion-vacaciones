'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, FilePlus, RefreshCw } from 'lucide-react';
import type { BalanceDiasFila } from '@/lib/domain/balance-display';
import { BalanceDiasTable } from '@/components/balance/BalanceDiasTable';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BalanceResponse {
  balanceDetalle: BalanceDiasFila | null;
  anoLaboral: number;
  diasUsados: number;
  diasPendientes: number;
  enVacaciones: boolean;
}

export default function MiBalanceClient() {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    cargarBalance();
  }, [cargarBalance]);

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
          <Button variant="outline" size="sm" onClick={cargarBalance} className="gap-2">
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
          <AlertDescription>
            Tienes vacaciones aprobadas en curso.
          </AlertDescription>
        </Alert>
      ) : null}

      <BalanceDiasTable
        filas={filas}
        loading={loading}
        anoLaboral={data?.anoLaboral ?? null}
      />

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
    </div>
  );
}
