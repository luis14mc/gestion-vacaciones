-- ============================================
-- Seed completo de base de datos con RBAC
-- Sistema de Gestión de Vacaciones - CNI Honduras
-- ============================================

BEGIN;

-- ============================================
-- 1. ROLES DEL SISTEMA
-- ============================================
INSERT INTO roles (codigo, nombre, descripcion, nivel, activo, es_rol_sistema) VALUES
('ADMIN', 'Administrador', 'Acceso completo al sistema', 3, true, true),
('RRHH', 'Recursos Humanos', 'Gestión de personal y aprobaciones finales', 2, true, true),
('JEFE', 'Jefe de Departamento', 'Aprobación de solicitudes del departamento', 1, true, true),
('EMPLEADO', 'Empleado', 'Usuario estándar del sistema', 0, true, true)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  nivel = EXCLUDED.nivel,
  activo = EXCLUDED.activo;

-- ============================================
-- 2. PERMISOS DEL SISTEMA (24 permisos)
-- ============================================

-- Permisos de Vacaciones
INSERT INTO permisos (codigo, nombre, descripcion, categoria, activo) VALUES
-- Solicitudes
('vacaciones.solicitudes.crear', 'Crear solicitudes', 'Crear nuevas solicitudes de vacaciones', 'vacaciones', true),
('vacaciones.solicitudes.ver_propias', 'Ver solicitudes propias', 'Ver solo las solicitudes propias', 'vacaciones', true),
('vacaciones.solicitudes.ver_todas', 'Ver todas las solicitudes', 'Ver solicitudes de todos los usuarios', 'vacaciones', true),
('vacaciones.solicitudes.aprobar_jefe', 'Aprobar como jefe', 'Aprobar solicitudes como jefe de departamento', 'vacaciones', true),
('vacaciones.solicitudes.aprobar_rrhh', 'Aprobar como RRHH', 'Aprobación final de RRHH', 'vacaciones', true),
('vacaciones.solicitudes.rechazar', 'Rechazar solicitudes', 'Rechazar solicitudes de vacaciones', 'vacaciones', true),
('vacaciones.solicitudes.cancelar', 'Cancelar solicitudes', 'Cancelar solicitudes aprobadas', 'vacaciones', true),

-- Usuarios
('usuarios.ver', 'Ver usuarios', 'Ver lista de usuarios del sistema', 'usuarios', true),
('usuarios.crear', 'Crear usuarios', 'Crear nuevos usuarios', 'usuarios', true),
('usuarios.editar', 'Editar usuarios', 'Modificar datos de usuarios', 'usuarios', true),
('usuarios.eliminar', 'Eliminar usuarios', 'Eliminar usuarios del sistema', 'usuarios', true),
('usuarios.asignar_roles', 'Asignar roles', 'Asignar y remover roles de usuarios', 'usuarios', true),

-- Balances
('balances.ver_propios', 'Ver balance propio', 'Ver el balance personal de vacaciones', 'balances', true),
('balances.ver_todos', 'Ver todos los balances', 'Ver balances de todos los usuarios', 'balances', true),
('balances.editar', 'Editar balances', 'Ajustar balances de vacaciones manualmente', 'balances', true),

-- Reportes
('reportes.general', 'Reportes generales', 'Ver reportes generales del sistema', 'reportes', true),
('reportes.departamento', 'Reportes por departamento', 'Ver reportes de departamentos específicos', 'reportes', true),
('reportes.exportar', 'Exportar reportes', 'Exportar reportes a Excel/PDF', 'reportes', true),

-- Departamentos
('departamentos.ver', 'Ver departamentos', 'Ver lista de departamentos', 'departamentos', true),
('departamentos.editar', 'Editar departamentos', 'Modificar departamentos', 'departamentos', true),

-- Años Laborales
('anos_laborales.ver', 'Ver años laborales', 'Ver configuración de años laborales', 'anos_laborales', true),
('anos_laborales.editar', 'Editar años laborales', 'Modificar años laborales', 'anos_laborales', true),

-- Configuración
('config.sistema', 'Configurar sistema', 'Acceso a configuración del sistema', 'sistema', true),
('dashboard.completo', 'Dashboard completo', 'Ver dashboard con todas las estadísticas', 'sistema', true)

ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo;

-- ============================================
-- 3. ASIGNACIÓN DE PERMISOS A ROLES
-- ============================================

