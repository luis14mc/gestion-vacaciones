'use client';

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from 'react';
import type { Session } from 'next-auth';
import {
  Activity,
  AlertCircle,
  Calendar,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { notify } from '@/lib/swal';
import { formatDateTime } from '@/lib/utils/date-format';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { labelAccion, labelEvento } from '@/lib/domain/auditoria/labels';
import { parseDetallesAuditoria } from '@/lib/domain/auditoria/sanitize';

interface RegistroAuditoria {
  id: number;
  usuario_id: number;
  accion: string;
  tabla_afectada: string;
  registro_id: number | null;
  detalles: string | null;
  ip_address: string | null;
  user_agent: string | null;
  fecha_creacion: string;
  evento: string | null;
  modulo: string | null;
  severidad: string | null;
  resultado: string | null;
  entidad_nombre: string | null;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
  };
}

interface ResumenAuditoria {
  totalRegistrosFiltrados: number;
  totalRegistrosGlobal: number;
  accionesHoy: number;
  accionesUltimas24h: number;
  usuariosUnicos: number;
  eventosCriticos: number;
  loginFallidos: number;
  cambiosConfiguracion: number;
  cambiosBalances: number;
  exportacionesReportes: number;
}

export default function AuditoriaClient({ session }: { session: Session }) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [resumen, setResumen] = useState<ResumenAuditoria | null>(null);
  const [selectedLog, setSelectedLog] = useState<RegistroAuditoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [consultadoEn, setConsultadoEn] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('all');
  const [filtroTabla, setFiltroTabla] = useState('all');
  const [filtroEvento, setFiltroEvento] = useState('all');
  const [filtroModulo, setFiltroModulo] = useState('all');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [email, setEmail] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [registroId, setRegistroId] = useState('');

  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const limite = 50;

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({
      pagina: String(paginaActual),
      limite: String(limite),
    });
    if (q.trim()) params.set('q', q.trim());
    if (filtroAccion !== 'all') params.set('accion', filtroAccion);
    if (filtroTabla !== 'all') params.set('tabla', filtroTabla);
    if (filtroEvento !== 'all') params.set('evento', filtroEvento);
    if (filtroModulo !== 'all') params.set('modulo', filtroModulo);
    if (fechaInicio) params.set('fechaInicio', fechaInicio);
    if (fechaFin) params.set('fechaFin', fechaFin);
    if (email.trim()) params.set('email', email.trim());
    if (ipAddress.trim()) params.set('ipAddress', ipAddress.trim());
    if (registroId.trim()) params.set('registroId', registroId.trim());
    return params;
  }, [
    paginaActual,
    q,
    filtroAccion,
    filtroTabla,
    filtroEvento,
    filtroModulo,
    fechaInicio,
    fechaFin,
    email,
    ipAddress,
    registroId,
  ]);

  const cargarRegistros = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/auditoria?${buildParams().toString()}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.success) {
        setRegistros(data.data || []);
        setResumen(data.resumen || null);
        setTotalPaginas(data.totalPaginas || 1);
        setTotalFiltrado(data.total ?? 0);
        setConsultadoEn(data.meta?.generadoEn ?? new Date().toISOString());
      } else {
        notify.error('Error', data.error || 'Error al cargar auditoría');
      }
    } catch (error) {
      console.error(error);
      notify.error('Error', 'Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  const aplicarFiltros = () => {
    setPaginaActual(1);
    void cargarRegistros();
  };

  const limpiarFiltros = () => {
    setQ('');
    setFiltroAccion('all');
    setFiltroTabla('all');
    setFiltroEvento('all');
    setFiltroModulo('all');
    setFechaInicio('');
    setFechaFin('');
    setEmail('');
    setIpAddress('');
    setRegistroId('');
    setPaginaActual(1);
  };

  const exportarCsv = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/auditoria/exportar?${buildParams().toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Error al exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify.error('Error', error instanceof Error ? error.message : 'Error al exportar');
    } finally {
      setExportLoading(false);
    }
  };

  const detallesModal = selectedLog ? parseDetallesAuditoria(selectedLog.detalles) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Auditoría del Sistema
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Bitácora institucional · solo administradores · datos desde PostgreSQL
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
          <Button variant="outline" size="sm" onClick={cargarRegistros} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={exportLoading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setExportLoading(true);
              try {
                const params = buildParams();
                params.set('formato', 'xlsx');
                const res = await fetch(`/api/auditoria/exportar?${params.toString()}`);
                if (!res.ok) throw new Error('Error al exportar Excel');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `auditoria_${Date.now()}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                notify.error('Error', error instanceof Error ? error.message : 'Error al exportar');
              } finally {
                setExportLoading(false);
              }
            }}
            disabled={exportLoading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {resumen ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            title="Filtrados"
            value={resumen.totalRegistrosFiltrados}
            subtitle={`Global: ${resumen.totalRegistrosGlobal}`}
            icon={Activity}
          />
          <MetricCard title="Hoy (HN)" value={resumen.accionesHoy} icon={Clock} />
          <MetricCard title="Últimas 24h" value={resumen.accionesUltimas24h} icon={Calendar} />
          <MetricCard title="Usuarios únicos" value={resumen.usuariosUnicos} icon={Users} />
          <MetricCard title="Críticos" value={resumen.eventosCriticos} icon={AlertCircle} />
          <MetricCard title="Login fallidos" value={resumen.loginFallidos} icon={Shield} />
          <MetricCard title="Configuración" value={resumen.cambiosConfiguracion} icon={FileText} />
          <MetricCard title="Balances" value={resumen.cambiosBalances} icon={Activity} />
          <MetricCard title="Exportaciones" value={resumen.exportacionesReportes} icon={Download} />
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros avanzados
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label>Búsqueda (q)</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Usuario, email, acción, tabla, IP, detalles..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
              />
            </div>
          </div>
          <FilterSelect
            label="Acción"
            value={filtroAccion}
            onChange={setFiltroAccion}
            options={[
              ['all', 'Todas'],
              ['crear', 'Crear'],
              ['actualizar', 'Actualizar'],
              ['eliminar', 'Eliminar'],
              ['login', 'Login'],
              ['login_fallido', 'Login fallido'],
              ['logout', 'Logout'],
            ]}
          />
          <FilterSelect
            label="Tabla"
            value={filtroTabla}
            onChange={setFiltroTabla}
            options={[
              ['all', 'Todas'],
              ['usuarios', 'Usuarios'],
              ['solicitudes', 'Solicitudes'],
              ['balances', 'Balances'],
              ['departamentos', 'Departamentos'],
              ['configuracion', 'Configuración'],
              ['reportes', 'Reportes'],
              ['auditoria', 'Auditoría'],
            ]}
          />
          <FilterSelect
            label="Evento"
            value={filtroEvento}
            onChange={setFiltroEvento}
            options={[
              ['all', 'Todos'],
              ['login_exitoso', 'Login exitoso'],
              ['login_fallido', 'Login fallido'],
              ['exportar_reporte', 'Exportar reporte'],
              ['exportar_auditoria', 'Exportar auditoría'],
              ['actualizar_configuracion', 'Actualizar configuración'],
              ['crear_solicitud', 'Crear solicitud'],
              ['importar_usuarios', 'Importar usuarios'],
            ]}
          />
          <FilterSelect
            label="Módulo"
            value={filtroModulo}
            onChange={setFiltroModulo}
            options={[
              ['all', 'Todos'],
              ['seguridad', 'Seguridad'],
              ['usuarios', 'Usuarios'],
              ['solicitudes', 'Solicitudes'],
              ['balances', 'Balances'],
              ['configuracion', 'Configuración'],
              ['reportes', 'Reportes'],
              ['auditoria', 'Auditoría'],
            ]}
          />
          <DateField label="Fecha inicio" value={fechaInicio} onChange={setFechaInicio} />
          <DateField label="Fecha fin" value={fechaFin} onChange={setFechaFin} />
          <TextField label="Email" value={email} onChange={setEmail} />
          <TextField label="IP" value={ipAddress} onChange={setIpAddress} />
          <TextField label="Registro ID" value={registroId} onChange={setRegistroId} />
        </div>
        <div className="mt-4">
          <Button onClick={aplicarFiltros} disabled={loading}>
            Aplicar filtros
          </Button>
        </div>
      </div>

      {consultadoEn ? (
        <p className="text-xs text-muted-foreground">
          {totalFiltrado} registros filtrados · consulta{' '}
          {formatDateTime(consultadoEn)} · sesión{' '}
          {session.user.email}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando auditoría…</div>
        ) : registros.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Sin datos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(registro.fecha_creacion)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {registro.usuario.nombre} {registro.usuario.apellido}
                      </div>
                      <div className="text-xs text-muted-foreground">{registro.usuario.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{labelAccion(registro.accion)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{labelEvento(registro.evento)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{registro.tabla_afectada}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{registro.registro_id ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{registro.ip_address ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(registro)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPaginas > 1 ? (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaActual <= 1}
            onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm self-center">
            Página {paginaActual} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      ) : null}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de auditoría</DialogTitle>
          </DialogHeader>
          {selectedLog ? (
            <div className="space-y-5 text-sm">
              <Section title="Datos generales">
                <Row label="Acción" value={labelAccion(selectedLog.accion)} />
                <Row label="Evento" value={labelEvento(selectedLog.evento)} />
                <Row label="Módulo" value={selectedLog.modulo ?? '—'} />
                <Row label="Fecha" value={formatDateTime(selectedLog.fecha_creacion)} />
                <Row label="Resultado" value={selectedLog.resultado ?? '—'} />
                <Row label="Severidad" value={selectedLog.severidad ?? '—'} />
              </Section>
              <Section title="Actor">
                <Row
                  label="Usuario"
                  value={`${selectedLog.usuario.nombre} ${selectedLog.usuario.apellido}`}
                />
                <Row label="Email" value={selectedLog.usuario.email} />
              </Section>
              <Section title="Entidad afectada">
                <Row label="Tabla" value={selectedLog.tabla_afectada} />
                <Row label="Registro ID" value={String(selectedLog.registro_id ?? 'N/A')} />
                <Row label="Entidad" value={selectedLog.entidad_nombre ?? '—'} />
              </Section>
              <Section title="Detalles técnicos">
                {detallesModal?.parsed ? (
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto border">
                    {JSON.stringify(detallesModal.parsed, null, 2)}
                  </pre>
                ) : detallesModal?.textoPlano ? (
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto border whitespace-pre-wrap">
                    {detallesModal.textoPlano}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">Sin detalles adicionales.</p>
                )}
              </Section>
              <Section title="IP / navegador">
                <Row label="IP" value={selectedLog.ip_address ?? 'N/A'} mono />
                <Row label="User Agent" value={selectedLog.user_agent ?? 'N/A'} />
              </Section>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {subtitle ? <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([val, text]) => (
            <SelectItem key={val} value={val}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs break-all' : 'break-words'}>{value}</span>
    </div>
  );
}
