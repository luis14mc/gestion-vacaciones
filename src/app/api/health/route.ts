import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      {
        status: 'ok',
        service: 'gestion-vacaciones',
        timestamp,
        database: 'connected',
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'gestion-vacaciones',
        timestamp,
        database: 'unavailable',
      },
      { status: 503 }
    );
  }
}
