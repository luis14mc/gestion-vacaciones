"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  CheckCircle,
  Hourglass,
  Car,
  Shield,
  Calendar,
  Settings,
  BarChart3,
  FileText,
  Download,
  Heart,
  Bell,
  Zap,
  User,
  Briefcase,
  UsersRound,
  PenLine,
  Clock,
  Check,
  Plus,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import type { Session } from "next-auth";

interface Metrics {
  usuarios_totales: number;
  usuarios_activos: number;
  solicitudes_pendientes: number;
  en_vacaciones: number;
  nuevos_este_mes?: number;
}

interface BalancePersonal {
  diasAsignados: number;
  diasUsados: number;
  diasPendientes: number;
  diasDisponibles: number;
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesRechazadas: number;
  enVacaciones: boolean;
}

interface Actividad {
  id: string;
  tipo: "aprobada" | "nueva_solicitud" | "nuevo_usuario";
  titulo: string;
  descripcion: string;
  fecha: string;
}

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

interface DashboardClientProps {
  session: Session;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [balancePersonal, setBalancePersonal] = useState<BalancePersonal | null>(null);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [calendario, setCalendario] = useState<CalendarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());

  // Load metrics and activities
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const requests = [
          fetch("/api/dashboard/actividad"),
          fetch(`/api/dashboard/calendario?mes=${mesSeleccionado}&anio=${anioSeleccionado}`),
        ];

        // Determinar el endpoint correcto según el rol
        let metricsEndpoint = null;
        if (session.user.esAdmin) {
          metricsEndpoint = "/api/dashboard/admin/metricas";
        } else if (session.user.esJefe && !session.user.esRrhh) {
          metricsEndpoint = "/api/dashboard/jefe/metricas";
        } else if (session.user.esRrhh && !session.user.esAdmin) {
          metricsEndpoint = "/api/dashboard/rrhh/metricas";
        } else {
          // Empleado regular - cargar balance personal
          metricsEndpoint = "/api/dashboard/mi-balance";
        }

        requests.unshift(fetch(metricsEndpoint));

        // RRHH también necesita su balance personal
        if (session.user.esRrhh && !session.user.esAdmin) {
          requests.push(fetch("/api/dashboard/mi-balance"));
        }

        const responses = await Promise.all(requests);
        
        // Procesar respuesta según el tipo de usuario
        const isEmpleado = !session.user.esAdmin && !session.user.esJefe && !session.user.esRrhh;
        
        if (isEmpleado) {
          const balanceData = await responses[0].json();
          if (balanceData.success) {
            setBalancePersonal(balanceData.data);
          } else {
            console.error("Error cargando balance personal:", balanceData.error);
          }
        } else {
          const metricsData = await responses[0].json();
          if (metricsData.success) {
            setMetrics(metricsData.data);
          } else {
            console.error("Error cargando métricas:", metricsData.error);
            setMetrics({
              usuarios_totales: 0,
              usuarios_activos: 0,
              solicitudes_pendientes: 0,
              en_vacaciones: 0,
            });
          }
          
          // Si es RRHH, cargar también su balance personal
          if (session.user.esRrhh && !session.user.esAdmin && responses.length > 3) {
            const balanceData = await responses[3].json();
            if (balanceData.success) {
              setBalancePersonal(balanceData.data);
            }
          }
        }

        const actividadData = await responses[1].json();
        const calendarioData = await responses[2].json();

        if (actividadData.success) {
          setActividades(actividadData.data);
        }

        if (calendarioData.success) {
          setCalendario(calendarioData.data);
        }
      } catch (error) {
        console.error("Error al cargar datos:", error);
        if (session.user.esAdmin || session.user.esJefe || session.user.esRrhh) {
          setMetrics({
            usuarios_totales: 0,
            usuarios_activos: 0,
            solicitudes_pendientes: 0,
            en_vacaciones: 0,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Recargar calendario cuando cambie mes/año
  useEffect(() => {
    const cargarCalendario = async () => {
      try {
        const res = await fetch(`/api/dashboard/calendario?mes=${mesSeleccionado}&anio=${anioSeleccionado}`);
        const data = await res.json();
        if (data.success) {
          setCalendario(data.data);
        }
      } catch (error) {
        console.error("Error cargando calendario:", error);
      }
    };

    if (mesSeleccionado && anioSeleccionado) {
      cargarCalendario();
    }
  }, [mesSeleccionado, anioSeleccionado]);

  const isAdmin = session.user.esAdmin;
  const isJefe = session.user.esJefe;
  const isRrhh = session.user.esRrhh;
  
  // Helper para obtener el rol
  const getRoleIcon = () => {
    if (session.user.esAdmin) return Shield;
    if (session.user.esRrhh) return UsersRound;
    if (session.user.esJefe) return Briefcase;
    return User;
  };

  const getRoleLabel = () => {
    if (session.user.esAdmin) return "Admin";
    if (session.user.esRrhh) return "RRHH";
    if (session.user.esJefe) return "Jefe";
    return "Empleado";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg border-b border-base-300">
        <div className="flex-1">
          <button className="btn btn-ghost gap-3">
            <div className="flex items-center">
              <Image
                src="/assets/logo/logo.png"
                alt="CNI Honduras"
                width={60}
                height={34}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-primary font-bold text-lg leading-tight">Vacaciones</span>
              {isAdmin && <span className="text-[10px] text-accent font-semibold">PANEL ADMIN</span>}
            </div>
          </button>
        </div>
        <div className="flex-none gap-2">
          <div className="flex items-center gap-4 mr-4">
            <div className="text-right">
              <p className="text-sm font-semibold">{session.user.nombre} {session.user.apellido}</p>
              <p className="text-xs text-base-content/60 flex items-center gap-1">
                {(() => {
                  const Icon = getRoleIcon();
                  return <Icon className="w-3 h-3" />;
                })()}
                <span>{getRoleLabel()}</span>
                {session.user.departamentoNombre && <span> - {session.user.departamentoNombre}</span>}
              </p>
            </div>
          </div>
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                {(() => {
                  const Icon = getRoleIcon();
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
            </button>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li className="menu-title">{session.user.nombre} {session.user.apellido}</li>
              <li>
                <button className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Mi Perfil</span>
                </button>
              </li>
              <li>
                <button className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Configuración</span>
                </button>
              </li>
              <li>
                <LogoutButton className="" />
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        {/* Breadcrumbs */}
        <div className="text-sm breadcrumbs mb-4">
          <ul>
            <li><button>Inicio</button></li>
            <li>Dashboard</li>
          </ul>
        </div>

        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content">Dashboard</h1>
          <p className="text-base-content/60">
            {isAdmin ? "Control total del sistema de gestión de vacaciones" : "Resumen general del sistema de vacaciones"}
          </p>
        </div>

        {/* Admin/Jefe/RRHH Banners */}
        {isAdmin && (
          <div className="alert bg-gradient-to-r from-primary to-secondary text-white shadow-lg mb-6">
            <Shield className="w-8 h-8" />
            <div>
              <h3 className="font-bold text-lg">Panel de Administración</h3>
              <div className="text-sm opacity-90">Acceso completo a todas las funcionalidades del sistema</div>
            </div>
          </div>
        )}
        
        {isJefe && !isAdmin && !isRrhh && (
          <div className="alert bg-gradient-to-r from-info to-info/80 text-white shadow-lg mb-6">
            <Briefcase className="w-8 h-8" />
            <div>
              <h3 className="font-bold text-lg">Panel de Jefe de Departamento</h3>
              <div className="text-sm opacity-90">Gestiona y aprueba las solicitudes de tu equipo</div>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="skeleton h-4 w-20"></div>
                  <div className="skeleton h-8 w-16 mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : isAdmin ? (
          // ADMIN ENHANCED METRICS
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card bg-base-100 shadow-xl border-l-4 border-primary hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-primary">{metrics?.usuarios_totales}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Total Usuarios</p>
                    {metrics?.nuevos_este_mes ? (
                      <p className="text-xs text-success">+{metrics.nuevos_este_mes} este mes</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-success hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-success to-success/70 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-success">{metrics?.usuarios_activos}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Usuarios Activos</p>
                    {metrics?.usuarios_totales && metrics?.usuarios_activos ? (
                      <p className="text-xs text-success">
                        {Math.round((metrics.usuarios_activos / metrics.usuarios_totales) * 100)}% activos
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-warning hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-warning to-warning/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Hourglass className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-warning">{metrics?.solicitudes_pendientes}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Pendientes</p>
                    {metrics?.solicitudes_pendientes ? (
                      <p className="text-xs text-warning">Requieren acción</p>
                    ) : (
                      <p className="text-xs text-base-content/50">Todo al día</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-info hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-info to-info/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Car className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-info">{metrics?.en_vacaciones}</h3>
                    <p className="text-sm text-base-content/60 font-medium">De Vacaciones</p>
                    {metrics?.usuarios_totales && metrics?.en_vacaciones ? (
                      <p className="text-xs text-info">
                        {Math.round((metrics.en_vacaciones / metrics.usuarios_totales) * 100)}% del total
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : isJefe && !isRrhh ? (
          // JEFE METRICS - Solo 3 tarjetas enfocadas en su departamento
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="card bg-base-100 shadow-xl border-l-4 border-warning hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Solicitudes Pendientes</h2>
                    <p className="text-4xl font-bold text-warning mt-2">{metrics?.solicitudes_pendientes || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Requieren tu aprobación</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-info hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Mi Equipo</h2>
                    <p className="text-4xl font-bold text-info mt-2">{metrics?.usuarios_activos || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-info" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Personas a cargo</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-accent hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">De Vacaciones Hoy</h2>
                    <p className="text-4xl font-bold text-accent mt-2">{metrics?.en_vacaciones || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Car className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Del departamento</div>
              </div>
            </div>
          </div>
        ) : isRrhh && !isAdmin ? (
          // RRHH METRICS - Similar a Admin, vista global
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card bg-base-100 shadow-xl border-l-4 border-primary hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-primary">{metrics?.usuarios_totales}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Total Usuarios</p>
                    {metrics?.nuevos_este_mes ? (
                      <p className="text-xs text-success">+{metrics.nuevos_este_mes} este mes</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-success hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-success to-success/70 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-success">{metrics?.usuarios_activos}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Usuarios Activos</p>
                    {metrics?.usuarios_totales && metrics?.usuarios_activos ? (
                      <p className="text-xs text-success">
                        {Math.round((metrics.usuarios_activos / metrics.usuarios_totales) * 100)}% activos
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-warning hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-warning to-warning/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Hourglass className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-warning">{metrics?.solicitudes_pendientes}</h3>
                    <p className="text-sm text-base-content/60 font-medium">Pendientes</p>
                    {metrics?.solicitudes_pendientes ? (
                      <p className="text-xs text-warning">Requieren acción</p>
                    ) : (
                      <p className="text-xs text-base-content/50">Todo al día</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-info hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-info to-info/70 rounded-xl flex items-center justify-center shadow-lg">
                    <Car className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-bold text-info">{metrics?.en_vacaciones}</h3>
                    <p className="text-sm text-base-content/60 font-medium">De Vacaciones</p>
                    {metrics?.usuarios_totales && metrics?.en_vacaciones ? (
                      <p className="text-xs text-info">
                        {Math.round((metrics.en_vacaciones / metrics.usuarios_totales) * 100)}% del total
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !isAdmin && !isJefe && !isRrhh ? (
          // EMPLEADO METRICS - Balance personal de vacaciones
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card bg-base-100 shadow-xl border-l-4 border-primary hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Días Asignados</h2>
                    <p className="text-4xl font-bold text-primary mt-2">{balancePersonal?.diasAsignados || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Total este año</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-success hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Días Disponibles</h2>
                    <p className="text-4xl font-bold text-success mt-2">{balancePersonal?.diasDisponibles || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Puedes solicitar</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-error hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Días Usados</h2>
                    <p className="text-4xl font-bold text-error mt-2">{balancePersonal?.diasUsados || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
                    <Car className="w-6 h-6 text-error" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">
                  {balancePersonal?.diasAsignados ? 
                    `${Math.round((balancePersonal.diasUsados / balancePersonal.diasAsignados) * 100)}% utilizado` : 
                    '0% utilizado'}
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border-l-4 border-warning hover:shadow-2xl transition-all">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Pendientes</h2>
                    <p className="text-4xl font-bold text-warning mt-2">{balancePersonal?.solicitudesPendientes || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Hourglass className="w-6 h-6 text-warning" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">
                  {balancePersonal?.diasPendientes || 0} días por aprobar
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* RRHH - Balance Personal */}
        {isRrhh && !isAdmin && balancePersonal && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Mi Balance de Vacaciones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-base-100 shadow-xl border-l-4 border-primary">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-base-content/60">Días Asignados</h2>
                      <p className="text-3xl font-bold text-primary mt-2">{balancePersonal.diasAsignados || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-xs text-base-content/50 mt-2">Total este año</div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl border-l-4 border-success">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-base-content/60">Días Disponibles</h2>
                      <p className="text-3xl font-bold text-success mt-2">{balancePersonal.diasDisponibles || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-success" />
                    </div>
                  </div>
                  <div className="text-xs text-base-content/50 mt-2">Puedo solicitar</div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl border-l-4 border-error">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-base-content/60">Días Usados</h2>
                      <p className="text-3xl font-bold text-error mt-2">{balancePersonal.diasUsados || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
                      <Car className="w-6 h-6 text-error" />
                    </div>
                  </div>
                  <div className="text-xs text-base-content/50 mt-2">
                    {balancePersonal.diasAsignados ? 
                      `${Math.round((balancePersonal.diasUsados / balancePersonal.diasAsignados) * 100)}% utilizado` : 
                      '0% utilizado'}
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl border-l-4 border-warning">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-base-content/60">Mis Solicitudes Pendientes</h2>
                      <p className="text-3xl font-bold text-warning mt-2">{balancePersonal.solicitudesPendientes || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Hourglass className="w-6 h-6 text-warning" />
                    </div>
                  </div>
                  <div className="text-xs text-base-content/50 mt-2">En revisión</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empleado Alert - Si está de vacaciones */}
        {!isAdmin && !isJefe && !isRrhh && balancePersonal?.enVacaciones && (
          <div className="alert bg-gradient-to-r from-success to-success/80 text-white shadow-lg mb-6">
            <Car className="w-8 h-8" />
            <div>
              <h3 className="font-bold text-lg">¡Estás de Vacaciones!</h3>
              <div className="text-sm opacity-90">Disfruta tu descanso. Tienes una solicitud activa en curso.</div>
            </div>
          </div>
        )}

        {/* Empleado - Resumen de Solicitudes */}
        {!isAdmin && !isJefe && !isRrhh && balancePersonal && (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title text-xl mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Resumen de Solicitudes (Este Año)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat bg-base-200 rounded-lg">
                  <div className="stat-figure text-warning">
                    <Hourglass className="w-8 h-8" />
                  </div>
                  <div className="stat-title">Pendientes</div>
                  <div className="stat-value text-warning">{balancePersonal.solicitudesPendientes}</div>
                  <div className="stat-desc">En proceso de aprobación</div>
                </div>
                <div className="stat bg-base-200 rounded-lg">
                  <div className="stat-figure text-success">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="stat-title">Aprobadas</div>
                  <div className="stat-value text-success">{balancePersonal.solicitudesAprobadas}</div>
                  <div className="stat-desc">Vacaciones disfrutadas</div>
                </div>
                <div className="stat bg-base-200 rounded-lg">
                  <div className="stat-figure text-error">
                    <Hourglass className="w-8 h-8" />
                  </div>
                  <div className="stat-title">Rechazadas</div>
                  <div className="stat-value text-error">{balancePersonal.solicitudesRechazadas}</div>
                  <div className="stat-desc">No aprobadas</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-accent" />
                Acciones Administrativas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/solicitudes" className="btn btn-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Ver Solicitudes
                </Link>
                <Link href="/usuarios" className="btn btn-lg bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Users className="w-5 h-5" />
                  Gestionar Usuarios
                </Link>
                <Link href="/asignacion-dias" className="btn btn-lg bg-gradient-to-r from-accent to-accent/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Calendar className="w-5 h-5" />
                  Asignar Días
                </Link>
                <Link href="/configuracion" className="btn btn-lg bg-gradient-to-r from-secondary to-secondary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Settings className="w-5 h-5" />
                  Configuración
                </Link>
                <Link href="/reportes" className="btn btn-lg bg-gradient-to-r from-info to-info/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <BarChart3 className="w-5 h-5" />
                  Reportes Avanzados
                </Link>
                <Link href="/auditoria" className="btn btn-lg bg-gradient-to-r from-warning to-warning/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Auditoría
                </Link>
                <Link href="/exportar" className="btn btn-lg bg-gradient-to-r from-success to-success/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Download className="w-5 h-5" />
                  Exportar Datos
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* RRHH Actions */}
        {isRrhh && !isAdmin && (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-accent" />
                Acciones de Recursos Humanos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/solicitudes" className="btn btn-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Gestionar Solicitudes
                </Link>
                <Link href="/usuarios" className="btn btn-lg bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Users className="w-5 h-5" />
                  Gestionar Usuarios
                </Link>
                <Link href="/asignacion-dias" className="btn btn-lg bg-gradient-to-r from-accent to-accent/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Calendar className="w-5 h-5" />
                  Asignar Días de Vacaciones
                </Link>
                <Link href="/reportes" className="btn btn-lg bg-gradient-to-r from-info to-info/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <BarChart3 className="w-5 h-5" />
                  Reportes del Sistema
                </Link>
                <Link href="/aprobar-solicitudes" className="btn btn-lg bg-gradient-to-r from-warning to-warning/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Clock className="w-5 h-5" />
                  Aprobar Solicitudes
                </Link>
                <Link href="/exportar" className="btn btn-lg bg-gradient-to-r from-success to-success/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Download className="w-5 h-5" />
                  Exportar Datos
                </Link>
                <Link href="/solicitudes" className="btn btn-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Mis Solicitudes
                </Link>
                <Link href="/solicitudes/nueva" className="btn btn-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:scale-105 transition-transform shadow-lg">
                  <Plus className="w-5 h-5" />
                  Nueva Solicitud
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Jefe Actions */}
        {isJefe && !isAdmin && !isRrhh && (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-info" />
                Acciones de Jefe
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/aprobar-solicitudes" className="btn btn-lg bg-gradient-to-r from-warning to-warning/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Clock className="w-5 h-5" />
                  Aprobar Solicitudes
                </Link>
                <Link href="/solicitudes" className="btn btn-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Mis Solicitudes
                </Link>
                <Link href="/mi-equipo" className="btn btn-lg bg-gradient-to-r from-info to-info/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Users className="w-5 h-5" />
                  Ver Mi Equipo
                </Link>
                <Link href="/reportes-departamento" className="btn btn-lg bg-gradient-to-r from-secondary to-secondary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <BarChart3 className="w-5 h-5" />
                  Reportes del Departamento
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* System Health - Admin Only */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                  <Heart className="w-5 h-5 text-success" />
                  Estado del Sistema
                </h2>
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Base de Datos</span>
                    <div className="badge badge-success gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      Operativa
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Servidor</span>
                    <div className="badge badge-success gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      En línea
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Respaldos</span>
                    <div className="badge badge-info">Último: Hoy 02:00</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">Rendimiento</span>
                    <div className="badge badge-success">Excelente</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                  <Bell className="w-5 h-5 text-warning" />
                  Alertas Recientes
                </h2>
                <div className="space-y-3 mt-4">
                  <div className="alert alert-warning py-2">
                    <Hourglass className="w-4 h-4" />
                    <span className="text-sm">8 solicitudes pendientes de aprobación</span>
                  </div>
                  <div className="alert alert-info py-2">
                    <User className="w-4 h-4" />
                    <span className="text-sm">5 usuarios próximos a cumpleaños</span>
                  </div>
                  <div className="alert alert-success py-2">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Respaldo automático completado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Acciones Rápidas - Específicas por Rol */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning" />
                <span>Acciones Rápidas</span>
              </h2>
              
              {/* ADMIN - Acciones administrativas */}
              {isAdmin && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Link href="/solicitudes" className="btn btn-primary btn-lg gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Solicitudes</span>
                  </Link>
                  <Link href="/usuarios" className="btn btn-outline btn-primary btn-lg gap-2">
                    <Users className="w-5 h-5" />
                    <span>Usuarios</span>
                  </Link>
                  <Link href="/asignacion-dias" className="btn btn-outline btn-accent btn-lg gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>Asignar Días</span>
                  </Link>
                  <Link href="/reportes" className="btn btn-outline btn-info btn-lg gap-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Reportes</span>
                  </Link>
                </div>
              )}

              {/* JEFE - Acciones de gestión de equipo */}
              {isJefe && !isAdmin && !isRrhh && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Link href="/aprobar-solicitudes" className="btn btn-warning btn-lg gap-2">
                    <Clock className="w-5 h-5" />
                    <span>Aprobar</span>
                  </Link>
                  <Link href="/solicitudes" className="btn btn-outline btn-purple-600 btn-lg gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Mis Solicitudes</span>
                  </Link>
                  <Link href="/mi-equipo" className="btn btn-outline btn-info btn-lg gap-2">
                    <Users className="w-5 h-5" />
                    <span>Mi Equipo</span>
                  </Link>
                  <Link href="/solicitudes/nueva" className="btn btn-outline btn-primary btn-lg gap-2">
                    <PenLine className="w-5 h-5" />
                    <span>Nueva Solicitud</span>
                  </Link>
                  <Link href="/reportes-departamento" className="btn btn-outline btn-secondary btn-lg gap-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Reportes</span>
                  </Link>
                </div>
              )}

              {/* RRHH - Acciones de recursos humanos */}
              {isRrhh && !isAdmin && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Link href="/solicitudes" className="btn btn-primary btn-lg gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Solicitudes</span>
                  </Link>
                  <Link href="/usuarios" className="btn btn-outline btn-primary btn-lg gap-2">
                    <Users className="w-5 h-5" />
                    <span>Usuarios</span>
                  </Link>
                  <Link href="/asignacion-dias" className="btn btn-outline btn-accent btn-lg gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>Asignar Días</span>
                  </Link>
                  <Link href="/reportes" className="btn btn-outline btn-info btn-lg gap-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Reportes</span>
                  </Link>
                  <Link href="/solicitudes" className="btn btn-outline btn-secondary btn-lg gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Mis Solicitudes</span>
                  </Link>
                  <Link href="/solicitudes/nueva" className="btn btn-success btn-lg gap-2">
                    <Plus className="w-5 h-5" />
                    <span>Nueva Solicitud</span>
                  </Link>
                </div>
              )}

              {/* EMPLEADO - Acciones personales */}
              {!isAdmin && !isJefe && !isRrhh && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Link href="/solicitudes/nueva" className="btn btn-primary btn-lg gap-2">
                    <PenLine className="w-5 h-5" />
                    <span>Nueva Solicitud</span>
                  </Link>
                  <Link href="/solicitudes" className="btn btn-outline btn-primary btn-lg gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Mis Solicitudes</span>
                  </Link>
                  <Link href="/mi-perfil" className="btn btn-outline btn-info btn-lg gap-2">
                    <User className="w-5 h-5" />
                    <span>Mi Perfil</span>
                  </Link>
                  <Link href="/calendario" className="btn btn-outline btn-accent btn-lg gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>Calendario</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Actividad Reciente */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <Clock className="w-5 h-5 text-info" />
                <span>Actividad Reciente</span>
              </h2>
              <div className="space-y-3 mt-4">
                {actividades.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-base-content/20 mx-auto mb-2" />
                    <p className="text-base-content/60">No hay actividad reciente</p>
                    <p className="text-sm text-base-content/40">Las nuevas acciones aparecerán aquí</p>
                  </div>
                ) : (
                  actividades.map((actividad) => {
                    const getIcono = () => {
                      switch (actividad.tipo) {
                        case "aprobada":
                          return { icon: Check, color: "success" };
                        case "nueva_solicitud":
                          return { icon: Hourglass, color: "warning" };
                        case "nuevo_usuario":
                          return { icon: User, color: "info" };
                        default:
                          return { icon: Bell, color: "base-content" };
                      }
                    };

                    const { icon: IconComponent, color } = getIcono();
                    
                    // Calcular tiempo transcurrido
                    const fecha = new Date(actividad.fecha);
                    const ahora = new Date();
                    const diff = ahora.getTime() - fecha.getTime();
                    const minutos = Math.floor(diff / 60000);
                    const horas = Math.floor(minutos / 60);
                    const dias = Math.floor(horas / 24);

                    let tiempoTexto = "";
                    if (dias > 0) {
                      tiempoTexto = `Hace ${dias} día${dias > 1 ? "s" : ""}`;
                    } else if (horas > 0) {
                      tiempoTexto = `Hace ${horas} hora${horas > 1 ? "s" : ""}`;
                    } else if (minutos > 0) {
                      tiempoTexto = `Hace ${minutos} minuto${minutos > 1 ? "s" : ""}`;
                    } else {
                      tiempoTexto = "Hace un momento";
                    }

                    return (
                      <div key={actividad.id} className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                        <div className={`w-8 h-8 rounded-full bg-${color}/20 flex items-center justify-center`}>
                          <IconComponent className={`w-4 h-4 text-${color}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{actividad.titulo}</p>
                          <p className="text-xs text-base-content/60">{actividad.descripcion}</p>
                          <p className="text-xs text-base-content/40">{tiempoTexto}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Calendario */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title flex items-center gap-2">
                <Calendar className="w-6 h-6 text-primary" />
                <span>Calendario - {calendario?.nombreMes || "..."} {anioSeleccionado}</span>
              </h2>
              <div className="flex gap-2">
                <select
                  className="select select-bordered select-sm"
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleDateString("es-ES", { month: "long" })}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                >
                  {[2024, 2025, 2026].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            {!calendario ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : calendario.dias.length === 0 ? (
              <div className="bg-base-200 rounded-lg p-8 text-center">
                <Calendar className="w-16 h-16 text-base-content/20 mb-4 mx-auto" />
                <p className="text-base text-base-content/60">No hay vacaciones programadas</p>
              </div>
            ) : (
              <>
                {/* Estadísticas del mes */}
                {calendario.estadisticas.totalSolicitudes > 0 && (
                  <div className="flex gap-3 mb-4">
                    <div className="badge badge-primary gap-2">
                      <Calendar className="w-4 h-4" />
                      {calendario.estadisticas.totalDiasConVacaciones} días con vacaciones
                    </div>
                    <div className="badge badge-secondary gap-2">
                      <Users className="w-4 h-4" />
                      {calendario.estadisticas.usuariosEnVacaciones} usuarios
                    </div>
                  </div>
                )}

                {/* Calendario */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Headers */}
                  {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((dia, i) => (
                    <div key={dia} className={`text-center font-bold text-sm py-2 ${i === 0 || i === 6 ? "text-error" : "text-base-content/70"}`}>
                      {dia}
                    </div>
                  ))}

                  {/* Días vacíos al inicio */}
                  {calendario.dias.length > 0 && Array.from({ length: calendario.dias[0].diaSemana }).map((_, i) => (
                    <div key={`empty-${i}`}></div>
                  ))}

                  {/* Días del mes */}
                  {calendario.dias.map((dia) => (
                    <div
                      key={dia.fecha}
                      className={`
                        h-14 rounded-lg flex flex-col items-center justify-center border-2 cursor-default
                        ${dia.tieneVacaciones ? "border-primary bg-primary/20 font-bold shadow-md" : "border-base-300"}
                        ${dia.esFinde ? "bg-base-200/70" : ""}
                        ${dia.solicitudes.length > 0 ? "cursor-pointer hover:border-primary hover:shadow-lg transition-all" : ""}
                      `}
                      title={dia.solicitudes.length > 0 ? dia.solicitudes.map(s => s.usuario).join("\n") : ""}
                    >
                      <div className={`text-base font-semibold ${dia.esFinde ? "text-error" : ""} ${dia.tieneVacaciones ? "text-primary font-bold" : ""}`}>
                        {dia.dia}
                      </div>
                      {dia.solicitudes.length > 0 && (
                        <div className="text-xs text-primary font-semibold mt-1">
                          {dia.solicitudes.length} 👤
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Leyenda */}
                <div className="flex gap-6 mt-4 text-sm justify-center text-base-content/60">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary bg-primary/20 rounded"></div>
                    <span>Días con vacaciones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-base-200/70 border-2 border-base-300 rounded"></div>
                    <span>Fin de semana</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
