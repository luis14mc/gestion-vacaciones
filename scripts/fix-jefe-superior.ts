/**
 * ============================================================
 * SCRIPT: Corregir usuarios sin jefe_superior_id asignado
 * ============================================================
 * @description Asigna automáticamente el jefe_superior_id basándose
 *   en el jefe del departamento al que pertenece cada usuario.
 *   Esto corrige usuarios que fueron importados masivamente sin
 *   que se les asignara jefe superior.
 * 
 * Uso: npx tsx scripts/fix-jefe-superior.ts
 * ============================================================
 */

import { db } from '../src/lib/db';
import { usuarios, departamentos } from '../src/lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function fixJefeSuperior() {
  console.log('=== Corrección de jefe_superior_id ===\n');

  // 1. Buscar usuarios activos sin jefe_superior_id
  const sinJefe = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      departamentoId: usuarios.departamentoId,
      esDirector: usuarios.esDirector,
    })
    .from(usuarios)
    .where(
      and(
        isNull(usuarios.jefeSuperiorId),
        eq(usuarios.activo, true),
        isNull(usuarios.deletedAt)
      )
    );

  console.log(`Usuarios activos sin jefe superior: ${sinJefe.length}`);

  if (sinJefe.length === 0) {
    console.log('\n✅ No hay usuarios que corregir.');
    process.exit(0);
  }

  // 2. Obtener departamentos con sus jefes
  const deptos = await db
    .select({
      id: departamentos.id,
      nombre: departamentos.nombre,
      jefeId: departamentos.jefeId,
    })
    .from(departamentos)
    .where(eq(departamentos.activo, true));

  const deptoJefeMap = new Map(deptos.map(d => [d.id, d.jefeId]));
  const deptoNombreMap = new Map(deptos.map(d => [d.id, d.nombre]));

  // 3. Asignar jefe superior basado en el departamento
  let actualizados = 0;
  let sinDepto = 0;
  let sinJefeDepto = 0;
  let esElMismoJefe = 0;

  for (const usuario of sinJefe) {
    if (!usuario.departamentoId) {
      sinDepto++;
      console.log(`  ⚠ ${usuario.nombre} ${usuario.apellido} (${usuario.email}): Sin departamento asignado`);
      continue;
    }

    const jefeId = deptoJefeMap.get(usuario.departamentoId);
    const deptoNombre = deptoNombreMap.get(usuario.departamentoId);

    if (!jefeId) {
      sinJefeDepto++;
      console.log(`  ⚠ ${usuario.nombre} ${usuario.apellido} (${usuario.email}): Departamento "${deptoNombre}" no tiene jefe asignado`);
      continue;
    }

    // No auto-asignar si el usuario ES el jefe del departamento
    if (jefeId === usuario.id) {
      esElMismoJefe++;
      console.log(`  ℹ ${usuario.nombre} ${usuario.apellido} (${usuario.email}): Es el jefe del departamento "${deptoNombre}", no se auto-asigna`);
      continue;
    }

    // Actualizar
    await db
      .update(usuarios)
      .set({
        jefeSuperiorId: jefeId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(usuarios.id, usuario.id));

    actualizados++;
    console.log(`  ✅ ${usuario.nombre} ${usuario.apellido} (${usuario.email}) → Jefe ID: ${jefeId} (Depto: ${deptoNombre})`);
  }

  console.log('\n=== Resumen ===');
  console.log(`  Usuarios procesados: ${sinJefe.length}`);
  console.log(`  Actualizados correctamente: ${actualizados}`);
  console.log(`  Sin departamento: ${sinDepto}`);
  console.log(`  Departamento sin jefe: ${sinJefeDepto}`);
  console.log(`  Es el jefe del departamento: ${esElMismoJefe}`);
  console.log('\n✅ Proceso completado.');

  process.exit(0);
}

fixJefeSuperior().catch((err) => {
  console.error('Error ejecutando corrección:', err);
  process.exit(1);
});
