/**
 * 📊 SERVICIO DE REPORTES
 * Lógica de negocio para generación de reportes y estadísticas
 * - Métricas del sistema
 * - Reportes por departamento
 * - Exportación a Excel/CSV
 */

import { db } from '@/core/infrastructure/database';
import { 
  usuarios, 
  solicitudes, 
  balancesAusencias,
  departamentos
} from '@/core/infrastructure/database/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

// ==========================================
// INTERFACES
// ==========================================

export interface ReporteGeneral {
  resumen: {
    totalUsuarios: number;
    usuariosActivos: number;
    solicitudesPendientes: number;
    solicitudesAprobadas: number;
    diasVacacionesUtilizados: number;
    diasVacacionesPendientes: number;
  };
  topDepartamentos: {
    departamento: string;
    usuariosActivos: number;
    diasUtilizados: number;
    diasDisponibles: number;
  }[];
  tendenciasMensuales: {
    mes: string;
    solicitudes: number;
    diasUtilizados: number;
  }[];
}

export interface ReporteDepartamento {
  departamento: {
    id: number;
    nombre: string;
    codigo: string;
  };
  metricas: {
    totalColaboradores: number;
    colaboradoresActivos: number;
    diasTotalesAsignados: number;
    diasTotalesUtilizados: number;
    diasTotalesPendientes: number;
    diasTotalesDisponibles: number;
    solicitudesPendientes: number;
    solicitudesAprobadas: number;
  };
  colaboradores: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    cargo: string | null;
    diasAsignados: number;
    diasUtilizados: number;
    diasPendientes: number;
    diasDisponibles: number;
  }[];
  proximasVacaciones: {
    empleado: string;
    fechaInicio: string;
    fechaFin: string;
    dias: number;
  }[];
}

// ==========================================
// FUNCIONES DEL SERVICIO
// ==========================================

/**
 * 📊 GENERAR REPORTE GENERAL
 * Métricas generales del sistema para ADMIN/RRHH
 */
export async function generarReporteGeneral(): Promise<ReporteGeneral> {
  console.log('📊 Generando reporte general del sistema');

  // 1. RESUMEN GENERAL
  const [totalUsuarios] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios);

  const [usuariosActivos] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios)
    .where(eq(usuarios.activo, true));

  const [solicitudesPendientes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .where(eq(solicitudes.estado, 'pendiente'));

  const [solicitudesAprobadas] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .where(eq(solicitudes.estado, 'aprobada'));

  const [diasStats] = await db
    .select({
      utilizados: sql<number>`COALESCE(SUM(CAST(cantidad_utilizada AS DECIMAL)), 0)`,
      pendientes: sql<number>`COALESCE(SUM(CAST(cantidad_pendiente AS DECIMAL)), 0)`
    })
    .from(balancesAusencias)
    .where(eq(balancesAusencias.estado, 'activo'));

  // 2. TOP DEPARTAMENTOS
  const topDeptos = await db
    .select({
      departamento: departamentos.nombre,
      usuariosActivos: sql<number>`COUNT(DISTINCT ${usuarios.id})`,
      diasUtilizados: sql<number>`COALESCE(SUM(CAST(${balancesAusencias.cantidadUtilizada} AS DECIMAL)), 0)`,
      diasDisponibles: sql<number>`COALESCE(SUM(
        CAST(${balancesAusencias.cantidadAsignada} AS DECIMAL) - 
        CAST(${balancesAusencias.cantidadUtilizada} AS DECIMAL) - 
        CAST(${balancesAusencias.cantidadPendiente} AS DECIMAL)
      ), 0)`
    })
    .from(departamentos)
    .leftJoin(usuarios, eq(usuarios.departamentoId, departamentos.id))
    .leftJoin(balancesAusencias, eq(balancesAusencias.usuarioId, usuarios.id))
    .where(and(
      eq(usuarios.activo, true),
      eq(balancesAusencias.estado, 'activo')
    ))
    .groupBy(departamentos.id, departamentos.nombre)
    .orderBy(desc(sql`SUM(CAST(${balancesAusencias.cantidadUtilizada} AS DECIMAL))`))
    .limit(10);

  // 3. TENDENCIAS MENSUALES (últimos 6 meses)
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const seisMesesAtrasStr = seisMesesAtras.toISOString().split('T')[0];

  const tendencias = await db
    .select({
      mes: sql<string>`TO_CHAR(${solicitudes.fechaInicio}, 'YYYY-MM')`,
      solicitudes: sql<number>`COUNT(*)`,
      diasUtilizados: sql<number>`COALESCE(SUM(CAST(${solicitudes.cantidad} AS DECIMAL)), 0)`
    })
    .from(solicitudes)
    .where(
      and(
        gte(solicitudes.fechaInicio, seisMesesAtrasStr),
        eq(solicitudes.estado, 'aprobada')
      )
    )
    .groupBy(sql`TO_CHAR(${solicitudes.fechaInicio}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${solicitudes.fechaInicio}, 'YYYY-MM')`);

  return {
    resumen: {
      totalUsuarios: Number(totalUsuarios.count),
      usuariosActivos: Number(usuariosActivos.count),
      solicitudesPendientes: Number(solicitudesPendientes.count),
      solicitudesAprobadas: Number(solicitudesAprobadas.count),
      diasVacacionesUtilizados: Number(diasStats?.utilizados || 0),
      diasVacacionesPendientes: Number(diasStats?.pendientes || 0)
    },
    topDepartamentos: topDeptos.map(d => ({
      departamento: d.departamento,
      usuariosActivos: Number(d.usuariosActivos),
      diasUtilizados: Number(d.diasUtilizados),
      diasDisponibles: Number(d.diasDisponibles)
    })),
    tendenciasMensuales: tendencias.map(t => ({
      mes: t.mes,
      solicitudes: Number(t.solicitudes),
      diasUtilizados: Number(t.diasUtilizados)
    }))
  };
}

