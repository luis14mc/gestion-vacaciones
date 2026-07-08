import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { 
  usuarios, 
  departamentos, 
  solicitudes, 
  balances,
  anosLaborales
} from '@/lib/db/schema';

// Tipos de NextAuth — sesión JWT mínima (ver SlimAuthJwt y src/auth.ts)

declare module "next-auth" {
  interface Session {
    /** Expiración absoluta (ms epoch), derivada de seguridad.sesion_duracion_horas */
    absExp?: number | null;
    user: {
      id: number;
      email: string;
      name?: string | null;
      image?: string | null;
      nombre: string;
      apellido: string;
      departamentoId: number | null;
      esDirector: boolean;
      esJefe: boolean;
      esRrhh: boolean;
      esAdmin: boolean;
    };
  }

  interface User {
    nombre: string;
    apellido: string;
    departamentoId: number | null;
    esDirector: boolean;
    esJefe: boolean;
    esRrhh: boolean;
    esAdmin: boolean;
  }
}

/** Claims persistidos en la cookie JWT (mantener mínimos). */
export interface SlimAuthJwt {
  id?: string;
  email?: string | null;
  nombre?: string;
  apellido?: string;
  departamentoId?: number | null;
  esDirector?: boolean;
  esJefe?: boolean;
  esRrhh?: boolean;
  esAdmin?: boolean;
  absExp?: number;
  name?: string;
  picture?: string;
}

// =====================================================
// TIPOS DE BASE DE DATOS
// =====================================================
export type Usuario = InferSelectModel<typeof usuarios>;
export type NuevoUsuario = InferInsertModel<typeof usuarios>;

export type Departamento = InferSelectModel<typeof departamentos>;
export type NuevoDepartamento = InferInsertModel<typeof departamentos>;

export type Solicitud = InferSelectModel<typeof solicitudes>;
export type NuevaSolicitud = InferInsertModel<typeof solicitudes>;

export type Balance = InferSelectModel<typeof balances>;
export type NuevoBalance = InferInsertModel<typeof balances>;

export type AnoLaboral = InferSelectModel<typeof anosLaborales>;
export type NuevoAnoLaboral = InferInsertModel<typeof anosLaborales>;

// Tipos de ausencia son enums en CNI, no tablas
export type TipoAusencia = 
  | 'vacaciones'
  | 'permiso_salida'
  | 'licencia_medica'
  | 'permiso_personal'
  | 'dia_cumpleanos';

// =====================================================
// TIPOS EXTENDIDOS CON RELACIONES
// =====================================================
export type UsuarioCompleto = Usuario & {
  departamento: Departamento;
  balances?: Balance[];
  solicitudes?: Solicitud[];
};

export type SolicitudCompleta = Solicitud & {
  usuario: Usuario;
  departamento?: Departamento;
};

export type BalanceCompleto = Balance & {
  usuario: Usuario;
};

// =====================================================
// TIPOS DE ENUMS (para uso en el cliente)
// =====================================================
export type EstadoSolicitud = 
  | 'borrador'
  | 'pendiente_jefe'
  | 'aprobada_jefe'
  | 'rechazada_jefe'
  | 'aprobada_rrhh'
  | 'rechazada_rrhh'
  | 'cancelada'
  | 'finalizada';

export type UnidadTiempo = 'dias' | 'horas';
export type EstadoBalance = 'activo' | 'vencido' | 'suspendido';

// =====================================================
// TIPOS DE API RESPONSES
// =====================================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// TIPOS DE SESIÓN Y AUTH
// =====================================================

/**
 * Rol del sistema RBAC
 */
export interface RolUsuario {
  codigo: string;
  nombre: string;
  nivel: number;
}

/**
 * Usuario de sesión con sistema RBAC completo
 */
export interface SessionUser {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  departamentoId?: number | null;
  departamentoNombre?: string;
  cargo?: string;
  
  // 🆕 Sistema RBAC
  roles: RolUsuario[];
  permisos: string[];
  
  esDirector: boolean;
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;

  /** El usuario debe cambiar su contraseña antes de usar el sistema */
  debeCambiarPassword?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: SessionUser;
  error?: string;
}

// =====================================================
// TIPOS PARA FORMULARIOS
// =====================================================
export interface FormularioSolicitud {
  tipoAusenciaId: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
  cantidad: number;
  unidad: UnidadTiempo;
  motivo?: string;
  observaciones?: string;
  documentosAdjuntos?: File[];
}

export interface FormularioUsuario {
  email: string;
  nombre: string;
  apellido: string;
  departamentoId: number;
  cargo?: string;
  esDirector?: boolean;
  esJefe?: boolean;
  esRrhh?: boolean;
  esAdmin?: boolean;
  jefeSuperiorId?: number;
  fechaIngreso?: string;
  fechaNacimiento?: string;
}

// =====================================================
// TIPOS DE ESTADÍSTICAS
// =====================================================
export interface EstadisticasDashboard {
  usuariosTotales: number;
  usuariosActivos: number;
  solicitudesPendientes: number;
  enVacaciones: number;
  diasDisponibles: number;
  diasUtilizados: number;
}

export interface EstadisticasDepartamento {
  departamentoId: number;
  departamentoNombre: string;
  totalUsuarios: number;
  usuariosActivos: number;
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  totalDiasUtilizados: number;
}

// =====================================================
// TIPOS DE FILTROS
// =====================================================
export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud | EstadoSolicitud[];
  tipoAusenciaId?: number;
  departamentoId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  usuarioId?: number;
  page?: number;
  pageSize?: number;
}

export interface FiltrosUsuarios {
  departamentoId?: number;
  activo?: boolean;
  esJefe?: boolean;
  esRrhh?: boolean;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}
