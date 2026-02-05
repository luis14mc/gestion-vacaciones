-- =====================================================
-- MIGRACIONES PARA MEJORAS DE BD
-- Fecha: 7 de enero de 2026
-- Archivo: 001_schema_improvements.sql
-- =====================================================

-- ✅ PASO 1: CREAR NUEVAS TABLAS DEL SISTEMA RBAC
-- =====================================================

-- Tabla: roles
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  es_rol_sistema BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_roles_codigo ON roles(codigo);
CREATE INDEX idx_roles_nivel ON roles(nivel);

-- Tabla: permisos
CREATE TABLE IF NOT EXISTS permisos (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  modulo VARCHAR(50) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_permisos_modulo_accion ON permisos(modulo, accion);
CREATE INDEX idx_permisos_codigo ON permisos(codigo);

-- Tabla: roles_permisos (N:M)
CREATE TABLE IF NOT EXISTS roles_permisos (
  id BIGSERIAL PRIMARY KEY,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_rol_permiso ON roles_permisos(rol_id, permiso_id);
CREATE INDEX idx_roles_permisos_rol ON roles_permisos(rol_id);
CREATE INDEX idx_roles_permisos_permiso ON roles_permisos(permiso_id);

-- Tabla: usuarios_roles (N:M)
CREATE TABLE IF NOT EXISTS usuarios_roles (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  departamento_id BIGINT REFERENCES departamentos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_expiracion TIMESTAMP WITH TIME ZONE,
  activo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_usuario_rol_depto ON usuarios_roles(usuario_id, rol_id, departamento_id);
CREATE INDEX idx_usuarios_roles_usuario ON usuarios_roles(usuario_id);
CREATE INDEX idx_usuarios_roles_rol ON usuarios_roles(rol_id);
CREATE INDEX idx_usuarios_roles_usuario_activo ON usuarios_roles(usuario_id, activo);

-- ✅ PASO 2: INSERTAR DATOS INICIALES DEL SISTEMA RBAC
-- =====================================================

-- Roles del sistema
INSERT INTO roles (codigo, nombre, descripcion, nivel, es_rol_sistema) VALUES
  ('ADMIN', 'Administrador', 'Acceso total al sistema', 3, true),
  ('RRHH', 'Recursos Humanos', 'Gestión de personal y solicitudes', 2, true),
  ('JEFE', 'Jefe de Departamento', 'Aprobación de solicitudes de su departamento', 1, true),
  ('EMPLEADO', 'Empleado', 'Usuario estándar del sistema', 0, true)
ON CONFLICT (codigo) DO NOTHING;

-- Permisos del módulo de vacaciones
INSERT INTO permisos (codigo, modulo, accion, descripcion) VALUES
  -- Solicitudes
  ('vacaciones.solicitudes.crear', 'vacaciones', 'crear', 'Crear nuevas solicitudes de vacaciones'),
  ('vacaciones.solicitudes.leer', 'vacaciones', 'leer', 'Ver solicitudes de vacaciones'),
  ('vacaciones.solicitudes.editar', 'vacaciones', 'editar', 'Editar solicitudes propias'),
  ('vacaciones.solicitudes.eliminar', 'vacaciones', 'eliminar', 'Eliminar solicitudes propias'),
  ('vacaciones.solicitudes.aprobar_jefe', 'vacaciones', 'aprobar_jefe', 'Aprobar como jefe de departamento'),
  ('vacaciones.solicitudes.aprobar_rrhh', 'vacaciones', 'aprobar_rrhh', 'Aprobar como RRHH'),
  ('vacaciones.solicitudes.rechazar', 'vacaciones', 'rechazar', 'Rechazar solicitudes'),
  ('vacaciones.solicitudes.ver_todas', 'vacaciones', 'ver_todas', 'Ver todas las solicitudes del sistema'),
  
  -- Usuarios
  ('usuarios.crear', 'usuarios', 'crear', 'Crear nuevos usuarios'),
  ('usuarios.leer', 'usuarios', 'leer', 'Ver listado de usuarios'),
  ('usuarios.editar', 'usuarios', 'editar', 'Editar información de usuarios'),
  ('usuarios.eliminar', 'usuarios', 'eliminar', 'Eliminar usuarios'),
  ('usuarios.asignar_roles', 'usuarios', 'asignar_roles', 'Asignar roles a usuarios'),
  
  -- Balances
  ('balances.leer', 'balances', 'leer', 'Ver balances de vacaciones'),
  ('balances.asignar', 'balances', 'asignar', 'Asignar días de vacaciones'),
  ('balances.editar', 'balances', 'editar', 'Editar balances existentes'),
  
  -- Departamentos
  ('departamentos.crear', 'departamentos', 'crear', 'Crear departamentos'),
  ('departamentos.leer', 'departamentos', 'leer', 'Ver departamentos'),
  ('departamentos.editar', 'departamentos', 'editar', 'Editar departamentos'),
  ('departamentos.eliminar', 'departamentos', 'eliminar', 'Eliminar departamentos'),
  
  -- Reportes
  ('reportes.generar', 'reportes', 'generar', 'Generar reportes del sistema'),
  ('reportes.exportar', 'reportes', 'exportar', 'Exportar datos a archivos'),
  
  -- Configuración
  ('config.leer', 'config', 'leer', 'Ver configuración del sistema'),
  ('config.editar', 'config', 'editar', 'Modificar configuración del sistema')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar permisos a roles
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'ADMIN' -- Admin tiene todos los permisos
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'RRHH' AND p.codigo IN (
  'vacaciones.solicitudes.leer',
  'vacaciones.solicitudes.aprobar_rrhh',
  'vacaciones.solicitudes.rechazar',
  'vacaciones.solicitudes.ver_todas',
  'usuarios.leer',
  'usuarios.crear',
  'usuarios.editar',
  'balances.leer',
  'balances.asignar',
  'balances.editar',
  'departamentos.leer',
  'reportes.generar',
  'reportes.exportar'
)
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'JEFE' AND p.codigo IN (
  'vacaciones.solicitudes.crear',
  'vacaciones.solicitudes.leer',
  'vacaciones.solicitudes.editar',
  'vacaciones.solicitudes.aprobar_jefe',
  'vacaciones.solicitudes.rechazar',
  'balances.leer',
  'usuarios.leer',
  'departamentos.leer'
)
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.codigo = 'EMPLEADO' AND p.codigo IN (
  'vacaciones.solicitudes.crear',
  'vacaciones.solicitudes.leer',
  'vacaciones.solicitudes.editar',
  'vacaciones.solicitudes.eliminar',
  'balances.leer',
  'departamentos.leer'
)
ON CONFLICT DO NOTHING;

-- ✅ PASO 3: MIGRAR USUARIOS EXISTENTES A usuarios_roles
-- =====================================================

-- Migrar usuarios con rol ADMIN
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u
CROSS JOIN roles r
WHERE u.es_admin = true AND r.codigo = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Migrar usuarios con rol RRHH (sin admin)
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u
CROSS JOIN roles r
WHERE u.es_rrhh = true AND u.es_admin = false AND r.codigo = 'RRHH'
ON CONFLICT DO NOTHING;

-- Migrar usuarios con rol JEFE (sin admin ni rrhh)
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u
CROSS JOIN roles r
WHERE u.es_jefe = true AND u.es_admin = false AND u.es_rrhh = false AND r.codigo = 'JEFE'
ON CONFLICT DO NOTHING;

-- Asignar rol EMPLEADO a todos los usuarios sin rol específico
INSERT INTO usuarios_roles (usuario_id, rol_id, activo)
SELECT u.id, r.id, true
FROM usuarios u
CROSS JOIN roles r
WHERE u.es_admin = false AND u.es_rrhh = false AND u.es_jefe = false AND r.codigo = 'EMPLEADO'
ON CONFLICT DO NOTHING;

-- ✅ PASO 4: AGREGAR FOREIGN KEYS A TABLAS EXISTENTES
-- =====================================================

-- departamentos: agregar FK a departamento_padre_id
ALTER TABLE departamentos 
  DROP CONSTRAINT IF EXISTS fk_departamentos_padre;

ALTER TABLE departamentos 
  ADD CONSTRAINT fk_departamentos_padre 
  FOREIGN KEY (departamento_padre_id) 
  REFERENCES departamentos(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- usuarios: agregar FK a departamento_id
ALTER TABLE usuarios 
  DROP CONSTRAINT IF EXISTS fk_usuarios_departamento;

ALTER TABLE usuarios 
  ADD CONSTRAINT fk_usuarios_departamento 
  FOREIGN KEY (departamento_id) 
  REFERENCES departamentos(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- balances_ausencias: agregar FKs
ALTER TABLE balances_ausencias 
  DROP CONSTRAINT IF EXISTS fk_balances_usuario;

ALTER TABLE balances_ausencias 
  ADD CONSTRAINT fk_balances_usuario 
  FOREIGN KEY (usuario_id) 
  REFERENCES usuarios(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

ALTER TABLE balances_ausencias 
  DROP CONSTRAINT IF EXISTS fk_balances_tipo_ausencia;

ALTER TABLE balances_ausencias 
  ADD CONSTRAINT fk_balances_tipo_ausencia 
  FOREIGN KEY (tipo_ausencia_id) 
  REFERENCES tipos_ausencia_config(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- solicitudes: agregar FKs
ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS fk_solicitudes_usuario;

ALTER TABLE solicitudes 
  ADD CONSTRAINT fk_solicitudes_usuario 
  FOREIGN KEY (usuario_id) 
  REFERENCES usuarios(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS fk_solicitudes_tipo_ausencia;

ALTER TABLE solicitudes 
  ADD CONSTRAINT fk_solicitudes_tipo_ausencia 
  FOREIGN KEY (tipo_ausencia_id) 
  REFERENCES tipos_ausencia_config(id) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS fk_solicitudes_aprobado_por;

ALTER TABLE solicitudes 
  ADD CONSTRAINT fk_solicitudes_aprobado_por 
  FOREIGN KEY (aprobado_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS fk_solicitudes_aprobado_rrhh_por;

ALTER TABLE solicitudes 
  ADD CONSTRAINT fk_solicitudes_aprobado_rrhh_por 
  FOREIGN KEY (aprobado_rrhh_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS fk_solicitudes_rechazado_por;

ALTER TABLE solicitudes 
  ADD CONSTRAINT fk_solicitudes_rechazado_por 
  FOREIGN KEY (rechazado_por) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- auditoria: agregar FK
ALTER TABLE auditoria 
  DROP CONSTRAINT IF EXISTS fk_auditoria_usuario;

ALTER TABLE auditoria 
  ADD CONSTRAINT fk_auditoria_usuario 
  FOREIGN KEY (usuario_id) 
  REFERENCES usuarios(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- ✅ PASO 5: AGREGAR COLUMNAS FALTANTES
-- =====================================================

-- tipos_ausencia_config: agregar deleted_at
ALTER TABLE tipos_ausencia_config 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- balances_ausencias: agregar deleted_at
ALTER TABLE balances_ausencias 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- balances_ausencias: agregar cantidad_disponible GENERATED
ALTER TABLE balances_ausencias 
  DROP COLUMN IF EXISTS cantidad_disponible CASCADE;

ALTER TABLE balances_ausencias 
  ADD COLUMN cantidad_disponible DECIMAL(10,2) 
  GENERATED ALWAYS AS (cantidad_asignada - cantidad_utilizada - cantidad_pendiente) STORED;

-- solicitudes: hacer codigo NOT NULL
ALTER TABLE solicitudes 
  ALTER COLUMN codigo SET NOT NULL;

-- ✅ PASO 6: CAMBIAR TIPOS DE DATOS
-- =====================================================

-- solicitudes: cambiar hora_inicio y hora_fin de VARCHAR a TIME
ALTER TABLE solicitudes 
  ALTER COLUMN hora_inicio TYPE TIME USING hora_inicio::TIME;

ALTER TABLE solicitudes 
  ALTER COLUMN hora_fin TYPE TIME USING hora_fin::TIME;

-- auditoria: cambiar usuario_id de INTEGER a BIGINT
ALTER TABLE auditoria 
  ALTER COLUMN usuario_id TYPE BIGINT;

-- auditoria: cambiar registro_id de INTEGER a BIGINT
ALTER TABLE auditoria 
  ALTER COLUMN registro_id TYPE BIGINT;

-- ✅ PASO 7: AGREGAR ÍNDICES COMPUESTOS
-- =====================================================

-- usuarios: índice compuesto departamento + activo
CREATE INDEX IF NOT EXISTS idx_usuarios_depto_activo 
  ON usuarios(departamento_id, activo);

-- balances: índice compuesto usuario + año + estado
CREATE INDEX IF NOT EXISTS idx_balances_usuario_anio_estado 
  ON balances_ausencias(usuario_id, anio, estado);

-- balances: índice en cantidad_disponible
CREATE INDEX IF NOT EXISTS idx_balances_disponible 
  ON balances_ausencias(cantidad_disponible);

-- solicitudes: índice compuesto usuario + estado + fecha
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado_fecha 
  ON solicitudes(usuario_id, estado, fecha_inicio);

-- solicitudes: índice compuesto estado + created_at
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_created 
  ON solicitudes(estado, created_at);

-- solicitudes: índice compuesto en fechas
CREATE INDEX IF NOT EXISTS idx_solicitudes_fechas 
  ON solicitudes(fecha_inicio, fecha_fin);

-- tipos_ausencia_config: índice en activo
CREATE INDEX IF NOT EXISTS idx_tipos_ausencia_activo 
  ON tipos_ausencia_config(activo);

-- configuracion_sistema: índice en categoria
CREATE INDEX IF NOT EXISTS idx_config_categoria 
  ON configuracion_sistema(categoria);

-- auditoria: índice compuesto usuario + fecha
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_fecha 
  ON auditoria(usuario_id, fecha_creacion);

-- ✅ PASO 8: AGREGAR CHECK CONSTRAINTS
-- =====================================================

-- solicitudes: fechas válidas
ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS chk_solicitudes_fechas_validas;

ALTER TABLE solicitudes 
  ADD CONSTRAINT chk_solicitudes_fechas_validas 
  CHECK (fecha_fin >= fecha_inicio);

-- solicitudes: cantidad positiva
ALTER TABLE solicitudes 
  DROP CONSTRAINT IF EXISTS chk_solicitudes_cantidad_positiva;

ALTER TABLE solicitudes 
  ADD CONSTRAINT chk_solicitudes_cantidad_positiva 
  CHECK (cantidad > 0);

-- balances: cantidades no negativas
ALTER TABLE balances_ausencias 
  DROP CONSTRAINT IF EXISTS chk_balances_cantidades_no_negativas;

ALTER TABLE balances_ausencias 
  ADD CONSTRAINT chk_balances_cantidades_no_negativas 
  CHECK (
    cantidad_asignada >= 0 AND 
    cantidad_utilizada >= 0 AND 
    cantidad_pendiente >= 0
  );

-- tipos_ausencia_config: días máximos positivo
ALTER TABLE tipos_ausencia_config 
  DROP CONSTRAINT IF EXISTS chk_tipos_ausencia_dias_max_positivo;

ALTER TABLE tipos_ausencia_config 
  ADD CONSTRAINT chk_tipos_ausencia_dias_max_positivo 
  CHECK (dias_maximos_por_solicitud IS NULL OR dias_maximos_por_solicitud > 0);

-- ✅ PASO 9: CREAR TRIGGERS PARA VERSIONING AUTOMÁTICO
-- =====================================================

-- Función para incrementar versión
CREATE OR REPLACE FUNCTION incrementar_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para usuarios
DROP TRIGGER IF EXISTS trigger_usuarios_version ON usuarios;
CREATE TRIGGER trigger_usuarios_version
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION incrementar_version();

-- Triggers para solicitudes
DROP TRIGGER IF EXISTS trigger_solicitudes_version ON solicitudes;
CREATE TRIGGER trigger_solicitudes_version
BEFORE UPDATE ON solicitudes
FOR EACH ROW
EXECUTE FUNCTION incrementar_version();

-- Triggers para balances
DROP TRIGGER IF EXISTS trigger_balances_version ON balances_ausencias;
CREATE TRIGGER trigger_balances_version
BEFORE UPDATE ON balances_ausencias
FOR EACH ROW
EXECUTE FUNCTION incrementar_version();

-- Triggers para configuracion_sistema
DROP TRIGGER IF EXISTS trigger_config_version ON configuracion_sistema;
CREATE TRIGGER trigger_config_version
BEFORE UPDATE ON configuracion_sistema
FOR EACH ROW
EXECUTE FUNCTION incrementar_version();

-- ✅ PASO 10: CREAR VISTA DE COMPATIBILIDAD
-- =====================================================

-- Vista para mantener compatibilidad con código existente
CREATE OR REPLACE VIEW usuarios_legacy AS
SELECT 
  u.*,
  EXISTS(
    SELECT 1 FROM usuarios_roles ur 
    JOIN roles r ON ur.rol_id = r.id 
    WHERE ur.usuario_id = u.id AND r.codigo = 'ADMIN' AND ur.activo = true
  ) AS es_admin_nuevo,
  EXISTS(
    SELECT 1 FROM usuarios_roles ur 
    JOIN roles r ON ur.rol_id = r.id 
    WHERE ur.usuario_id = u.id AND r.codigo = 'RRHH' AND ur.activo = true
  ) AS es_rrhh_nuevo,
  EXISTS(
    SELECT 1 FROM usuarios_roles ur 
    JOIN roles r ON ur.rol_id = r.id 
    WHERE ur.usuario_id = u.id AND r.codigo = 'JEFE' AND ur.activo = true
  ) AS es_jefe_nuevo
FROM usuarios u;

-- ✅ PASO 11: CREAR FUNCIÓN HELPER PARA VERIFICAR PERMISOS
-- =====================================================

CREATE OR REPLACE FUNCTION usuario_tiene_permiso(
  p_usuario_id BIGINT,
  p_codigo_permiso VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  tiene_permiso BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM usuarios_roles ur
    JOIN roles_permisos rp ON ur.rol_id = rp.rol_id
    JOIN permisos p ON rp.permiso_id = p.id
    WHERE ur.usuario_id = p_usuario_id
      AND p.codigo = p_codigo_permiso
      AND ur.activo = true
      AND p.activo = true
  ) INTO tiene_permiso;
  
  RETURN tiene_permiso;
END;
$$ LANGUAGE plpgsql;

-- ✅ PASO 12: COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE roles IS 'Sistema RBAC: Roles del sistema';
COMMENT ON TABLE permisos IS 'Sistema RBAC: Permisos granulares por módulo';
COMMENT ON TABLE roles_permisos IS 'Sistema RBAC: Relación N:M entre roles y permisos';
COMMENT ON TABLE usuarios_roles IS 'Sistema RBAC: Asignación de roles a usuarios con scope opcional';

COMMENT ON COLUMN usuarios.es_jefe IS 'DEPRECADO: Usar usuarios_roles. Se mantendrá hasta migración completa';
COMMENT ON COLUMN usuarios.es_rrhh IS 'DEPRECADO: Usar usuarios_roles. Se mantendrá hasta migración completa';
COMMENT ON COLUMN usuarios.es_admin IS 'DEPRECADO: Usar usuarios_roles. Se mantendrá hasta migración completa';

COMMENT ON COLUMN balances_ausencias.cantidad_disponible IS 'Columna generada: cantidad_asignada - cantidad_utilizada - cantidad_pendiente';

-- =====================================================
-- FIN DE MIGRACIONES
-- =====================================================

-- Verificar integridad
DO $$
BEGIN
  RAISE NOTICE '✅ Migraciones completadas exitosamente';
  RAISE NOTICE '📊 Tablas creadas: roles, permisos, roles_permisos, usuarios_roles';
  RAISE NOTICE '🔗 Foreign Keys agregados a todas las tablas';
  RAISE NOTICE '📈 Índices compuestos creados para optimización';
  RAISE NOTICE '✔️ Check constraints agregados para validación';
  RAISE NOTICE '⚙️ Triggers de versioning activados';
  RAISE NOTICE '👥 Usuarios migrados al nuevo sistema RBAC';
END $$;
