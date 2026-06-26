import { NextRequest } from 'next/server';
import { handleExportarReporte } from './handler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleExportarReporte(request);
}
