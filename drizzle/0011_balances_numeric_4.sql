-- Ampliar precisión de columnas de días en balances e historial (4 decimales).
-- Idempotente: solo altera si la columna aún tiene escala 2.

DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'balances' AND column_name IN (
          'cantidad_inicial',
          'cantidad_acumulada',
          'cantidad_usada',
          'cantidad_pendiente',
          'cantidad_disponible'
        ))
        OR (table_name = 'historial_balances' AND column_name IN (
          'cantidad',
          'cantidad_anterior',
          'cantidad_nueva'
        ))
      )
      AND numeric_scale = 2
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE numeric(10,4) USING %I::numeric(10,4)',
      col.table_name,
      col.column_name,
      col.column_name
    );
  END LOOP;
END $$;
