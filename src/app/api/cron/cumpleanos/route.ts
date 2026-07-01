import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { notificarCumpleanosDelMes } from '@/services/cumpleanos.service';

async function ejecutar(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Configuración del servidor incompleta' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  const resultado = await notificarCumpleanosDelMes();
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...resultado });
}

export const GET = withErrorHandler(ejecutar);
export const POST = withErrorHandler(ejecutar);

