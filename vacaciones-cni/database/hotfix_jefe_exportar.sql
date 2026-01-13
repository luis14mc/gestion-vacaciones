-- Hotfix: Agregar permiso reportes.exportar a rol JEFE
-- Ejecutar: psql <DATABASE_URL> -f database/hotfix_jefe_exportar.sql

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id 
FROM roles r, permisos p 
WHERE r.codigo = 'JEFE' 
  AND p.codigo = 'reportes.exportar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Verificar
SELECT 
  r.nombre as rol,
  p.codigo as permiso,
  p.descripcion
FROM roles r
JOIN roles_permisos rp ON rp.rol_id = r.id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.codigo = 'JEFE' AND p.codigo = 'reportes.exportar';
