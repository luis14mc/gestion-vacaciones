import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }
    const tipos = [
      { id: 'vacaciones', nombre: 'Vacaciones', tipo: 'vacaciones', activo: true, colorHex: '#10b981', permiteHoras: false },
      { id: 'licencia_medica', nombre: 'Licencia Médica', tipo: 'licencia_medica', activo: true, colorHex: '#ef4444', permiteHoras: false },
      { id: 'permiso_personal', nombre: 'Permiso Personal', tipo: 'permiso_personal', activo: true, colorHex: '#f59e0b', permiteHoras: false },
      { id: 'permiso_salida', nombre: 'Permiso de Salida', tipo: 'permiso_salida', activo: true, colorHex: '#6366f1', permiteHoras: true },
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
