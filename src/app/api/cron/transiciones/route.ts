/**
 * API: POST /api/cron/transiciones
 * Job automático para transiciones basadas en fecha.
 * Protegido por API key (para Vercel Cron / crontab externo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { procesarTransicionesAutomaticas } from '@/services/workflow.service';

const CRON_SECRET = process.env.CRON_SECRET || 'cni-cron-secret-2026';

export async function POST(req: NextRequest) {
  try {
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
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET para verificar estado (health check)
export async function GET() {
  return NextResponse.json({
    service: 'cron-transiciones',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
