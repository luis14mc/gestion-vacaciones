/**
 * API: POST /api/cron/transiciones
 * Job automático para transiciones basadas en fecha.
 * Protegido por API key (para Vercel Cron / crontab externo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { procesarTransicionesAutomaticas } from '@/services/workflow.service';
import { withErrorHandler } from '@/lib/api-handler';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  
  if (!CRON_SECRET) {
    console.error('[CRON Error] CRON_SECRET no está configurado en las variables de entorno.');
    return NextResponse.json({ success: false, error: 'Configuración del servidor incompleta' }, { status: 500 });
  }

  // Validar autorización
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  const resultado = await procesarTransicionesAutomaticas();

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...resultado,
  });
});

// GET para verificar estado (health check)
export const GET = withErrorHandler(async () => {
  return NextResponse.json({
    service: 'cron-transiciones',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
