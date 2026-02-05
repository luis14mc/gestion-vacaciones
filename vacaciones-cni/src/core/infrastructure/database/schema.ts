/**
 * @file schema.ts
 * @description Exportación centralizada del schema modular
 * @version 3.0 - Refactorizado a arquitectura atómica
 * @date 5 febrero 2026
 * 
 * BREAKING CHANGES (v3.0):
 * - Schema dividido en 5 módulos atómicos por Bounded Context
 * - Enums exportados desde sus respectivos módulos funcionales
 * - Mantiene 100% compatibilidad con imports existentes
 * 
 * MIGRATION GUIDE:
 * - Imports antiguos: import { usuarios, solicitudes } from '@/core/infrastructure/database/schema' ✅ SIGUEN FUNCIONANDO
 * - Imports nuevos: import { usuarios } from '@/core/infrastructure/database/schemas/estructura-org.schema' ✅ DISPONIBLES
 */

// =====================================================
// SCHEMAS MODULARES (Nueva estructura atómica)
// =====================================================
export * from './schemas/auth-rbac.schema';
export * from './schemas/estructura-org.schema';
export * from './schemas/ausencias.schema';
export * from './schemas/solicitudes.schema';
export * from './schemas/sistema.schema';

// =====================================================
// RELACIONES DRIZZLE ORM
// =====================================================
export * from './relations';

// =====================================================
// TIPOS INFERIDOS
// =====================================================
export * from './types';

/**
 * =====================================================
 * ARQUITECTURA MODULAR (DDD - Domain-Driven Design)
 * =====================================================
 * 
 * 📁 schemas/
 *    ├── auth-rbac.schema.ts          (~100 líneas)
 *    │   └── Roles, Permisos, RolesPermisos, UsuariosRoles
 *    │
 *    ├── estructura-org.schema.ts     (~90 líneas)
 *    │   └── Departamentos, Usuarios
 *    │
 *    ├── ausencias.schema.ts          (~110 líneas)
 *    │   └── TiposAusenciaConfig, BalancesAusencias
 *    │
 *    ├── solicitudes.schema.ts        (~90 líneas)
 *    │   └── Solicitudes (Tabla principal del negocio)
 *    │
 *    └── sistema.schema.ts            (~70 líneas)
 *        └── Auditoría, ConfiguraciónSistema
 * 
 * 📁 relations/
 *    └── index.ts                     (~120 líneas)
 *        └── Todas las relaciones Drizzle ORM
 * 
 * 📁 types/
 *    └── index.ts                     (~60 líneas)
 *        └── Re-export de todos los tipos inferidos
 * 
 * =====================================================
 * MEJORAS DE ARQUITECTURA
 * =====================================================
 * 
 * ✅ Separación de Concerns: Cada módulo representa un dominio de negocio
 * ✅ Mantenibilidad: ~80-110 líneas por archivo vs 450 líneas monolíticas
 * ✅ Testing: Fácil mockear dominios independientes
 * ✅ Escalabilidad: Agregar nuevas entidades sin afectar módulos existentes
 * ✅ Team Collaboration: Menos conflictos Git en schema
 * ✅ Code Review: Cambios localizados en dominios específicos
 * ✅ Performance: Tree-shaking más efectivo en builds
 * 
 * =====================================================
 * COMPATIBILIDAD
 * =====================================================
 * 
 * ✅ Todos los servicios en src/core/application/services/ siguen funcionando
 * ✅ Todos los API routes mantienen sus imports
 * ✅ Tests no requieren cambios
 * ✅ Migraciones Drizzle compatibles
 * 
 * =====================================================
 * SQL ATÓMICO CORRESPONDIENTE
 * =====================================================
 * 
 * database/
 * ├── 01_auth_rbac.sql              # RBAC completo
 * ├── 02_estructura_org.sql          # Departamentos + Usuarios
 * ├── 03_config_ausencias.sql        # TiposAusencia + Balances
 * ├── 04_solicitudes_core.sql        # Solicitudes + Triggers
 * └── 05_auditoria_logs.sql          # Auditoría + Configuración
 * 
 * =====================================================
 */
