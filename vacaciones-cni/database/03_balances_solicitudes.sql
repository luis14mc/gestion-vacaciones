-- =====================================================
-- 03_balances_solicitudes.sql
-- PostgreSQL Local - Ejecutar TERCERO
-- =====================================================

CREATE TABLE balances_ausencias (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_ausencia_id BIGINT NOT NULL REFERENCES tipos_ausencia_config(id) ON DELETE RESTRICT,
  anio INTEGER NOT NULL,
  cantidad_asignada DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_utilizada DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_pendiente DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_disponible DECIMAL(10,2) GENERATED ALWAYS AS (cantidad_asignada - cantidad_utilizada - cantidad_pendiente) STORED,
  estado estado_balance NOT NULL DEFAULT 'activo',
  fecha_vencimiento DATE,
  notas TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_balance_usuario_tipo_anio UNIQUE (usuario_id, tipo_ausencia_id, anio),
  CONSTRAINT chk_balance_positivo CHECK (cantidad_asignada >= 0),
  CONSTRAINT chk_anio_valido CHECK (anio >= 2020 AND anio <= 2100)
);

CREATE INDEX idx_balances_usuario ON balances_ausencias(usuario_id);
CREATE INDEX idx_balances_anio ON balances_ausencias(anio);

CREATE TABLE solicitudes (
  id BIGSERIAL,
  codigo VARCHAR(50),
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_ausencia_id BIGINT NOT NULL REFERENCES tipos_ausencia_config(id) ON DELETE RESTRICT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  cantidad DECIMAL(10,2) NOT NULL,
  unidad unidad_tiempo NOT NULL DEFAULT 'dias',
  estado estado_solicitud NOT NULL DEFAULT 'borrador',
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion_jefe TIMESTAMP WITH TIME ZONE,
  fecha_aprobacion_rrhh TIMESTAMP WITH TIME ZONE,
  fecha_rechazo TIMESTAMP WITH TIME ZONE,
  aprobado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_rrhh_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  rechazado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo TEXT,
  motivo_rechazo TEXT,
  observaciones TEXT,
  documentos_adjuntos JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id, created_at),
  CONSTRAINT chk_fechas_validas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT chk_cantidad_positiva CHECK (cantidad > 0)
) PARTITION BY RANGE (created_at);

CREATE TABLE solicitudes_2025 PARTITION OF solicitudes FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE solicitudes_2026 PARTITION OF solicitudes FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE UNIQUE INDEX idx_solicitudes_codigo ON solicitudes(codigo, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_solicitudes_usuario ON solicitudes(usuario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_solicitudes_created ON solicitudes(created_at DESC);
CREATE INDEX idx_solicitudes_codigo_lookup ON solicitudes(codigo) WHERE deleted_at IS NULL;

CREATE TABLE historial_balances (
  id BIGSERIAL,
  balance_id BIGINT NOT NULL REFERENCES balances_ausencias(id) ON DELETE CASCADE,
  solicitud_id BIGINT,
  tipo_movimiento VARCHAR(50) NOT NULL,
  cantidad_anterior DECIMAL(10,2) NOT NULL,
  cantidad_nueva DECIMAL(10,2) NOT NULL,
  diferencia DECIMAL(10,2) NOT NULL,
  motivo TEXT,
  realizado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE historial_balances_2025 PARTITION OF historial_balances FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE historial_balances_2026 PARTITION OF historial_balances FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_historial_balance ON historial_balances(balance_id);
CREATE INDEX idx_historial_created ON historial_balances(created_at DESC);

CREATE TRIGGER trg_balances_updated_at BEFORE UPDATE ON balances_ausencias FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_solicitudes_updated_at BEFORE UPDATE ON solicitudes FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE OR REPLACE FUNCTION generar_codigo_solicitud() RETURNS TRIGGER AS $$
DECLARE
  contador INTEGER;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN RETURN NEW; END IF;
  SELECT COUNT(*) + 1 INTO contador FROM solicitudes WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP);
  NEW.codigo := 'SOL-' || EXTRACT(YEAR FROM CURRENT_TIMESTAMP) || '-' || LPAD(contador::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitud_generar_codigo BEFORE INSERT ON solicitudes FOR EACH ROW EXECUTE FUNCTION generar_codigo_solicitud();

SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%balance%' OR tablename LIKE 'solicitudes%') ORDER BY tablename;
