-- Verificar permisos del rol JEFE
SELECT 
  r.codigo as rol,
  p.codigo as permiso,
  p.nombre as descripcion
FROM roles r
JOIN roles_permisos rp ON r.id = rp.rol_id
JOIN permisos p ON rp.permiso_id = p.id
WHERE r.codigo = 'JEFE'
  AND p.codigo LIKE '%solicitudes%'
ORDER BY p.codigo;
