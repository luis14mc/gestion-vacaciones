import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withErrorHandler(async (_request: NextRequest) => {
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
    {
      id: 'permiso_salida',
      nombre: 'Permiso de Salida',
      tipo: 'permiso_salida',
      activo: true,
      colorHex: '#6366f1',
      permiteHoras: true,
    },
    {
      id: 'dia_cumpleanos',
      nombre: 'Día libre por cumpleaños',
      tipo: 'dia_cumpleanos',
      activo: true,
      colorHex: '#ec4899',
      permiteHoras: false,
      requiereMesCumpleanos: true,
    },
  ];

  return NextResponse.json({
    success: true,
    data: tipos
  });
});
