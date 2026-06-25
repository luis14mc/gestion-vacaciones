/**
 * ============================================================
 * RECONCILIACIÓN DE BALANCES DE VACACIONES
 * ============================================================
 * Recalcula cantidad_usada / cantidad_pendiente / cantidad_disponible
 * de cada balance de tipo 'vacaciones' a partir del estado real de las
 * solicitudes. Corrige desviaciones históricas, en particular el bug
 * donde las solicitudes aprobadas por RRHH dejaban los días atascados
 * en "pendiente" en vez de moverlos a "usada".
 *
 * Reglas (deben coincidir con workflow.service.aplicarEfectos):
 *   base       = cantidad_inicial + cantidad_acumulada
 *   usada      = Σ días de solicitudes que consumen balance en estados
 *                aprobada_rrhh | finalizada
 *   pendiente  = Σ días de solicitudes que consumen balance en estados
 *                pendiente_jefe | aprobada_jefe
 *   disponible = GREATEST(0, base - usada - pendiente)
 *
 * "Consume balance": tipo = 'vacaciones' O
 *                    (tipo = 'permiso_salida' Y duracion_permiso = 'dia_completo')
 *
 * USO:
 *   node scripts/reconciliar-balances.mjs           # DRY-RUN (solo reporta)
 *   node scripts/reconciliar-balances.mjs --apply   # Aplica los cambios
 * ============================================================
 */

import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const APPLY = process.argv.includes('--apply');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL no configurada');
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: { rejectUnauthorized: false } });

// CTE que calcula los valores correctos por balance y los compara con los actuales.
const calculoCte = sql`
  WITH consumo AS (
    SELECT
      b.id                                   AS balance_id,
      b.usuario_id,
      b.ano_laboral_id,
      (b.cantidad_inicial + b.cantidad_acumulada)::numeric(10,2) AS base,
      b.cantidad_usada::numeric(10,2)        AS usada_actual,
      b.cantidad_pendiente::numeric(10,2)    AS pendiente_actual,
      b.cantidad_disponible::numeric(10,2)   AS disponible_actual,
      COALESCE(SUM(CASE WHEN s.estado IN ('aprobada_rrhh','finalizada')
                        THEN s.dias_solicitados::numeric ELSE 0 END), 0)::numeric(10,2) AS usada_calc,
      COALESCE(SUM(CASE WHEN s.estado IN ('pendiente_jefe','aprobada_jefe')
                        THEN s.dias_solicitados::numeric ELSE 0 END), 0)::numeric(10,2) AS pendiente_calc
    FROM balances b
    LEFT JOIN solicitudes s
      ON s.usuario_id = b.usuario_id
     AND s.ano_laboral_id = b.ano_laboral_id
     AND s.deleted_at IS NULL
     AND (s.tipo = 'vacaciones'
          OR (s.tipo = 'permiso_salida' AND s.duracion_permiso = 'dia_completo'))
    WHERE b.tipo_ausencia = 'vacaciones'
    GROUP BY b.id
  )
  SELECT
    consumo.*,
    GREATEST(0, base - usada_calc - pendiente_calc)::numeric(10,2) AS disponible_calc
  FROM consumo
`;

async function main() {
  console.log(`\n🔎 Reconciliación de balances — modo: ${APPLY ? 'APLICAR ✍️' : 'DRY-RUN (solo lectura) 👀'}\n`);

  const filas = await sql`
    SELECT * FROM (${calculoCte}) AS r
    WHERE r.usada_actual      <> r.usada_calc
       OR r.pendiente_actual  <> r.pendiente_calc
       OR r.disponible_actual <> r.disponible_calc
    ORDER BY r.usuario_id, r.ano_laboral_id
  `;

  if (filas.length === 0) {
    console.log('✅ Todos los balances ya están consistentes. Nada que reconciliar.');
    await sql.end();
    return;
  }

  console.log(`Se encontraron ${filas.length} balance(s) con desviación:\n`);
  for (const f of filas) {
    console.log(
      `  balance #${f.balance_id} (usuario ${f.usuario_id}, año ${f.ano_laboral_id})\n` +
      `     usada:      ${f.usada_actual} → ${f.usada_calc}\n` +
      `     pendiente:  ${f.pendiente_actual} → ${f.pendiente_calc}\n` +
      `     disponible: ${f.disponible_actual} → ${f.disponible_calc}`
    );
  }

  if (!APPLY) {
    console.log(`\nℹ️  DRY-RUN: no se aplicó ningún cambio. Ejecuta con --apply para corregir.`);
    await sql.end();
    return;
  }

  // Aplicar dentro de una transacción
  const actualizados = await sql.begin(async (tx) => {
    const res = await tx`
      UPDATE balances b
      SET cantidad_usada      = c.usada_calc,
          cantidad_pendiente  = c.pendiente_calc,
          cantidad_disponible = c.disponible_calc,
          version             = b.version + 1,
          updated_at          = NOW()
      FROM (${calculoCte}) AS c
      WHERE b.id = c.balance_id
        AND (b.cantidad_usada::numeric(10,2)      <> c.usada_calc
          OR b.cantidad_pendiente::numeric(10,2)  <> c.pendiente_calc
          OR b.cantidad_disponible::numeric(10,2) <> c.disponible_calc)
      RETURNING b.id
    `;
    return res.length;
  });

  console.log(`\n✅ Reconciliación aplicada: ${actualizados} balance(s) corregido(s).`);
  await sql.end();
}

main().catch((e) => {
  console.error('❌ Error en la reconciliación:', e);
  process.exit(1);
});
