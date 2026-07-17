import { NextResponse } from 'next/server';

function nombreSeguro(filename: string): string {
  return filename.replace(/[^\w.\-() áéíóúñÁÉÍÓÚÑ]/g, '_').replace(/"/g, '');
}

export function respuestaAdjuntoInline(
  bytes: Buffer,
  mimeType: string,
  nombreArchivo: string
): NextResponse {
  const safe = nombreSeguro(nombreArchivo);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safe}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function respuestaAdjuntoDescarga(
  bytes: Buffer,
  mimeType: string,
  nombreArchivo: string
): NextResponse {
  const safe = nombreSeguro(nombreArchivo);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
