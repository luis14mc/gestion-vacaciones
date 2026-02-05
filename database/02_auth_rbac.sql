-- =====================================================
-- 01_auth_rbac.sql
-- Sistema RBAC (Role-Based Access Control)
-- PostgreSQL - Ejecutar PRIMERO después de ENUMs
-- =====================================================
-- Autor: Senior Database Architect
-- Fecha: 5 febrero 2026
-- Versión: 3.0
-- =====================================================

-- =====================================================
-- TABLA: roles
-- Roles del sistema con jerarquía por nivel
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  es_rol_sistema BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Check Constraints
  CONSTRAINT chk_roles_nivel_valido CHECK (nivel >= 0 AND nivel <= 10),
  CONSTRAINT chk_roles_codigo_formato CHECK (codigo ~ '^[A-Z_]+$')
);

-- Índices optimizados para búsquedas frecuentes
CREATE INDEX idx_roles_codigo ON roles(codigo) WHERE activo = true;
CREATE INDEX idx_roles_nivel ON roles(nivel, activo);
CREATE INDEX idx_roles_sistema ON roles(es_rol_sistema, activo);

COMMENT ON TABLE roles IS 'Roles del sistema RBAC con jerarquía por nivel';
COMMENT ON COLUMN roles.nivel IS '0=empleado, 1=jefe, 2=rrhh, 3=admin, 4+=custom';
COMMENT ON COLUMN roles.es_rol_sistema IS 'true si es rol predefinido (no modificable)';

-- =====================================================
-- TABLA: permisos
-- Permisos granulares por módulo y acción
-- =====================================================
CREATE TABLE IF NOT EXISTS permisos (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  modulo VARCHAR(50) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Check Constraints
  CONSTRAINT chk_permisos_codigo_formato CHECK (codigo ~ '^[a-z_]+\.[a-z_]+\.[a-z_]+$'),
  CONSTRAINT chk_permisos_modulo_minusculas CHECK (modulo = LOWER(modulo)),
  CONSTRAINT chk_permisos_accion_minusculas CHECK (accion = LOWER(accion))
);

-- Índices compuestos para búsqueda de permisos
CREATE INDEX idx_permisos_modulo_accion ON permisos(modulo, accion) WHERE activo = true;
CREATE INDEX idx_permisos_codigo ON permisos(codigo) WHERE activo = true;
CREATE INDEX idx_permisos_modulo ON permisos(modulo) WHERE activo = true;

COMMENT ON TABLE permisos IS 'Permisos granulares con formato modulo.recurso.accion';
COMMENT ON COLUMN permisos.codigo IS 'Formato: modulo.recurso.accion (ej: vacaciones.solicitudes.aprobar)';

-- =====================================================
-- TABLA: roles_permisos (N:M)
-- Asignación de permisos a roles
-- =====================================================
CREATE TABLE IF NOT EXISTS roles_permisos (
  id BIGSERIAL PRIMARY KEY,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint único para evitar duplicados
  CONSTRAINT uq_rol_permiso UNIQUE (rol_id, permiso_id)
);

-- Índices optimizados para queries de autorización
CREATE INDEX idx_roles_permisos_rol ON roles_permisos(rol_id);
CREATE INDEX idx_roles_permisos_permiso ON roles_permisos(permiso_id);
-- Índice compuesto con INCLUDE para evitar table lookup
CREATE INDEX idx_roles_permisos_lookup ON roles_permisos(rol_id, permiso_id) 
  INCLUDE (created_at);

COMMENT ON TABLE roles_permisos IS 'Relación N:M entre roles y permisos';

-- =====================================================
-- TABLA: usuarios_roles (N:M con scope)
-- Asignación de roles a usuarios con scope departamental
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios_roles (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  departamento_id BIGINT REFERENCES departamentos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion TIMESTAMP WITH TIME ZONE,
  activo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint único: Un usuario no puede tener el mismo rol dos veces en el mismo departamento
  CONSTRAINT uq_usuario_rol_depto UNIQUE NULLS NOT DISTINCT (usuario_id, rol_id, departamento_id),
  
  -- Check Constraints
  CONSTRAINT chk_fecha_expiracion_futura CHECK (
    fecha_expiracion IS NULL OR fecha_expiracion > fecha_asignacion
  )
);

