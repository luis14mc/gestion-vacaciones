-- Limpieza segura de claves de configuración legacy (auto-aprobación de jefe y acumulación).
-- No modifica usuarios, solicitudes ni balances.
--
-- Estas claves aparecen en LEGACY_CONFIG_KEYS (src/lib/config/catalog.ts) y son
-- filtradas por filtrarConfigCatalogo: no se sirven en /api/configuracion ni
-- aparecen en la UI. El seed también dejó de crearlas (scripts/seed-database.ts).
-- Este script limpia cualquier fila preexistente en la BD.

DELETE FROM configuracion
WHERE clave IN (
  'departamentos.jefe_auto_aprobar',
  'departamentos.jefe_puede_auto_aprobar',
  'flujo.jefe_auto_aprobar',
  'jefe_auto_aprobar',
  'jefe_puede_auto_aprobar',
  'vacaciones.acumulacion_habilitada',
  'vacaciones.max_acumulacion'
);
