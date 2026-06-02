-- ============================================================
-- LIMPIEZA DE USUARIOS PARA PRUEBAS DE CARGA MASIVA
-- ============================================================
-- Elimina todos los usuarios EXCEPTO el admin principal (es_admin = true)
-- Preserva: roles, permisos, departamentos, configuracion, año laboral
-- ============================================================

-- 1. Eliminar solicitudes de todos los usuarios no-admin
DELETE FROM solicitudes
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 2. Eliminar balances de usuarios no-admin
DELETE FROM balances
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 3. Eliminar sesiones de usuarios no-admin
DELETE FROM sessions
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 4. Eliminar asignaciones departamento de usuarios no-admin
DELETE FROM usuarios_departamentos
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 5. Eliminar roles asignados a usuarios no-admin
DELETE FROM usuarios_roles
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 6. Limpiar jefe_id de departamentos si apuntaba a un no-admin
UPDATE departamentos
SET jefe_id = NULL, updated_at = NOW()
WHERE jefe_id IN (
  SELECT id FROM usuarios WHERE es_admin = false
);

-- 7. Eliminar usuarios no-admin
DELETE FROM usuarios WHERE es_admin = false;

-- 8. Reset secuencias de solicitudes para que empiecen limpio
-- (Opcional, para que los códigos SOL-2026-XXXXX empiecen desde 1)

-- 9. Verificación
SELECT 'Usuarios restantes' AS check, COUNT(*) AS total FROM usuarios
UNION ALL
SELECT 'Solicitudes restantes', COUNT(*) FROM solicitudes
UNION ALL
SELECT 'Balances restantes', COUNT(*) FROM balances
UNION ALL
SELECT 'Sesiones restantes', COUNT(*) FROM sessions
UNION ALL
SELECT 'Asignaciones depto restantes', COUNT(*) FROM usuarios_departamentos
UNION ALL
SELECT 'Roles-usuario restantes', COUNT(*) FROM usuarios_roles;
