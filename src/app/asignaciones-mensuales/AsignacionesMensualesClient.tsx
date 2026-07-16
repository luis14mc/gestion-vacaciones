'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from 'next-auth';
import { CalendarClock, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AsignacionesMensualesTable,
  type FilaAsignacionMensual,
} from '@/components/asignaciones/AsignacionesMensualesTable';
import { labelMes } from '@/lib/domain/asignacion-mensual-labels';

interface AsignacionesMensualesClientProps {
  session: Session;
}

interface ResumenBatch {
  anio: number;
  mes: number;
  asignaciones: number;
  totalDiasAsignados: number;
  detalles: Array<{
    usuarioId: number;
    diasAsignados: number;
    aniosAntiguedad: number;
    origen: string;
    ejecutadoEn: string;
  }>;
}

export default function AsignacionesMensualesClient({
  session,
}: AsignacionesMensualesClientProps) {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [usuarioId, setUsuarioId] = useState('');
  const [modo, setModo] = useState<'batch' | 'usuario'>('batch');
  const [filas, setFilas] = useState<FilaAsignacionMensual[]>([]);
  const [resumen, setResumen] = useState<ResumenBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResumen(null);

    try {
      const params = new URLSearchParams();
      if (modo === 'batch') {
        params.set('anio', String(anio));
        params.set('mes', String(mes));
      } else {
        const uid = Number.parseInt(usuarioId, 10);
        if (!Number.isFinite(uid)) {
          setError('Indique un ID de usuario válido.');
          setFilas([]);
          return;
        }
        params.set('usuarioId', String(uid));
        if (anio) params.set('anio', String(anio));
      }

      const res = await fetch(`/api/vacaciones/asignaciones-mensuales?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Error al cargar historial');
      }

      if (modo === 'batch') {
        const data = json.data as ResumenBatch;
        setResumen(data);
        setFilas(
          data.detalles.map((d) => ({
            anio: data.anio,
            mes: data.mes,
            diasAsignados: d.diasAsignados,
            aniosAntiguedad: d.aniosAntiguedad,
            origen: d.origen,
            ejecutadoEn: d.ejecutadoEn,
          }))
        );
      } else {
        const historial = (json.data?.historial ?? []) as FilaAsignacionMensual[];
        setFilas(historial);
      }
    } catch (err) {
      setFilas([]);
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [anio, mes, modo, usuarioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Asignaciones mensuales
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Historial institucional de créditos proporcionales por antigüedad.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void cargar()}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consulta</CardTitle>
          <CardDescription>
            Vista por período (resumen del mes) o por colaborador (historial individual).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={modo === 'batch' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModo('batch')}
            >
              Resumen del mes
            </Button>
            <Button
              variant={modo === 'usuario' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModo('usuario')}
            >
              Por colaborador
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              />
            </div>
            {modo === 'batch' ? (
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {labelMes(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label>ID de usuario</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej. 42"
                    value={usuarioId}
                    onChange={(e) => setUsuarioId(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={() => void cargar()}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {resumen ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{resumen.asignaciones} asignaciones</Badge>
          <Badge variant="outline">
            Total: +{resumen.totalDiasAsignados.toFixed(4)} días
          </Badge>
          <Badge variant="outline">
            {labelMes(resumen.mes)} {resumen.anio}
          </Badge>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <AsignacionesMensualesTable
          filas={filas}
          loading={loading}
          mostrarBalance={modo === 'usuario'}
        />
      )}

      {session.user.esAdmin ? (
        <p className="text-xs text-muted-foreground">
          Para ejecutar la asignación del mes, use Configuración → Vacaciones.
        </p>
      ) : null}
    </div>
  );
}
