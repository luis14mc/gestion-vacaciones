-- Script temporal para crear balances de prueba
-- Día 2, Actividad 2.2 - Testing POST /api/solicitudes

-- 1. Primero verificar qué tipos de ausencia existen
SELECT id, tipo, nombre, activo FROM tipos_ausencia_config ORDER BY id;

-- 2. Obtener IDs de usuarios de prueba
SELECT id, email, nombre, apellido FROM usuarios 
WHERE email IN ('admin@cni.hn', 'rrhh@cni.hn', 'jefe.tecnologia@cni.hn', 'empleado@cni.hn')
ORDER BY id;

-- 3. Insertar balances de vacaciones para 2026 (tipo_ausencia_id = 1 suele ser Vacaciones)
-- Usar INSERT ... ON CONFLICT para evitar duplicados

INSERT INTO balances_ausencias (
  usuario_id, 
  tipo_ausencia_id, 
  anio, 
  cantidad_asignada, 
  cantidad_utilizada, 
  cantidad_pendiente,
  estado,
  created_at,
  updated_at
)
VALUES 
  -- Admin (id=1): 20 días
  (1, 1, 2026, 20, 0, 0, 'activo', NOW(), NOW()),
  
  -- RRHH (id=2): 20 días
  (2, 1, 2026, 20, 0, 0, 'activo', NOW(), NOW()),
  
  -- Jefe (id=3): 15 días
  (3, 1, 2026, 15, 0, 0, 'activo', NOW(), NOW()),
  
  -- Empleado (id=4): 15 días
  (4, 1, 2026, 15, 0, 0, 'activo', NOW(), NOW())

ON CONFLICT (usuario_id, tipo_ausencia_id, anio) 
DO UPDATE SET
  cantidad_asignada = EXCLUDED.cantidad_asignada,
  cantidad_utilizada = 0,
  cantidad_pendiente = 0,
  estado = 'activo',
  updated_at = NOW();

-- 4. Verificar que se crearon correctamente
SELECT 
  u.id,
  u.email,
  u.nombre || ' ' || u.apellido as nombre_completo,
  b.anio,
  b.cantidad_asignada as asignados,
  b.cantidad_utilizada as usados,
  b.cantidad_pendiente as pendientes,
  (b.cantidad_asignada - b.cantidad_utilizada - b.cantidad_pendiente) as disponibles,
  ta.nombre as tipo_ausencia,
  b.estado
FROM usuarios u
JOIN balances_ausencias b ON u.id = b.usuario_id
JOIN tipos_ausencia_config ta ON b.tipo_ausencia_id = ta.id
WHERE u.email IN ('admin@cni.hn', 'rrhh@cni.hn', 'jefe.tecnologia@cni.hn', 'empleado@cni.hn')
  AND b.anio = 2026
ORDER BY u.id;

-- 5. Verificar solicitudes existentes (limpiar si hay duplicados de pruebas anteriores)
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
  AND s.fecha_inicio >= '2026-01-01'
ORDER BY s.created_at DESC;

-- OPCIONAL: Limpiar solicitudes de prueba anteriores
-- CUIDADO: Solo ejecutar si sabes que son datos de prueba
/*
DELETE FROM solicitudes 
WHERE usuario_id IN (1, 2, 3, 4) 
  AND fecha_inicio >= '2026-02-01'
  AND estado = 'pendiente';
*/
