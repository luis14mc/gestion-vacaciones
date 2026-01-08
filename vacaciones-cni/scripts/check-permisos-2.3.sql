-- ============================================
-- SCRIPT: Verificar permisos para Actividad 2.3
-- ============================================

-- 1. Ver permisos por rol
SELECT 
  r.nombre as rol,
  p.codigo as permiso,
  p.nombre as nombre_permiso,
  rp.puede_crear,
  rp.puede_leer,
  rp.puede_actualizar,
  rp.puede_eliminar
FROM roles r
JOIN roles_permisos rp ON rp.rol_id = r.id
JOIN permisos p ON p.id = rp.permiso_id
WHERE p.codigo LIKE 'vacaciones.solicitudes.%'
ORDER BY r.id, p.codigo;

-- 2. Ver usuarios con sus roles
SELECT 
  u.id,
  u.email,
  u.nombre,
  u.apellido,
  r.nombre as rol,
  d.nombre as departamento
FROM usuarios u
LEFT JOIN roles r ON r.id = u.rol_id
LEFT JOIN departamentos d ON d.id = u.departamento_id
WHERE u.id IN (1, 2, 3, 4)
ORDER BY u.id;

-- 3. Ver solicitudes disponibles para pruebas
SELECT 
  s.id,
  s.codigo,
  s.estado,
  u.email as solicitante,
  d.nombre as departamento,
  s.fecha_inicio,
  s.fecha_fin,
  s.cantidad
FROM solicitudes s
JOIN usuarios u ON u.id = s.usuario_id
LEFT JOIN departamentos d ON d.id = u.departamento_id
ORDER BY s.id
LIMIT 10;
