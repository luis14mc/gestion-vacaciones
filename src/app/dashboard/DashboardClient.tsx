'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle, Hourglass, Car, Shield,
  FileText, Briefcase, UsersRound, Clock, X, User, RefreshCw,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { BalanceDiasTable } from '@/components/balance/BalanceDiasTable';
import type { BalanceDiasFila } from '@/lib/domain/balance-display';
import type { Session } from 'next-auth';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Metrics {
  usuarios_totales: number;
  usuarios_activos: number;
  solicitudes_pendientes: number;
  en_vacaciones: number;
  nuevos_este_mes?: number;
  aprobadas_hoy?: number;
  rechazadas_hoy?: number;
}

interface BalancePersonal {
  tieneBalance?: boolean;
  diasAsignados: number;
  diasAcumulados?: number;
  diasUsados: number;
  diasPendientes: number;
  diasDisponibles: number;
  diasVencidos?: number;
  diasProporcionales?: number;
  balanceDetalle?: BalanceDiasFila | null;
  anoLaboral?: number;
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesRechazadas: number;
  enVacaciones: boolean;
}

interface Actividad {
  id: string;
  tipo: 'aprobada' | 'nueva_solicitud' | 'nuevo_usuario';
  titulo: string;
  descripcion: string;
  fecha: string;
}

