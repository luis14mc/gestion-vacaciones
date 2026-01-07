import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { 
  usuarios, 
  departamentos, 
  solicitudes, 
  balancesAusencias, 
  tiposAusenciaConfig,
  configuracionSistema 
} from '@/lib/db/schema';

// Tipos de NextAuth
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      nombre: string;
      apellido: string;
      departamentoId: number;
      departamentoNombre?: string;
      cargo?: string | null;
      esJefe: boolean;
      esRrhh: boolean;
      esAdmin: boolean;
    } & DefaultSession["user"];
  }
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

export type Balance = InferSelectModel<typeof balancesAusencias>;
export type NuevoBalance = InferInsertModel<typeof balancesAusencias>;

export type TipoAusenciaConfig = InferSelectModel<typeof tiposAusenciaConfig>;
export type NuevoTipoAusenciaConfig = InferInsertModel<typeof tiposAusenciaConfig>;

export type ConfiguracionSistema = InferSelectModel<typeof configuracionSistema>;
export type NuevaConfiguracionSistema = InferInsertModel<typeof configuracionSistema>;

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
  tipoAusencia: TipoAusenciaConfig;
  aprobador?: Usuario | null;
  aprobadorRrhh?: Usuario | null;
  rechazador?: Usuario | null;
  departamento?: Departamento;
};

export type BalanceCompleto = Balance & {
  usuario: Usuario;
  tipoAusencia: TipoAusenciaConfig;
  cantidadDisponible?: number;
};

// =====================================================
// TIPOS DE ENUMS (para uso en el cliente)
// =====================================================
export type EstadoSolicitud = 
  | 'borrador'
  | 'pendiente'
  | 'aprobada_jefe'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada'
  | 'en_uso';

export type TipoAusencia = 
  | 'vacaciones'
  | 'permiso_personal'
  | 'permiso_medico'
  | 'permiso_maternidad'
  | 'permiso_paternidad'
  | 'permiso_estudio'
  | 'permiso_duelo'
  | 'permiso_otro';

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
  departamentoId: number;
  departamentoNombre?: string;
  cargo?: string;
  
  // 🆕 Sistema RBAC
  roles: RolUsuario[];
  permisos: string[];
  
  // ⚠️ DEPRECATED - Mantener por compatibilidad legacy
  // Estos campos se calculan automáticamente desde roles[]
  // Se eliminarán en versión futura
  esJefe: boolean;
  esRrhh: boolean;
  esAdmin: boolean;
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
  tipoAusenciaId: number;
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
  esJefe?: boolean;
  esRrhh?: boolean;
  esAdmin?: boolean;
  fechaIngreso?: string;
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
