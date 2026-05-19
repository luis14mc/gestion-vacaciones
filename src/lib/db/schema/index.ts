/**
 * ============================================================
 * SCHEMA INDEX - Exportación Unificada
 * ============================================================
 * @description Punto de entrada para todos los schemas Drizzle
 * @author Database Architect Senior
 * @version 5.0 - Arquitectura Limpia CNI
 * ============================================================
 */

// ============================================================
// EXPORTACIONES MODULARES
// ============================================================

// Auth & RBAC
export * from './auth';

// Organización
export * from './organizacion';

// Solicitudes (CORE - Formulario CNI)
export * from './solicitudes';

// Balances
export * from './balances';

// Auditoria
export * from './auditoria';
