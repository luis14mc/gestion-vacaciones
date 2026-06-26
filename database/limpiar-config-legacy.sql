-- Limpieza segura de claves de configuración legacy (auto-aprobación de jefe).
-- No modifica usuarios, solicitudes ni balances.

DELETE FROM configuracion
WHERE clave IN (
  'departamentos.jefe_auto_aprobar',
  'departamentos.jefe_puede_auto_aprobar',
  'flujo.jefe_auto_aprobar',
  'jefe_auto_aprobar',
  'jefe_puede_auto_aprobar'
);