/**
 * 📋 GENERAR REPORTE DE DEPARTAMENTO
 * Métricas específicas de un departamento
 */
export async function generarReporteDepartamento(
  departamentoId: number,
  usuarioId?: number
): Promise<ReporteDepartamento> {
  console.log(`📋 Generando reporte del departamento ${departamentoId}`);

  // 1. Información del departamento
  const departamento = await db.query.departamentos.findFirst({
    where: eq(departamentos.id, departamentoId)
  });

  if (!departamento) {
    throw new Error(`Departamento con ID ${departamentoId} no encontrado`);
  }

  // 2. Métricas del departamento
  const [totalColaboradores] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios)
    .where(eq(usuarios.departamentoId, departamentoId));

  const [colaboradoresActivos] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usuarios)
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(usuarios.activo, true)
    ));

  const [diasStats] = await db
    .select({
      asignados: sql<number>`COALESCE(SUM(CAST(cantidad_asignada AS DECIMAL)), 0)`,
      utilizados: sql<number>`COALESCE(SUM(CAST(cantidad_utilizada AS DECIMAL)), 0)`,
      pendientes: sql<number>`COALESCE(SUM(CAST(cantidad_pendiente AS DECIMAL)), 0)`
    })
    .from(balancesAusencias)
    .innerJoin(usuarios, eq(usuarios.id, balancesAusencias.usuarioId))
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(balancesAusencias.estado, 'activo')
    ));

  const [solicitudesPendientes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .innerJoin(usuarios, eq(usuarios.id, solicitudes.usuarioId))
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(solicitudes.estado, 'pendiente')
    ));

  const [solicitudesAprobadas] = await db
    .select({ count: sql<number>`count(*)` })
    .from(solicitudes)
    .innerJoin(usuarios, eq(usuarios.id, solicitudes.usuarioId))
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(solicitudes.estado, 'aprobada')
    ));

  // 3. Lista de colaboradores con balances
  const colaboradoresData = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      email: usuarios.email,
      cargo: usuarios.cargo,
      diasAsignados: sql<number>`COALESCE(SUM(CAST(${balancesAusencias.cantidadAsignada} AS DECIMAL)), 0)`,
      diasUtilizados: sql<number>`COALESCE(SUM(CAST(${balancesAusencias.cantidadUtilizada} AS DECIMAL)), 0)`,
      diasPendientes: sql<number>`COALESCE(SUM(CAST(${balancesAusencias.cantidadPendiente} AS DECIMAL)), 0)`
    })
    .from(usuarios)
    .leftJoin(balancesAusencias, and(
      eq(balancesAusencias.usuarioId, usuarios.id),
      eq(balancesAusencias.estado, 'activo')
    ))
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(usuarios.activo, true)
    ))
    .groupBy(usuarios.id, usuarios.nombre, usuarios.apellido, usuarios.email, usuarios.cargo);

  // 4. Próximas vacaciones (próximos 30 días)
  const hoy = new Date();
  const treintaDiasDespues = new Date();
  treintaDiasDespues.setDate(treintaDiasDespues.getDate() + 30);
  const hoyStr = hoy.toISOString().split('T')[0];
  const treintaDiasDespuesStr = treintaDiasDespues.toISOString().split('T')[0];

  const proximasVacaciones = await db
    .select({
      empleado: sql<string>`${usuarios.nombre} || ' ' || ${usuarios.apellido}`,
      fechaInicio: solicitudes.fechaInicio,
      fechaFin: solicitudes.fechaFin,
      dias: solicitudes.cantidad
    })
    .from(solicitudes)
    .innerJoin(usuarios, eq(usuarios.id, solicitudes.usuarioId))
    .where(and(
      eq(usuarios.departamentoId, departamentoId),
      eq(solicitudes.estado, 'aprobada'),
      gte(solicitudes.fechaInicio, hoyStr),
      lte(solicitudes.fechaInicio, treintaDiasDespuesStr)
    ))
    .orderBy(solicitudes.fechaInicio)
    .limit(10);

  const diasTotalesAsignados = Number(diasStats?.asignados || 0);
  const diasTotalesUtilizados = Number(diasStats?.utilizados || 0);
  const diasTotalesPendientes = Number(diasStats?.pendientes || 0);

  return {
    departamento: {
      id: departamento.id,
      nombre: departamento.nombre,
      codigo: departamento.codigo
    },
    metricas: {
      totalColaboradores: Number(totalColaboradores.count),
      colaboradoresActivos: Number(colaboradoresActivos.count),
      diasTotalesAsignados,
      diasTotalesUtilizados,
      diasTotalesPendientes,
      diasTotalesDisponibles: diasTotalesAsignados - diasTotalesUtilizados - diasTotalesPendientes,
      solicitudesPendientes: Number(solicitudesPendientes.count),
      solicitudesAprobadas: Number(solicitudesAprobadas.count)
    },
    colaboradores: colaboradoresData.map(c => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      email: c.email,
      cargo: c.cargo,
      diasAsignados: Number(c.diasAsignados),
      diasUtilizados: Number(c.diasUtilizados),
      diasPendientes: Number(c.diasPendientes),
      diasDisponibles: Number(c.diasAsignados) - Number(c.diasUtilizados) - Number(c.diasPendientes)
    })),
    proximasVacaciones: proximasVacaciones.map(v => ({
      empleado: v.empleado,
      fechaInicio: v.fechaInicio, // Ya es string
      fechaFin: v.fechaFin, // Ya es string
      dias: Number(v.dias)
    }))
  };
}

