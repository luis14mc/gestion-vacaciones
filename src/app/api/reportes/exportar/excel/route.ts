import { NextRequest } from 'next/server';
import { handleExportarReporte } from '../handler';

export const runtime = 'nodejs';

/** Wrapper legacy — delega al handler unificado con formato xlsx. */
export async function GET(request: NextRequest) {
  return handleExportarReporte(request, 'xlsx');
}
