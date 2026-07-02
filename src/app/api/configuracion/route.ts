/**
 * ============================================================
 * API: CONFIGURACIÓN DEL SISTEMA
 * ============================================================
 * @description Endpoints para gestión de configuraciones
 * @version 6.0 — Rediseño con Security by Design (OWASP 2026)
 * 
 * Cambios clave:
 *  - GET filtra claves privadas para usuarios no-admin (Least Privilege)
 *  - PATCH soporta batch updates dentro de transacción atómica
 *  - Se eliminan POST y DELETE: las claves son estáticas del sistema
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { filtrarConfigCatalogo, getConfigMeta, validarConfig } from '@/lib/config/catalog';
import { invalidarCacheConfig } from '@/lib/config/service';
import { registrarEventoAuditoria, datosPeticion } from '@/services/auditoria.service';

export const runtime = 'nodejs';

// ─── GET: Obtener configuraciones ─────────────────────
export const GET = withErrorHandler(async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    let results: any[] = [];
    try {
      if (session.esAdmin) {
        // Admin ve todas las configuraciones
        results = await db.select().from(configuracion);
      } else {
        // No-admin solo ve claves públicas (OWASP: Least Privilege)
        results = await db
          .select()
          .from(configuracion)
          .where(eq(configuracion.esPublico, true));
      }
    } catch (e: any) {
      if (e.message?.includes('does not exist') || e.code === '42P01') {
        return NextResponse.json({ success: true, data: [] });
      }
      throw e;
    }

    return NextResponse.json({ success: true, data: filtrarConfigCatalogo(results) });
});

// ─── PATCH: Actualizar configuraciones (individual o batch) ───
export const PATCH = withErrorHandler(async (request: NextRequest) => {
    const session = await getSession();
    if (!session?.esAdmin) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ── Modo Batch: Array de { clave, valor } ──
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json(
          { success: false, error: 'El arreglo de configuraciones está vacío' },
          { status: 400 }
        );
      }

      // Validar estructura + clave conocida + valor contra el catálogo
      for (const item of body) {
        if (!item.clave || item.valor === undefined || item.valor === null) {
          return NextResponse.json(
            { success: false, error: `Entrada inválida: clave y valor son requeridos (clave: ${item.clave ?? 'undefined'})` },
            { status: 400 }
          );
        }
        const errorValidacion = validarConfig(item.clave, String(item.valor));
        if (errorValidacion) {
          return NextResponse.json(
            { success: false, error: errorValidacion },
            { status: 400 }
          );
        }
      }

      // Transacción atómica para garantizar consistencia (ISO/IEC 12207)
      await db.transaction(async (tx) => {
        const ahora = new Date().toISOString();
        for (const item of body) {
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
              // Re-sincroniza la metadata por si cambió el catálogo
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
          claves: body.map((i: { clave: string; valor: unknown }) => i.clave),
          cambios: body.map((i: { clave: string; valor: unknown }) => ({
            clave: i.clave,
            valorNuevo: i.valor,
          })),
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: `${body.length} configuraciones actualizadas exitosamente`,
      });
    }

    // ── Modo Individual: { id, valor, ... } ──
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido para actualización individual' },
        { status: 400 }
      );
    }

    const camposPermitidos: Record<string, any> = {};
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

    if (body.valor !== undefined) {
      const errorValidacion = validarConfig(existente.clave, String(body.valor));
      if (errorValidacion) {
        return NextResponse.json(
          { success: false, error: errorValidacion },
          { status: 400 }
        );
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
      detalles: { clave: existente.clave, campos: Object.keys(camposPermitidos) },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Configuración actualizada',
    });
});
