/**
 * API: POST /api/admin/asignacion-mensual-vacaciones
 * Alias canónico del endpoint de Fase 5 para ejecución administrativa.
 *
 * Solo RRHH/Admin. Jefe y Empleado NO.
 *
 * Body:
 *   { anio: 2026, mes: 7, modo: "automatico" | "manual" }
 *
 * Respuesta:
 *   { success: true, data: { anio, mes, usuariosProcesados,
 *     asignacionesCreadas, usuariosOmitidos, totalDiasAsignados } }
 *
 * Implementación: re-exporta el handler de
 * /api/admin/ejecutar-asignacion-mensual para mantener una única ruta de
 * código. La ruta canónica se documenta como esta, la anterior queda como
 * compat.
 */
import { POST } from '@/app/api/admin/ejecutar-asignacion-mensual/route';

export { POST };
