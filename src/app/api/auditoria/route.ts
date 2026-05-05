import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: [],
    total: 0,
    message: 'Módulo de auditoría pendiente de implementación'
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Evento de auditoría registrado (pendiente de implementación)'
  });
}
