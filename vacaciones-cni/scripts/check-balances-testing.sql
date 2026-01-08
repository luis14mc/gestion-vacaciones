-- Verificar balances de usuarios para testing
-- Día 2, Actividad 2.2

-- Ver balances actuales de todos los usuarios de prueba
SELECT 
  u.id,
  u.email,
  u.nombre,
  b.anio,
  b.cantidad_asignada,
  b.cantidad_utilizada,
  b.cantidad_pendiente,
  (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as disponible,
  ta.nombre as tipo_ausencia
FROM usuarios u
LEFT JOIN balances_ausencias b ON u.id = b.usuario_id AND b.anio = 2026
LEFT JOIN tipos_ausencia_config ta ON b.tipo_ausencia_id = ta.id
WHERE u.email IN ('admin@cni.hn', 'rrhh@cni.hn', 'jefe.tecnologia@cni.hn', 'empleado@cni.hn')
ORDER BY u.id, ta.nombre;

-- Si no hay balances, crearlos:
-- IMPORTANTE: Ejecutar solo si la query anterior muestra NULL

-- Obtener ID del tipo de ausencia "Vacaciones"
-- SELECT id, nombre FROM tipos_ausencia_config WHERE tipo = 'vacaciones';

-- Crear balances para usuarios de prueba (ejemplo con tipo_ausencia_id = 1)
/*
INSERT INTO balances_ausencias (usuario_id, tipo_ausencia_id, anio, cantidad_asignada, cantidad_utilizada, cantidad_pendiente, estado)
VALUES 
  (1, 1, 2026, 20, 0, 0, 'activo'),  -- Admin
  (2, 1, 2026, 20, 0, 0, 'activo'),  -- RRHH
  (3, 1, 2026, 15, 0, 0, 'activo'),  -- Jefe
  (4, 1, 2026, 15, 0, 0, 'activo')   -- Empleado
ON CONFLICT (usuario_id, tipo_ausencia_id, anio) DO NOTHING;
*/

-- Verificar solicitudes existentes (para no duplicar en pruebas)
SELECT 
  s.id,
  s.codigo,
  u.email,
  s.fecha_inicio,
  s.fecha_fin,
  s.cantidad,
  s.estado,
  s.created_at
FROM solicitudes s
JOIN usuarios u ON s.usuario_id = u.id
WHERE u.email IN ('admin@cni.hn', 'rrhh@cni.hn', 'jefe.tecnologia@cni.hn', 'empleado@cni.hn')
ORDER BY s.created_at DESC;
