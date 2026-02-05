import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Insertar permiso reportes.exportar al rol JEFE
    await db.execute(sql`
      INSERT INTO roles_permisos (rol_id, permiso_id)
      SELECT r.id, p.id 
      FROM roles r, permisos p 
      WHERE r.codigo = 'JEFE' 
        AND p.codigo = 'reportes.exportar'
      ON CONFLICT (rol_id, permiso_id) DO NOTHING
    `);

    // Verificar
    const result = await db.execute(sql`
      SELECT 
        r.nombre as rol,
        p.codigo as permiso,
        p.descripcion
      FROM roles r
      JOIN roles_permisos rp ON rp.rol_id = r.id
      JOIN permisos p ON p.id = rp.permiso_id
      WHERE r.codigo = 'JEFE' AND p.codigo = 'reportes.exportar'
    `);

    return NextResponse.json({
      success: true,
      message: 'Permiso reportes.exportar agregado al rol JEFE',
      verificacion: result.rows
    });

  } catch (error) {
    console.error('Error aplicando hotfix:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
