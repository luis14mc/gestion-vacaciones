-- =====================================================
-- 02_estructura_org.sql
-- Estructura Organizacional (Departamentos y Usuarios)
-- PostgreSQL - Ejecutar SEGUNDO
-- =====================================================
-- Autor: Senior Database Architect
-- Fecha: 5 febrero 2026
-- Versión: 3.0
-- =====================================================

-- =====================================================
-- TABLA: departamentos
-- Estructura jerárquica de la organización
-- =====================================================
CREATE TABLE IF NOT EXISTS departamentos (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  descripcion TEXT,
  departamento_padre_id BIGINT REFERENCES departamentos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Check Constraints
  CONSTRAINT chk_departamento_no_auto_referencia CHECK (id != departamento_padre_id),
  CONSTRAINT chk_departamento_codigo_mayusculas CHECK (codigo = UPPER(codigo)),
  CONSTRAINT uq_departamento_nombre UNIQUE NULLS NOT DISTINCT (nombre, deleted_at)
);

-- Índices para búsquedas jerárquicas y filtrados
CREATE INDEX idx_departamentos_codigo ON departamentos(codigo) WHERE deleted_at IS NULL;
CREATE INDEX idx_departamentos_padre ON departamentos(departamento_padre_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_departamentos_activo ON departamentos(activo) WHERE deleted_at IS NULL;
CREATE INDEX idx_departamentos_nombre ON departamentos USING GIN(to_tsvector('spanish', nombre));

COMMENT ON TABLE departamentos IS 'Estructura jerárquica organizacional con soft delete';
COMMENT ON COLUMN departamentos.departamento_padre_id IS 'NULL = departamento raíz';
COMMENT ON COLUMN departamentos.deleted_at IS 'Soft delete timestamp';

-- =====================================================
-- TABLA: usuarios
-- Datos core de usuarios del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  departamento_id BIGINT NOT NULL REFERENCES departamentos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  cargo VARCHAR(100),
  
  -- DEPRECADO - Mantener para compatibilidad temporal (eliminar en v4.0)
  es_jefe BOOLEAN NOT NULL DEFAULT false,
  es_rrhh BOOLEAN NOT NULL DEFAULT false,
  es_admin BOOLEAN NOT NULL DEFAULT false,
  
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_ingreso DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint con soft delete
  CONSTRAINT uq_usuario_email UNIQUE NULLS NOT DISTINCT (email, deleted_at),
  
  -- Check Constraints
  CONSTRAINT chk_usuario_email_valido CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  CONSTRAINT chk_usuario_password_minimo CHECK (LENGTH(password_hash) >= 50),
  CONSTRAINT chk_usuario_fecha_ingreso_valida CHECK (
    fecha_ingreso IS NULL OR fecha_ingreso <= CURRENT_DATE
  ),
  CONSTRAINT chk_usuario_version_positiva CHECK (version >= 1)
);

