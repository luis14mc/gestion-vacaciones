import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { handleExportarReporte } from './handler';

export const runtime = 'nodejs';

export const GET = withErrorHandler(async (request: NextRequest) => {
  return handleExportarReporte(request);
});