interface CalendarioData {
  mes: number;
  anio: number;
  nombreMes: string;
  dias: Array<{
    dia: number;
    fecha: string;
    diaSemana: number;
    solicitudes: Array<{ id: number; usuario: string; estado: string }>;
    tieneVacaciones: boolean;
    esFinde: boolean;
  }>;
  estadisticas: {
    totalDiasConVacaciones: number;
    usuariosEnVacaciones: number;
    totalSolicitudes: number;
  };
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DashboardClient({ session }: { session: Session }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [balance, setBalance] = useState<BalancePersonal | null>(null);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [calendario, setCalendario] = useState<CalendarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const { esAdmin, esRrhh, esDirector, esJefe } = session.user;
  const isEmpleado = !esAdmin && !esRrhh && !esDirector && !esJefe;

  // â”€â”€â”€ Data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cargarDatos = useCallback(async () => {
    try {
      let metricsUrl: string | null = null;
      if (esAdmin) metricsUrl = '/api/dashboard/admin/metricas';
      else if ((esDirector || esJefe) && !esRrhh) metricsUrl = '/api/dashboard/jefe/metricas';
      else if (esRrhh && !esAdmin) metricsUrl = '/api/dashboard/rrhh/metricas';

      const fetchJson = async (url: string) => {
        const r = await fetch(url, { cache: 'no-store' });
        const json = await r.json();
        if (!r.ok || !json.success) {
          console.warn(`[Dashboard] ${url} → ${r.status}`, json.error || json);
        }
        return json;
      };

      const [metricsRes, actividadRes, calendarioRes, balanceRes] = await Promise.all([
        metricsUrl ? fetchJson(metricsUrl) : Promise.resolve({ success: false }),
        fetchJson('/api/dashboard/actividad'),
        fetchJson(`/api/dashboard/calendario?mes=${mes}&anio=${anio}`),
        fetchJson('/api/dashboard/mi-balance'),
      ]);

      if (!isEmpleado) {
        if (metricsRes.success) {
          setMetrics(metricsRes.data);
        } else {
          setMetrics({ usuarios_totales: 0, usuarios_activos: 0, solicitudes_pendientes: 0, en_vacaciones: 0 });
        }
      }

      if (balanceRes.success) {
        setBalance(balanceRes.data);
      } else {
        setBalance(null);
      }

      if (actividadRes.success) setActividades(actividadRes.data);
      if (calendarioRes.success) setCalendario(calendarioRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
      if (!isEmpleado) {
        setMetrics({ usuarios_totales: 0, usuarios_activos: 0, solicitudes_pendientes: 0, en_vacaciones: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [esAdmin, esRrhh, esDirector, esJefe, isEmpleado, mes, anio]);

  useEffect(() => {
    cargarDatos();

    const onFocus = () => cargarDatos();
    const onVisible = () => { if (!document.hidden) cargarDatos(); };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [cargarDatos]);

  // â”€â”€â”€ Role info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const roleConfig = esAdmin
    ? { icon: Shield, label: 'Administrador', desc: 'Control total del sistema', color: 'primary' }
    : esRrhh
      ? { icon: UsersRound, label: 'Recursos Humanos', desc: 'Gestión de personal y solicitudes', color: 'secondary' }
      : esDirector
        ? { icon: Briefcase, label: 'Director', desc: 'Gestión de tu equipo', color: 'info' }
        : esJefe
          ? { icon: Briefcase, label: 'Jefe', desc: 'Tu equipo', color: 'info' }
          : { icon: User, label: 'Empleado', desc: 'Tu espacio personal', color: 'accent' };

  const RoleIcon = roleConfig.icon;

  const mensajeSinBalance = 'No hay balance de vacaciones asignado para el año laboral activo.';

  const renderMiBalancePersonal = (conTitulo: boolean) => {
    if (loading || !balance) return null;

    const filas =
      balance.tieneBalance !== false && balance.balanceDetalle
        ? [balance.balanceDetalle]
        : [];

    const tabla = (
      <BalanceDiasTable
        filas={filas}
        anoLaboral={balance.anoLaboral ?? null}
        emptyMessage={mensajeSinBalance}
      />
    );

    if (!conTitulo) return tabla;

    return (
      <div>
        <h3 className="text-[13px] font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <User className="w-3.5 h-3.5" />
          Mi Balance Personal
        </h3>
        {tabla}
      </div>
    );
  };

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{roleConfig.desc}</p>
        </div>
        <button
          onClick={cargarDatos}
          className="p-1.5 rounded-xl hover:bg-muted transition-colors"
          title="Recargar"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Vacation alert for employees */}
      {isEmpleado && balance?.enVacaciones && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-500/10 border border-green-500/20 backdrop-blur-sm">
          <Car className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-[13px] font-medium text-green-600 dark:text-green-400">¡Estás de Vacaciones!</p>
            <p className="text-[11px] text-muted-foreground">Disfruta tu descanso.</p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border shadow-sm rounded-xl p-5">
              <div className="animate-pulse h-3 w-20 rounded bg-muted" />
              <div className="animate-pulse h-6 w-12 mt-2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Admin metrics */}
          {esAdmin && metrics && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Usuarios"
                value={metrics.usuarios_totales}
                subtitle={metrics.nuevos_este_mes ? `+${metrics.nuevos_este_mes} este mes` : undefined}
                icon={Users}
                color="primary"
              />
              <MetricCard
                title="Usuarios Activos"
                value={metrics.usuarios_activos}
                subtitle={metrics.usuarios_totales ? `${Math.round((metrics.usuarios_activos / metrics.usuarios_totales) * 100)}% activos` : undefined}
                icon={CheckCircle}
                color="success"
              />
              <MetricCard
                title="Pendientes"
                value={metrics.solicitudes_pendientes}
                subtitle={metrics.solicitudes_pendientes ? 'Requieren acción' : 'Todo al día'}
                icon={Hourglass}
                color="warning"
              />
              <MetricCard
                title="De Vacaciones"
                value={metrics.en_vacaciones}
                subtitle={metrics.usuarios_totales ? `${Math.round((metrics.en_vacaciones / metrics.usuarios_totales) * 100)}% del total` : undefined}
                icon={Car}
                color="info"
              />
            </div>
          )}

          {/* Jefe metrics */}
          {(esDirector || esJefe) && !esAdmin && !esRrhh && metrics && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard title="Pendientes" value={metrics.solicitudes_pendientes || 0} subtitle="Tu aprobación" icon={Clock} color="warning" />
              <MetricCard title="Aprobadas Hoy" value={metrics.aprobadas_hoy || 0} icon={CheckCircle} color="success" />
              <MetricCard title="Rechazadas Hoy" value={metrics.rechazadas_hoy || 0} icon={X} color="error" />
              <MetricCard title="Mi Equipo" value={metrics.usuarios_activos || 0} icon={Users} color="info" />
              <MetricCard title="De Vacaciones" value={metrics.en_vacaciones || 0} subtitle="De su equipo" icon={Car} color="accent" />
            </div>
          )}

          {/* RRHH metrics */}
          {esRrhh && !esAdmin && metrics && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Pendientes" value={metrics.solicitudes_pendientes || 0} subtitle="Requieren aprobación" icon={Hourglass} color="warning" />
              <MetricCard title="Aprobadas Hoy" value={metrics.aprobadas_hoy || 0} icon={CheckCircle} color="success" />
              <MetricCard title="Rechazadas Hoy" value={metrics.rechazadas_hoy || 0} icon={X} color="error" />
              <MetricCard title="Total Usuarios" value={metrics.usuarios_totales || 0} subtitle={metrics.nuevos_este_mes ? `+${metrics.nuevos_este_mes} este mes` : undefined} icon={Users} color="primary" />
            </div>
          )}

          {isEmpleado && renderMiBalancePersonal(false)}

          {!isEmpleado && renderMiBalancePersonal(true)}

          {isEmpleado && balance && (
            <div className="bg-card text-card-foreground border shadow-sm rounded-xl">
              <div className="px-5 py-3.5 border-b">
                <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Resumen de Solicitudes
                </h2>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-5 text-center">
                  <p className="text-2xl font-semibold text-orange-500">{balance.solicitudesPendientes}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Pendientes</p>
                </div>
                <div className="p-5 text-center">
                  <p className="text-2xl font-semibold text-green-500">{balance.solicitudesAprobadas}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Aprobadas</p>
                </div>
                <div className="p-5 text-center">
                  <p className="text-2xl font-semibold text-red-500">{balance.solicitudesRechazadas}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Rechazadas</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Actions + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <QuickActions session={session} />
        <ActivityFeed actividades={actividades} />
      </div>

      {/* Calendar */}
      <CalendarView
        calendario={calendario}
        mesSeleccionado={mes}
        anioSeleccionado={anio}
        onMesChange={setMes}
        onAnioChange={setAnio}
      />
    </div>
  );
}
