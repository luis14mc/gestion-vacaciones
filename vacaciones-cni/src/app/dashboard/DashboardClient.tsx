"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import type { Session } from "next-auth";

interface Metrics {
  usuarios_totales: number;
  usuarios_activos: number;
  solicitudes_pendientes: number;
  en_vacaciones: number;
}

interface DashboardClientProps {
  session: Session;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Load metrics
  useEffect(() => {
    // Simulamos métricas por ahora (luego conectaremos a la API)
    setTimeout(() => {
      setMetrics({
        usuarios_totales: 45,
        usuarios_activos: 42,
        solicitudes_pendientes: 8,
        en_vacaciones: 5,
      });
      setLoading(false);
    }, 500);
  }, []);

  const isAdmin = session.user.esAdmin;
  
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

        {/* Admin Banner */}
        {isAdmin && (
          <div className="alert bg-gradient-to-r from-primary to-secondary text-white shadow-lg mb-6">
            <Shield className="w-8 h-8" />
            <div>
              <h3 className="font-bold text-lg">Panel de Administración</h3>
              <div className="text-sm opacity-90">Acceso completo a todas las funcionalidades del sistema</div>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
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
                    <p className="text-xs text-success">+12 este mes</p>
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
                    <p className="text-xs text-success">93% activos</p>
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
                    <p className="text-xs text-warning">Requieren acción</p>
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
                    <p className="text-xs text-info">11% del total</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // REGULAR USER METRICS
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="card bg-base-100 border-l-4 border-primary shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Total Usuarios</h2>
                    <p className="text-4xl font-bold text-primary mt-2">{metrics?.usuarios_totales}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">+3 este mes</div>
              </div>
            </div>

            <div className="card bg-base-100 border-l-4 border-secondary shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Usuarios Activos</h2>
                    <p className="text-4xl font-bold text-secondary mt-2">{metrics?.usuarios_activos}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-secondary" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">93% del total</div>
              </div>
            </div>

            <div className="card bg-base-100 border-l-4 border-warning shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">Pendientes</h2>
                    <p className="text-4xl font-bold text-warning mt-2">{metrics?.solicitudes_pendientes}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Hourglass className="w-6 h-6 text-warning" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Requieren acción</div>
              </div>
            </div>

            <div className="card bg-base-100 border-l-4 border-accent shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-base-content/60">En Vacaciones</h2>
                    <p className="text-4xl font-bold text-accent mt-2">{metrics?.en_vacaciones}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Car className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="text-xs text-base-content/50 mt-2">Hoy</div>
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
                <a href="/usuarios" className="btn btn-lg bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Users className="w-5 h-5" />
                  Gestionar Usuarios
                </a>
                <a href="/asignacion-dias" className="btn btn-lg bg-gradient-to-r from-accent to-accent/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Calendar className="w-5 h-5" />
                  Asignar Días
                </a>
                <a href="/configuracion" className="btn btn-lg bg-gradient-to-r from-secondary to-secondary/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Settings className="w-5 h-5" />
                  Configuración
                </a>
                <button className="btn btn-lg bg-gradient-to-r from-info to-info/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <BarChart3 className="w-5 h-5" />
                  Reportes Avanzados
                </button>
                <button className="btn btn-lg bg-gradient-to-r from-warning to-warning/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <FileText className="w-5 h-5" />
                  Auditoría
                </button>
                <button className="btn btn-lg bg-gradient-to-r from-success to-success/80 text-white hover:scale-105 transition-transform shadow-lg">
                  <Download className="w-5 h-5" />
                  Exportar Datos
                </button>
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
          {/* Acciones Rápidas */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning" />
                <span>Acciones Rápidas</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <a href="/solicitudes/nueva" className="btn btn-primary btn-lg gap-2">
                  <PenLine className="w-5 h-5" />
                  <span>Nueva Solicitud</span>
                </a>
                <a href="/solicitudes" className="btn btn-outline btn-lg gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Ver Solicitudes</span>
                </a>
                <a href="/usuarios" className="btn btn-outline btn-lg gap-2">
                  <Users className="w-5 h-5" />
                  <span>Usuarios</span>
                </a>
                <a href="/reportes" className="btn btn-outline btn-lg gap-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Reportes</span>
                </a>
              </div>
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
                <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Solicitud Aprobada</p>
                    <p className="text-xs text-base-content/60">Juan Pérez - 5 días (Nov 1-5)</p>
                    <p className="text-xs text-base-content/40">Hace 2 horas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                    <Hourglass className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Nueva Solicitud</p>
                    <p className="text-xs text-base-content/60">María González - 3 días (Nov 10-12)</p>
                    <p className="text-xs text-base-content/40">Hace 4 horas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-info" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Nuevo Usuario</p>
                    <p className="text-xs text-base-content/60">Carlos Ramírez - Departamento IT</p>
                    <p className="text-xs text-base-content/40">Hace 1 día</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendario */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Calendario de Vacaciones - Enero 2025</span>
            </h2>
            <div className="mt-4 bg-base-200 rounded-lg p-8 text-center">
              <Calendar className="w-16 h-16 text-base-content/20 mb-4 mx-auto" />
              <p className="text-base-content/60">Vista de calendario próximamente...</p>
              <p className="text-sm text-base-content/40 mt-2">Aquí se mostrará un calendario interactivo con las vacaciones programadas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