-- EMPLEADO - Permisos básicos (8 permisos)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'EMPLEADO' AND p.codigo IN (
  'vacaciones.solicitudes.crear',
  'vacaciones.solicitudes.ver_propias',
  'vacaciones.solicitudes.cancelar',
  'balances.ver_propios',
  'usuarios.ver',
  'departamentos.ver',
  'anos_laborales.ver',
  'dashboard.completo'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- JEFE - Permisos de empleado + aprobación (13 permisos)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'JEFE' AND p.codigo IN (
  -- Permisos de EMPLEADO
  'vacaciones.solicitudes.crear',
  'vacaciones.solicitudes.ver_propias',
  'vacaciones.solicitudes.cancelar',
  'balances.ver_propios',
  'usuarios.ver',
  'departamentos.ver',
  'anos_laborales.ver',
  'dashboard.completo',
  -- Permisos adicionales de JEFE
  'vacaciones.solicitudes.ver_todas',
  'vacaciones.solicitudes.aprobar_jefe',
  'vacaciones.solicitudes.rechazar',
  'balances.ver_todos',
  'reportes.departamento',
  'reportes.exportar'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- RRHH - Permisos de jefe + gestión usuarios (20 permisos)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'RRHH' AND p.codigo IN (
  -- Permisos de JEFE
  'vacaciones.solicitudes.crear',
  'vacaciones.solicitudes.ver_propias',
  'vacaciones.solicitudes.cancelar',
  'vacaciones.solicitudes.ver_todas',
  'vacaciones.solicitudes.aprobar_jefe',
  'vacaciones.solicitudes.rechazar',
  'balances.ver_propios',
  'balances.ver_todos',
  'usuarios.ver',
  'departamentos.ver',
  'anos_laborales.ver',
  'reportes.departamento',
  'dashboard.completo',
  -- Permisos adicionales de RRHH
  'vacaciones.solicitudes.aprobar_rrhh',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.eliminar',
  'balances.editar',
  'reportes.general',
  'reportes.exportar'
)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ADMIN - Todos los permisos (24 permisos)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'ADMIN'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ============================================
-- 4. DEPARTAMENTOS
-- ============================================
INSERT INTO departamentos (nombre, codigo, activo) VALUES
('Tecnología de la Información', 'TI', true),
('Recursos Humanos', 'RRHH', true),
('Finanzas', 'FIN', true),
('Operaciones', 'OPS', true),
('Dirección General', 'DIR', true)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

-- ============================================
-- 5. AÑO LABORAL ACTUAL
-- ============================================
INSERT INTO anos_laborales (ano, fecha_inicio, fecha_fin, activo, dias_vacaciones_base) VALUES
(2026, '2026-01-01', '2026-12-31', true, 20)
ON CONFLICT (ano) DO UPDATE SET
  activo = EXCLUDED.activo,
  dias_vacaciones_base = EXCLUDED.dias_vacaciones_base;

-- ============================================
-- 6. USUARIOS DE PRUEBA
-- ============================================
-- Password para todos: Admin123!
-- Hash generado con bcrypt rounds=10
INSERT INTO usuarios (
  email, password, nombre, apellido, 
  departamento_id, cargo, fecha_ingreso, activo
) VALUES
-- Admin
(
  'admin@cni.hn',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Carlos',
  'Administrador',
  (SELECT id FROM departamentos WHERE codigo = 'DIR'),
  'Director General',
  '2020-01-01',
  true
),
-- RRHH
(
  'rrhh@cni.hn',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'María',
  'González',
  (SELECT id FROM departamentos WHERE codigo = 'RRHH'),
  'Jefa de Recursos Humanos',
  '2020-03-01',
  true
),
-- Jefe TI
(
  'jefe.ti@cni.hn',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Juan',
  'Martínez',
  (SELECT id FROM departamentos WHERE codigo = 'TI'),
  'Jefe de TI',
  '2021-06-01',
  true
),
-- Empleado TI
(
  'empleado@cni.hn',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Ana',
  'López',
  (SELECT id FROM departamentos WHERE codigo = 'TI'),
  'Desarrolladora',
  '2022-09-01',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

-- ============================================
-- 7. ASIGNAR ROLES A USUARIOS
-- ============================================

-- Admin tiene rol ADMIN
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u, roles r
WHERE u.email = 'admin@cni.hn' AND r.codigo = 'ADMIN'
ON CONFLICT (usuario_id, rol_id) DO UPDATE SET activo = true;

-- RRHH tiene rol RRHH
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u, roles r
WHERE u.email = 'rrhh@cni.hn' AND r.codigo = 'RRHH'
ON CONFLICT (usuario_id, rol_id) DO UPDATE SET activo = true;

-- Jefe TI tiene rol JEFE con scope de departamento TI
INSERT INTO usuarios_roles (usuario_id, rol_id, departamento_id, activo)
SELECT u.id, r.id, d.id, true
FROM usuarios u, roles r, departamentos d
WHERE u.email = 'jefe.ti@cni.hn' 
  AND r.codigo = 'JEFE' 
  AND d.codigo = 'TI'
ON CONFLICT (usuario_id, rol_id) DO UPDATE SET 
  activo = true,
  departamento_id = EXCLUDED.departamento_id;

-- Empleado tiene rol EMPLEADO
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u, roles r
WHERE u.email = 'empleado@cni.hn' AND r.codigo = 'EMPLEADO'
ON CONFLICT (usuario_id, rol_id) DO UPDATE SET activo = true;

-- ============================================
-- 8. BALANCES DE VACACIONES
-- ============================================
INSERT INTO balances (usuario_id, ano_laboral_id, dias_asignados, dias_tomados, dias_pendientes)
SELECT 
  u.id,
  a.id,
  20, -- días base
  0,  -- ninguno tomado aún
  0   -- ninguno pendiente
FROM usuarios u
CROSS JOIN anos_laborales a
WHERE a.ano = 2026
ON CONFLICT (usuario_id, ano_laboral_id) DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 'Seed completado exitosamente' as status;

SELECT 
  'Roles creados: ' || COUNT(*) as info 
FROM roles;

SELECT 
  'Permisos creados: ' || COUNT(*) as info 
FROM permisos;

SELECT 
  'Usuarios creados: ' || COUNT(*) as info 
FROM usuarios;

SELECT 
  'Asignaciones de roles: ' || COUNT(*) as info 
FROM usuarios_roles;

-- Mostrar resumen de permisos por rol
SELECT 
  r.codigo as rol,
  r.nombre,
  COUNT(rp.permiso_id) as total_permisos
FROM roles r
LEFT JOIN roles_permisos rp ON r.id = rp.rol_id
GROUP BY r.id, r.codigo, r.nombre
ORDER BY r.nivel DESC;
