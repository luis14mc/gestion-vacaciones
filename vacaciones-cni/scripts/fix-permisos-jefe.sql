-- Fix: Remover permiso 'ver_todas' del rol JEFE
-- El JEFE solo debe tener 'ver_propias' y 'aprobar_jefe'

-- 1. Verificar permisos actuales del rol JEFE
SELECT 
  r.nombre as rol,
  p.codigo as permiso,
  p.nombre as descripcion
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre = 'Jefe de Departamento'
ORDER BY p.codigo;

-- 2. ELIMINAR el permiso 'ver_todas' del rol JEFE
DELETE FROM roles_permisos
WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'Jefe de Departamento')
  AND permiso_id = (SELECT id FROM permisos WHERE codigo = 'vacaciones.solicitudes.ver_todas');

-- 3. Verificar que quedó correcto (solo debe tener estos permisos):
-- - vacaciones.solicitudes.ver_propias
-- - vacaciones.solicitudes.aprobar_jefe
-- - vacaciones.solicitudes.rechazar
SELECT 
  r.nombre as rol,
  p.codigo as permiso,
  p.nombre as descripcion
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre = 'Jefe de Departamento'
ORDER BY p.codigo;

-- 4. VERIFICACIÓN: Permisos correctos por rol
-- JEFE debe tener: ver_propias, aprobar_jefe, rechazar
-- RRHH debe tener: ver_todas, aprobar_rrhh, rechazar
-- ADMIN debe tener: ver_todas, crear, modificar, eliminar

SELECT 
  r.nombre as rol,
  string_agg(p.codigo, ', ' ORDER BY p.codigo) as permisos
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre IN ('Jefe de Departamento', 'RRHH', 'Administrador')
GROUP BY r.nombre
ORDER BY r.nombre;