-- Índices para queries frecuentes
CREATE INDEX idx_usuarios_email ON usuarios(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_usuarios_departamento ON usuarios(departamento_id) WHERE deleted_at IS NULL AND activo = true;
CREATE INDEX idx_usuarios_activo ON usuarios(activo) WHERE deleted_at IS NULL;

-- Índice compuesto para listados filtrados (patrón muy común)
CREATE INDEX idx_usuarios_depto_activo_apellido ON usuarios(departamento_id, activo, apellido, nombre) 
  WHERE deleted_at IS NULL;

-- Índice para búsquedas de autenticación
CREATE INDEX idx_usuarios_email_login ON usuarios(email, password_hash, activo) 
  WHERE deleted_at IS NULL;

-- Índice para optimistic locking
CREATE INDEX idx_usuarios_version ON usuarios(id, version) WHERE deleted_at IS NULL;

COMMENT ON TABLE usuarios IS 'Usuarios del sistema con soft delete y optimistic locking';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt de la contraseña (nunca almacenar plain text)';
COMMENT ON COLUMN usuarios.version IS 'Control de concurrencia optimista (incrementa en cada UPDATE)';
COMMENT ON COLUMN usuarios.es_jefe IS 'DEPRECADO - Usar tabla usuarios_roles';
COMMENT ON COLUMN usuarios.es_rrhh IS 'DEPRECADO - Usar tabla usuarios_roles';
COMMENT ON COLUMN usuarios.es_admin IS 'DEPRECADO - Usar tabla usuarios_roles';

-- =====================================================
-- GENERATED COLUMNS (PostgreSQL 12+)
-- Agregadas como columnas calculadas para performance
-- =====================================================

-- Nombre completo para búsquedas y listados
ALTER TABLE usuarios 
  ADD COLUMN IF NOT EXISTS nombre_completo VARCHAR(202) 
  GENERATED ALWAYS AS (nombre || ' ' || apellido) STORED;

-- Índice GIN para full-text search en español
CREATE INDEX idx_usuarios_nombre_completo_fts 
  ON usuarios USING GIN(to_tsvector('spanish', nombre_completo))
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN usuarios.nombre_completo IS 'Generated column para búsquedas full-text';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Actualizar updated_at automáticamente
CREATE TRIGGER trg_departamentos_updated_at 
  BEFORE UPDATE ON departamentos 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_usuarios_updated_at 
  BEFORE UPDATE ON usuarios 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Incrementar version para optimistic locking
CREATE OR REPLACE FUNCTION incrementar_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_version 
  BEFORE UPDATE ON usuarios 
  FOR EACH ROW EXECUTE FUNCTION incrementar_version();

-- =====================================================
-- FUNCTION: obtener_jerarquia_departamento
-- Retorna la jerarquía completa de un departamento
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_jerarquia_departamento(p_departamento_id BIGINT)
RETURNS TABLE (
  id BIGINT,
  nombre VARCHAR,
  codigo VARCHAR,
  nivel INTEGER,
  path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE jerarquia AS (
    -- Caso base: departamento seleccionado
    SELECT 
      d.id,
      d.nombre,
      d.codigo,
      0 as nivel,
      '/' || d.codigo || '/' as path
    FROM departamentos d
    WHERE d.id = p_departamento_id
      AND d.deleted_at IS NULL
    
    UNION ALL
    
    -- Caso recursivo: sub-departamentos
    SELECT 
      d.id,
      d.nombre,
      d.codigo,
      j.nivel + 1,
      j.path || d.codigo || '/' as path
    FROM departamentos d
    INNER JOIN jerarquia j ON d.departamento_padre_id = j.id
    WHERE d.deleted_at IS NULL
  )
  SELECT * FROM jerarquia ORDER BY path;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_jerarquia_departamento IS 'Retorna árbol completo de departamentos hijos';

-- =====================================================
-- FUNCTION: obtener_path_departamento
-- Retorna el path completo desde raíz hasta departamento
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_path_departamento(p_departamento_id BIGINT)
RETURNS TEXT AS $$
DECLARE
  departamento_path TEXT;
BEGIN
  WITH RECURSIVE path_recursivo AS (
    -- Caso base
    SELECT 
      id,
      departamento_padre_id,
      codigo,
      '/' || codigo as path
    FROM departamentos
    WHERE id = p_departamento_id
    
    UNION ALL
    
    -- Caso recursivo: hacia arriba
    SELECT 
      d.id,
      d.departamento_padre_id,
      d.codigo,
      '/' || d.codigo || pr.path as path
    FROM departamentos d
    INNER JOIN path_recursivo pr ON d.id = pr.departamento_padre_id
  )
  SELECT path || '/' INTO departamento_path
  FROM path_recursivo
  WHERE departamento_padre_id IS NULL;
  
  RETURN departamento_path;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_path_departamento IS 'Retorna path tipo /ROOT/DEPTO/SUBDEPTO/';

-- =====================================================
-- FUNCTION: buscar_usuarios_fulltext
-- Búsqueda full-text optimizada de usuarios
-- =====================================================
CREATE OR REPLACE FUNCTION buscar_usuarios_fulltext(p_query TEXT)
RETURNS TABLE (
  id BIGINT,
  email VARCHAR,
  nombre_completo VARCHAR,
  cargo VARCHAR,
  departamento_nombre VARCHAR,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.nombre_completo,
    u.cargo,
    d.nombre as departamento_nombre,
    ts_rank(to_tsvector('spanish', u.nombre_completo || ' ' || COALESCE(u.email, '')), plainto_tsquery('spanish', p_query)) as rank
  FROM usuarios u
  INNER JOIN departamentos d ON d.id = u.departamento_id
  WHERE u.deleted_at IS NULL
    AND u.activo = true
    AND to_tsvector('spanish', u.nombre_completo || ' ' || COALESCE(u.email, '')) @@ plainto_tsquery('spanish', p_query)
  ORDER BY rank DESC, u.apellido, u.nombre
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION buscar_usuarios_fulltext IS 'Búsqueda full-text con ranking en nombre y email';

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de usuarios activos con departamento
CREATE OR REPLACE VIEW v_usuarios_activos AS
SELECT 
  u.id,
  u.email,
  u.nombre,
  u.apellido,
  u.nombre_completo,
  u.cargo,
  u.departamento_id,
  d.nombre as departamento_nombre,
  d.codigo as departamento_codigo,
  u.activo,
  u.fecha_ingreso,
  u.ultimo_acceso,
  u.created_at
FROM usuarios u
INNER JOIN departamentos d ON d.id = u.departamento_id
WHERE u.deleted_at IS NULL
  AND u.activo = true
  AND d.deleted_at IS NULL
  AND d.activo = true;

COMMENT ON VIEW v_usuarios_activos IS 'Vista optimizada de usuarios activos con datos de departamento';

-- =====================================================
-- VALIDACIÓN
-- =====================================================
SELECT 
  'TABLA: departamentos' as tabla, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE activo = true) as activos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminados
FROM departamentos
UNION ALL
SELECT 
  'TABLA: usuarios', 
  COUNT(*),
  COUNT(*) FILTER (WHERE activo = true),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM usuarios;

-- =====================================================
-- END OF FILE
-- =====================================================
