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
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { configuracion } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// ─── GET: Obtener configuraciones ─────────────────────
export async function GET() {
  try {
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

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    // OWASP: No revelar trazas internas al cliente
    console.error('Error obteniendo configuraciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuraciones' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Actualizar configuraciones (individual o batch) ───
export async function PATCH(request: NextRequest) {
  try {
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

      // Validar estructura de cada entrada
      for (const item of body) {
        if (!item.clave || item.valor === undefined || item.valor === null) {
          return NextResponse.json(
            { success: false, error: `Entrada inválida: clave y valor son requeridos (clave: ${item.clave ?? 'undefined'})` },
            { status: 400 }
          );
        }
      }

      // Transacción atómica para garantizar consistencia (ISO/IEC 12207)
      await db.transaction(async (tx) => {
        const ahora = new Date().toISOString();
        for (const item of body) {
          await tx
            .update(configuracion)
            .set({ valor: String(item.valor), updatedAt: ahora })
            .where(eq(configuracion.clave, item.clave));
        }
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

    const [actualizado] = await db
      .update(configuracion)
      .set({ ...camposPermitidos, updatedAt: new Date().toISOString() })
      .where(eq(configuracion.id, id))
      .returning();

    if (!actualizado) {
      return NextResponse.json(
        { success: false, error: 'Configuración no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Configuración actualizada',
    });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
