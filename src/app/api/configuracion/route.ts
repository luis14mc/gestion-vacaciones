/**
 * ============================================================
 * API: CONFIGURACIÓN DEL SISTEMA
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { filtrarConfigCatalogo, getConfigMeta, validarConfig } from '@/lib/config/catalog';
import { invalidarCacheConfig } from '@/lib/config/service';
import {
  asegurarConfiguracionesBase,
  debeOmitirActualizacionSmtpPassword,
  prepararConfiguracionParaCliente,
  SMTP_PASSWORD_CLAVE,
} from '@/lib/config/bootstrap-config';
import { registrarEventoAuditoria, datosPeticion } from '@/services/auditoria.service';

export const runtime = 'nodejs';

async function contarConfiguraciones(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(configuracion);
  return Number(row?.count ?? 0);
}

// ─── GET: Obtener configuraciones ─────────────────────
export const GET = withErrorHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  let results: Array<typeof configuracion.$inferSelect> = [];
  let clavesInsertadas = 0;
  let bdEstabaVacia = false;

  try {
    if (session.esAdmin) {
      bdEstabaVacia = (await contarConfiguraciones()) === 0;
      const asegurado = await asegurarConfiguracionesBase();
      clavesInsertadas = asegurado.insertadas;
      results = await db.select().from(configuracion);
    } else {
      results = await db
        .select()
        .from(configuracion)
        .where(eq(configuracion.esPublico, true));
    }
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    if (err.message?.includes('does not exist') || err.code === '42P01') {
      const data = prepararConfiguracionParaCliente([], {
        esAdmin: Boolean(session.esAdmin),
      });
      return NextResponse.json({
        success: true,
        data,
        meta: { clavesInsertadas: 0, bdEstabaVacia: true },
      });
    }
    throw e;
  }

  const data = prepararConfiguracionParaCliente(filtrarConfigCatalogo(results), {
    esAdmin: Boolean(session.esAdmin),
  });

  return NextResponse.json({
    success: true,
    data,
    meta: {
      clavesInsertadas,
      bdEstabaVacia,
    },
  });
});

type PatchItem = { clave: string; valor: unknown };

function normalizarPatchBody(body: unknown): PatchItem[] | null {
  if (Array.isArray(body)) {
    return body as PatchItem[];
  }
  if (
    body &&
    typeof body === 'object' &&
    'clave' in body &&
    (body as PatchItem).valor !== undefined
  ) {
    return [body as PatchItem];
  }
  return null;
}

// ─── PATCH: Actualizar configuraciones (individual o batch) ───
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await getSession();
  if (!session?.esAdmin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const batch = normalizarPatchBody(body);

  if (batch) {
    const cambios = batch.filter(
      (item) => !(item.clave === SMTP_PASSWORD_CLAVE && debeOmitirActualizacionSmtpPassword(item.valor))
    );

    if (cambios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay cambios válidos para aplicar' },
        { status: 400 }
      );
    }

    for (const item of cambios) {
      if (!item.clave || item.valor === undefined || item.valor === null) {
        return NextResponse.json(
          {
            success: false,
            error: `Entrada inválida: clave y valor son requeridos (clave: ${item.clave ?? 'undefined'})`,
          },
          { status: 400 }
        );
      }
      const errorValidacion = validarConfig(item.clave, String(item.valor));
      if (errorValidacion) {
        return NextResponse.json({ success: false, error: errorValidacion }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      const ahora = new Date().toISOString();
      for (const item of cambios) {
        const meta = getConfigMeta(item.clave);

        await tx
          .insert(configuracion)
          .values({
            clave: item.clave,
            valor: String(item.valor),
            categoria: meta.categoria,
            tipoDato: meta.tipoDato,
            esPublico: meta.esPublico,
            updatedAt: ahora,
          })
          .onConflictDoUpdate({
            target: configuracion.clave,
            set: {
              valor: String(item.valor),
              categoria: meta.categoria,
              tipoDato: meta.tipoDato,
              esPublico: meta.esPublico,
              updatedAt: ahora,
            },
          });
      }
    });

    invalidarCacheConfig();

    const { ipAddress, userAgent } = datosPeticion(request);
    await registrarEventoAuditoria({
      usuarioId: session.id,
      accion: 'actualizar',
      modulo: 'configuracion',
      evento: 'actualizar_configuracion',
      tablaAfectada: 'configuracion',
      detalles: {
        claves: cambios.map((i) => i.clave),
        cambios: cambios.map((i) => ({
          clave: i.clave,
          valorNuevo: i.clave === SMTP_PASSWORD_CLAVE ? '[redactado]' : i.valor,
        })),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `${cambios.length} configuraciones actualizadas exitosamente`,
    });
  }

  const { id } = body as { id?: number };

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'ID requerido para actualización individual' },
      { status: 400 }
    );
  }

  const camposPermitidos: Record<string, unknown> = {};
  if (body.valor !== undefined) camposPermitidos.valor = String(body.valor);
  if (body.descripcion !== undefined) camposPermitidos.descripcion = body.descripcion;
  if (body.categoria !== undefined) camposPermitidos.categoria = body.categoria;
  if (body.tipoDato !== undefined) camposPermitidos.tipoDato = body.tipoDato;
  if (body.esPublico !== undefined) camposPermitidos.esPublico = body.esPublico;

  if (Object.keys(camposPermitidos).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  const [existente] = await db
    .select({ id: configuracion.id, clave: configuracion.clave })
    .from(configuracion)
    .where(eq(configuracion.id, id))
    .limit(1);

  if (!existente) {
    return NextResponse.json(
      { success: false, error: 'Configuración no encontrada' },
      { status: 404 }
    );
  }

  if (
    body.valor !== undefined &&
    existente.clave === SMTP_PASSWORD_CLAVE &&
    debeOmitirActualizacionSmtpPassword(body.valor)
  ) {
    return NextResponse.json({
      success: true,
      message: 'Contraseña SMTP sin cambios',
    });
  }

  if (body.valor !== undefined) {
    const errorValidacion = validarConfig(existente.clave, String(body.valor));
    if (errorValidacion) {
      return NextResponse.json({ success: false, error: errorValidacion }, { status: 400 });
    }
  }

  const [actualizado] = await db
    .update(configuracion)
    .set({ ...camposPermitidos, updatedAt: new Date().toISOString() })
    .where(eq(configuracion.id, id))
    .returning();

  invalidarCacheConfig();

  const { ipAddress, userAgent } = datosPeticion(request);
  await registrarEventoAuditoria({
    usuarioId: session.id,
    accion: 'actualizar',
    modulo: 'configuracion',
    evento: 'actualizar_configuracion',
    tablaAfectada: 'configuracion',
    registroId: Number(id),
    detalles: {
      clave: existente.clave,
      campos: Object.keys(camposPermitidos),
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    data: actualizado,
    message: 'Configuración actualizada',
  });
});
