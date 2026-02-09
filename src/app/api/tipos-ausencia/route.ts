import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET: Obtener tipos de ausencia disponibles
 * En schema CNI, los tipos son enums, no una tabla separada
 */
export async function GET(request: NextRequest) {
  try {
    const tipos = [
      { id: 'vacaciones', nombre: 'Vacaciones', tipo: 'vacaciones', activo: true, colorHex: '#10b981' },
      { id: 'licencia_medica', nombre: 'Licencia Médica', tipo: 'licencia_medica', activo: true, colorHex: '#ef4444' },
      { id: 'permiso_personal', nombre: 'Permiso Personal', tipo: 'permiso_personal', activo: true, colorHex: '#f59e0b' },
      { id: 'permiso_salida', nombre: 'Permiso de Salida', tipo: 'permiso_salida', activo: true, colorHex: '#6366f1' },
    ];

    return NextResponse.json({
      success: true,
      data: tipos
    });

  } catch (error) {
    console.error('Error obteniendo tipos de ausencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener tipos de ausencia' },
      { status: 500 }
    );
  }
}
