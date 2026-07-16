-- Alias institucional (BLOQUE 4): vista sobre historial_asignaciones_mensuales.
CREATE OR REPLACE VIEW asignaciones_vacaciones_mensuales AS
SELECT
  id,
  usuario_id,
  anio,
  mes,
  dias_asignados,
  balance_anterior,
  balance_nuevo,
  dias_anuales_aplicados,
  anios_antiguedad,
  origen,
  ejecutado_por,
  ejecutado_en,
  observacion,
  created_at,
  updated_at
FROM historial_asignaciones_mensuales;
