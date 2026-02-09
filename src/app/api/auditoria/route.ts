import { NextRequest, NextResponse } from 'next/server';

/**
 * ⚠️ RUTA DESACTIVADA
 * La tabla 'auditoria' NO existe en el schema CNI.
 * TODO: Implementar sistema de auditoría usando triggers o tabla separada.
 */

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Auditoría no implementada en schema CNI' },
    { status: 501 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Auditoría no implementada en schema CNI' },
    { status: 501 }
  );
}
