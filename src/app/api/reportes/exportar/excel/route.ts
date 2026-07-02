import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { handleExportarReporte } from '../handler';

export const runtime = 'nodejs';

/** Wrapper legacy — delega al handler unificado con formato xlsx. */
export const GET = withErrorHandler(async (request: NextRequest) => {
  return handleExportarReporte(request, 'xlsx');
});
