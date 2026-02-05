/**
 * @file types/index.ts
 * @description Exportación centralizada de todos los tipos inferidos
 * @module Types
 * @version 3.0
 * @date 5 febrero 2026
 */

// =====================================================
// TIPOS: AUTH & RBAC
// =====================================================
export type {
  Rol,
  NuevoRol,
  Permiso,
  NuevoPermiso,
  RolPermiso,
  UsuarioRol,
  NuevoUsuarioRol
} from '../schemas/auth-rbac.schema';

// =====================================================
// TIPOS: ESTRUCTURA ORGANIZACIONAL
// =====================================================
export type {
  Departamento,
  NuevoDepartamento,
  Usuario,
  NuevoUsuario
} from '../schemas/estructura-org.schema';

// =====================================================
// TIPOS: AUSENCIAS Y BALANCES
// =====================================================
export type {
  TipoAusenciaConfig,
  NuevoTipoAusenciaConfig,
  BalanceAusencia,
  NuevoBalanceAusencia
} from '../schemas/ausencias.schema';

// =====================================================
// TIPOS: SOLICITUDES
// =====================================================
export type {
  Solicitud,
  NuevaSolicitud
} from '../schemas/solicitudes.schema';

// =====================================================
// TIPOS: SISTEMA
// =====================================================
export type {
  ConfiguracionSistema,
  NuevaConfiguracionSistema,
  AuditoriaRegistro,
  NuevaAuditoria
} from '../schemas/sistema.schema';

// =====================================================
// RE-EXPORTAR ENUMS
// =====================================================
export {
  tipoAusenciaEnum,
  unidadTiempoEnum,
  estadoBalanceEnum
} from '../schemas/ausencias.schema';

export {
  estadoSolicitudEnum
} from '../schemas/solicitudes.schema';