-- Índices especializados para queries de autorización (patrón más frecuente)
CREATE INDEX idx_usuarios_roles_usuario ON usuarios_roles(usuario_id);
CREATE INDEX idx_usuarios_roles_rol ON usuarios_roles(rol_id);
CREATE INDEX idx_usuarios_roles_departamento ON usuarios_roles(departamento_id) WHERE departamento_id IS NOT NULL;

-- Índice crítico para autorización (80% de queries RBAC)
CREATE INDEX idx_usuarios_roles_auth ON usuarios_roles(usuario_id, activo, fecha_expiracion) 
  WHERE activo = true AND (fecha_expiracion IS NULL OR fecha_expiracion > NOW());

-- Índice para búsqueda de roles activos por usuario con datos incluidos
CREATE INDEX idx_usuarios_roles_usuario_activo ON usuarios_roles(usuario_id, activo) 
  INCLUDE (rol_id, departamento_id, fecha_asignacion)
  WHERE activo = true;

COMMENT ON TABLE usuarios_roles IS 'Asignación de roles con scope departamental y expiración';
COMMENT ON COLUMN usuarios_roles.departamento_id IS 'NULL = rol global, valor = rol limitado a departamento';
COMMENT ON COLUMN usuarios_roles.fecha_expiracion IS 'NULL = permanente, valor = rol temporal';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at 
  BEFORE UPDATE ON roles 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_usuarios_roles_updated_at 
  BEFORE UPDATE ON usuarios_roles 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- =====================================================
-- FUNCTION: verificar_permiso_usuario
-- Verifica si un usuario tiene un permiso específico
-- =====================================================
CREATE OR REPLACE FUNCTION verificar_permiso_usuario(
  p_usuario_id BIGINT,
  p_codigo_permiso VARCHAR,
  p_departamento_id BIGINT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  tiene_permiso BOOLEAN;
BEGIN
  -- Query optimizada usando los índices creados
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_roles ur
    INNER JOIN roles_permisos rp ON rp.rol_id = ur.rol_id
    INNER JOIN permisos p ON p.id = rp.permiso_id
    WHERE ur.usuario_id = p_usuario_id
      AND ur.activo = true
      AND p.codigo = p_codigo_permiso
      AND p.activo = true
      AND (ur.fecha_expiracion IS NULL OR ur.fecha_expiracion > NOW())
      AND (
        p_departamento_id IS NULL 
        OR ur.departamento_id IS NULL 
        OR ur.departamento_id = p_departamento_id
      )
  ) INTO tiene_permiso;
  
  RETURN COALESCE(tiene_permiso, false);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION verificar_permiso_usuario IS 'Verifica si usuario tiene permiso con scope departamental';

-- =====================================================
-- FUNCTION: obtener_permisos_usuario
-- Retorna todos los permisos de un usuario
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_permisos_usuario(p_usuario_id BIGINT)
RETURNS TABLE (
  codigo VARCHAR,
  modulo VARCHAR,
  accion VARCHAR,
  descripcion TEXT,
  departamento_id BIGINT,
  rol_codigo VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.codigo,
    p.modulo,
    p.accion,
    p.descripcion,
    ur.departamento_id,
    r.codigo as rol_codigo
  FROM usuarios_roles ur
  INNER JOIN roles r ON r.id = ur.rol_id AND r.activo = true
  INNER JOIN roles_permisos rp ON rp.rol_id = ur.rol_id
  INNER JOIN permisos p ON p.id = rp.permiso_id AND p.activo = true
  WHERE ur.usuario_id = p_usuario_id
    AND ur.activo = true
    AND (ur.fecha_expiracion IS NULL OR ur.fecha_expiracion > NOW())
  ORDER BY p.modulo, p.accion;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_permisos_usuario IS 'Lista todos los permisos activos de un usuario';

-- =====================================================
-- VALIDACIÓN
-- =====================================================
SELECT 
  'TABLA: roles' as tabla, 
  COUNT(*) as total_registros 
FROM roles
UNION ALL
SELECT 
  'TABLA: permisos', 
  COUNT(*) 
FROM permisos
UNION ALL
SELECT 
  'TABLA: roles_permisos', 
  COUNT(*) 
FROM roles_permisos
UNION ALL
SELECT 
  'TABLA: usuarios_roles', 
  COUNT(*) 
FROM usuarios_roles;

-- =====================================================
-- END OF FILE
-- =====================================================
