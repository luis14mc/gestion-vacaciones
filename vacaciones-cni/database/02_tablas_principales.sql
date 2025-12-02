-- =====================================================
-- 02_tablas_principales.sql
-- PostgreSQL Local - Ejecutar SEGUNDO
-- =====================================================

CREATE TABLE departamentos (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  descripcion TEXT,
  departamento_padre_id BIGINT REFERENCES departamentos(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_departamentos_codigo ON departamentos(codigo);
CREATE INDEX idx_departamentos_padre ON departamentos(departamento_padre_id);

CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  departamento_id BIGINT NOT NULL REFERENCES departamentos(id) ON DELETE RESTRICT,
  cargo VARCHAR(100),
  es_jefe BOOLEAN NOT NULL DEFAULT false,
  es_rrhh BOOLEAN NOT NULL DEFAULT false,
  es_admin BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_ingreso DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_departamento ON usuarios(departamento_id);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

CREATE TABLE tipos_ausencia_config (
  id BIGSERIAL PRIMARY KEY,
  tipo tipo_ausencia NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  requiere_aprobacion_jefe BOOLEAN NOT NULL DEFAULT true,
  requiere_aprobacion_rrhh BOOLEAN NOT NULL DEFAULT true,
  dias_maximos_por_solicitud INTEGER,
  dias_anticipacion_minima INTEGER DEFAULT 0,
  permite_medio_dia BOOLEAN NOT NULL DEFAULT false,
  permite_horas BOOLEAN NOT NULL DEFAULT false,
  requiere_documento BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  color_hex VARCHAR(7) DEFAULT '#3B82F6',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tipos_ausencia_tipo ON tipos_ausencia_config(tipo);

CREATE TABLE configuracion_sistema (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(100) NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  tipo_dato VARCHAR(20) NOT NULL DEFAULT 'string',
  descripcion TEXT,
  categoria VARCHAR(50),
  es_publico BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_clave ON configuracion_sistema(clave);

CREATE TABLE auditoria_cambios (
  id BIGSERIAL,
  tabla VARCHAR(100) NOT NULL,
  registro_id BIGINT NOT NULL,
  accion VARCHAR(20) NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE auditoria_cambios_2025 PARTITION OF auditoria_cambios FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE auditoria_cambios_2026 PARTITION OF auditoria_cambios FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_auditoria_tabla ON auditoria_cambios(tabla);
CREATE INDEX idx_auditoria_created ON auditoria_cambios(created_at DESC);

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_departamentos_updated_at BEFORE UPDATE ON departamentos FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_tipos_ausencia_updated_at BEFORE UPDATE ON tipos_ausencia_config FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON configuracion_sistema FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
