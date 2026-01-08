-- Verificar y agregar permiso 'rechazar' al rol JEFE

-- 1. Verificar si ya tiene el permiso
SELECT 
  r.nombre as rol,
  p.codigo as permiso
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre = 'Jefe de Departamento'
  AND p.codigo = 'vacaciones.solicitudes.rechazar';

-- 2. Si no existe, agregarlo
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 
  (SELECT id FROM roles WHERE nombre = 'Jefe de Departamento'),
  (SELECT id FROM permisos WHERE codigo = 'vacaciones.solicitudes.rechazar')
WHERE NOT EXISTS (
  SELECT 1 FROM roles_permisos
  WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'Jefe de Departamento')
    AND permiso_id = (SELECT id FROM permisos WHERE codigo = 'vacaciones.solicitudes.rechazar')
);

-- 3. Verificar permisos finales del JEFE (debe tener estos 3):
SELECT 
  r.nombre as rol,
  p.codigo as permiso,
  p.nombre as descripcion
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.nombre = 'Jefe de Departamento'
ORDER BY p.codigo;

-- Resultado esperado:
-- vacaciones.solicitudes.aprobar_jefe
-- vacaciones.solicitudes.rechazar
-- vacaciones.solicitudes.ver_propias
