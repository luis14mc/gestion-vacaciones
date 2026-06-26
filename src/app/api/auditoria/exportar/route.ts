import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseFiltrosAuditoria, filtrosAuditoriaToRecord } from '@/lib/domain/auditoria/filters';
import { exportarRegistrosAuditoria } from '@/lib/domain/auditoria/queries';
import { puedeExportarAuditoria } from '@/lib/domain/auditoria/access';
import { labelAccion, labelEvento } from '@/lib/domain/auditoria/labels';
import {
  registrarEventoAuditoria,
  datosPeticion,
} from '@/services/auditoria.service';
import { exportarFilasExcel } from '@/services/excel.service';

export const runtime = 'nodejs';

function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!puedeExportarAuditoria(session)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const filtros = parseFiltrosAuditoria(request.nextUrl.searchParams);
    const formato = request.nextUrl.searchParams.get('formato') || 'csv';
    const filas = await exportarRegistrosAuditoria(filtros);

    const columnas = [
      { key: 'fecha', header: 'Fecha/Hora' },
      { key: 'usuario', header: 'Usuario' },
      { key: 'email', header: 'Email' },
      { key: 'accion', header: 'Acción' },
      { key: 'modulo', header: 'Módulo' },
      { key: 'evento', header: 'Evento' },
      { key: 'tabla', header: 'Tabla' },
      { key: 'registro_id', header: 'Registro ID' },
      { key: 'entidad', header: 'Entidad' },
      { key: 'resultado', header: 'Resultado' },
      { key: 'severidad', header: 'Severidad' },
      { key: 'ip', header: 'IP' },
      { key: 'user_agent', header: 'User Agent' },
      { key: 'detalles_resumidos', header: 'Detalles resumidos' },
    ];

    const filasFormateadas = filas.map((fila) => ({
      ...fila,
      accion: labelAccion(String(fila.accion)),
      evento: labelEvento(fila.evento),
    }));

    const { ipAddress, userAgent } = datosPeticion(request);
    await registrarEventoAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      modulo: 'auditoria',
      evento: 'exportar_auditoria',
      tablaAfectada: 'auditoria',
      detalles: {
        formato,
        totalRegistros: filas.length,
        filtros: filtrosAuditoriaToRecord(filtros),
      },
      ipAddress,
      userAgent,
    });

    if (formato === 'xlsx' || formato === 'excel') {
      const buffer = await exportarFilasExcel({
        titulo: 'Auditoría del Sistema - CNI Honduras',
        hoja: 'auditoria',
        columnas,
        filas: filasFormateadas,
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="auditoria_${Date.now()}.xlsx"`,
        },
      });
    }

    const csvRows = filasFormateadas.map((fila) =>
      columnas.map((col) => escapeCsv(fila[col.key as keyof typeof fila])).join(',')
    );

    const csv = `\uFEFF${columnas.map((c) => escapeCsv(c.header)).join(',')}\n${csvRows.join('\n')}`;
    const filename = `auditoria_${Date.now()}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exportando auditoría:', error);
    return NextResponse.json({ success: false, error: 'Error al exportar auditoría' }, { status: 500 });
  }
}