/**
 * 📄 EXPORTAR REPORTE A CSV
 * Genera archivo CSV con datos del reporte
 */
export async function exportarReporteCSV(
  tipo: 'general' | 'departamento',
  data: ReporteGeneral | ReporteDepartamento
): Promise<string> {
  console.log(`📄 Exportando reporte a CSV: ${tipo}`);

  // BOM para UTF-8 (para que Excel abra correctamente los acentos)
  let csv = '\uFEFF';

  if (tipo === 'general' && 'resumen' in data) {
    // Reporte General
    csv += 'REPORTE GENERAL DEL SISTEMA\n\n';
    csv += 'RESUMEN\n';
    csv += 'Métrica,Valor\n';
    csv += `Total Usuarios,${data.resumen.totalUsuarios}\n`;
    csv += `Usuarios Activos,${data.resumen.usuariosActivos}\n`;
    csv += `Solicitudes Pendientes,${data.resumen.solicitudesPendientes}\n`;
    csv += `Solicitudes Aprobadas,${data.resumen.solicitudesAprobadas}\n`;
    csv += `Días Vacaciones Utilizados,${data.resumen.diasVacacionesUtilizados}\n`;
    csv += `Días Vacaciones Pendientes,${data.resumen.diasVacacionesPendientes}\n\n`;

    csv += 'TOP DEPARTAMENTOS\n';
    csv += 'Departamento,Usuarios Activos,Días Utilizados,Días Disponibles\n';
    data.topDepartamentos.forEach(d => {
      csv += `"${d.departamento}",${d.usuariosActivos},${d.diasUtilizados},${d.diasDisponibles}\n`;
    });

    csv += '\nTENDENCIAS MENSUALES\n';
    csv += 'Mes,Solicitudes,Días Utilizados\n';
    data.tendenciasMensuales.forEach(t => {
      csv += `${t.mes},${t.solicitudes},${t.diasUtilizados}\n`;
    });
  } else if (tipo === 'departamento' && 'departamento' in data) {
    // Reporte de Departamento
    csv += `REPORTE DEL DEPARTAMENTO: ${data.departamento.nombre}\n\n`;
    csv += 'MÉTRICAS\n';
    csv += 'Métrica,Valor\n';
    csv += `Total Colaboradores,${data.metricas.totalColaboradores}\n`;
    csv += `Colaboradores Activos,${data.metricas.colaboradoresActivos}\n`;
    csv += `Días Totales Asignados,${data.metricas.diasTotalesAsignados}\n`;
    csv += `Días Totales Utilizados,${data.metricas.diasTotalesUtilizados}\n`;
    csv += `Días Totales Pendientes,${data.metricas.diasTotalesPendientes}\n`;
    csv += `Días Totales Disponibles,${data.metricas.diasTotalesDisponibles}\n`;
    csv += `Solicitudes Pendientes,${data.metricas.solicitudesPendientes}\n`;
    csv += `Solicitudes Aprobadas,${data.metricas.solicitudesAprobadas}\n\n`;

    csv += 'COLABORADORES\n';
    csv += 'Nombre,Apellido,Email,Cargo,Días Asignados,Días Utilizados,Días Pendientes,Días Disponibles\n';
    data.colaboradores.forEach(c => {
      csv += `"${c.nombre}","${c.apellido}","${c.email}","${c.cargo || ''}",${c.diasAsignados},${c.diasUtilizados},${c.diasPendientes},${c.diasDisponibles}\n`;
    });

    csv += '\nPRÓXIMAS VACACIONES\n';
    csv += 'Empleado,Fecha Inicio,Fecha Fin,Días\n';
    data.proximasVacaciones.forEach(v => {
      csv += `"${v.empleado}",${v.fechaInicio},${v.fechaFin},${v.dias}\n`;
    });
  }

  return csv;
}

/**
 * 📊 EXPORTAR REPORTE A EXCEL
 * Genera archivo Excel con formato profesional
 * Nota: Requiere instalación de ExcelJS
 * Retorna: JSON con estructura básica (sin ExcelJS implementado)
 */
export async function exportarReporteExcel(
  tipo: 'general' | 'departamento',
  data: ReporteGeneral | ReporteDepartamento
): Promise<any> {
  console.log(`📊 Exportando reporte a Excel: ${tipo}`);

  // Por ahora retornamos estructura JSON
  // TODO: Implementar con ExcelJS cuando se instale la librería
  return {
    tipo,
    data,
    formato: 'json',
    mensaje: 'Para exportación Excel completa, instalar: pnpm add exceljs'
  };
}
