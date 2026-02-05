-- =====================================================
-- 03_config_ausencias.sql
-- Configuración de Tipos de Ausencia y Balances
-- PostgreSQL - Ejecutar TERCERO
-- =====================================================
-- Autor: Senior Database Architect
-- Fecha: 5 febrero 2026
-- Versión: 3.0
-- =====================================================

-- =====================================================
-- TABLA: tipos_ausencia_config
-- Configuración dinámica de tipos de ausencia
-- =====================================================
CREATE TABLE IF NOT EXISTS tipos_ausencia_config (
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Check Constraints
  CONSTRAINT chk_tipo_ausencia_dias_maximos CHECK (
    dias_maximos_por_solicitud IS NULL OR dias_maximos_por_solicitud > 0
  ),
  CONSTRAINT chk_tipo_ausencia_anticipacion CHECK (
    dias_anticipacion_minima >= 0 AND dias_anticipacion_minima <= 365
  ),
  CONSTRAINT chk_tipo_ausencia_color_hex CHECK (
    color_hex ~* '^#[0-9A-F]{6}$'
  )
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_tipos_ausencia_tipo ON tipos_ausencia_config(tipo) WHERE activo = true AND deleted_at IS NULL;
CREATE INDEX idx_tipos_ausencia_activo ON tipos_ausencia_config(activo) WHERE deleted_at IS NULL;

COMMENT ON TABLE tipos_ausencia_config IS 'Configuración dinámica de tipos de ausencia (vacaciones, permisos, etc)';
COMMENT ON COLUMN tipos_ausencia_config.tipo IS 'ENUM tipo_ausencia definido en 01_tipos_enums.sql';
COMMENT ON COLUMN tipos_ausencia_config.dias_anticipacion_minima IS 'Días de antelación mínima para solicitar';
COMMENT ON COLUMN tipos_ausencia_config.color_hex IS 'Color hex para visualización en calendarios';

-- =====================================================
-- TABLA: balances_ausencias
-- Balances anuales por usuario y tipo de ausencia
-- =====================================================
CREATE TABLE IF NOT EXISTS balances_ausencias (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tipo_ausencia_id BIGINT NOT NULL REFERENCES tipos_ausencia_config(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  anio INTEGER NOT NULL,
  cantidad_asignada DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_utilizada DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad_pendiente DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado estado_balance NOT NULL DEFAULT 'activo',
  fecha_vencimiento DATE,
  notas TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraint único por usuario, tipo y año
  CONSTRAINT uq_balance_usuario_tipo_anio UNIQUE (usuario_id, tipo_ausencia_id, anio),
  
  -- Check Constraints críticos
  CONSTRAINT chk_balance_cantidades_no_negativas CHECK (
    cantidad_asignada >= 0 AND 
    cantidad_utilizada >= 0 AND 
    cantidad_pendiente >= 0
  ),
  CONSTRAINT chk_balance_utilizada_no_excede CHECK (
    cantidad_utilizada <= cantidad_asignada
  ),
  CONSTRAINT chk_balance_suma_no_excede CHECK (
    (cantidad_utilizada + cantidad_pendiente) <= cantidad_asignada
  ),
  CONSTRAINT chk_balance_anio_valido CHECK (
    anio >= 2020 AND anio <= 2100
  ),
  CONSTRAINT chk_balance_fecha_vencimiento CHECK (
    fecha_vencimiento IS NULL OR EXTRACT(YEAR FROM fecha_vencimiento) >= anio
  )
);

-- =====================================================
-- GENERATED COLUMN: cantidad_disponible
-- Cálculo automático del balance disponible (CRITICAL)
-- =====================================================
ALTER TABLE balances_ausencias 
  ADD COLUMN IF NOT EXISTS cantidad_disponible DECIMAL(10,2) 
  GENERATED ALWAYS AS (
    cantidad_asignada - cantidad_utilizada - cantidad_pendiente
  ) STORED;

COMMENT ON COLUMN balances_ausencias.cantidad_disponible IS 'Generated column: asignada - utilizada - pendiente';

-- Índices especializados por patrón de query
-- Patrón 1: Usuario consulta su balance del año actual
CREATE INDEX idx_balances_usuario_anio ON balances_ausencias(usuario_id, anio, estado) 
  WHERE deleted_at IS NULL;

-- Patrón 2: Búsqueda de balances activos con disponibilidad
CREATE INDEX idx_balances_activos_disponibles ON balances_ausencias(usuario_id, anio, estado, cantidad_disponible)
  WHERE estado = 'activo' AND deleted_at IS NULL;

-- Patrón 3: Reportes por año y tipo
CREATE INDEX idx_balances_anio_tipo ON balances_ausencias(anio, tipo_ausencia_id, estado)
  INCLUDE (cantidad_asignada, cantidad_utilizada, cantidad_pendiente)
  WHERE deleted_at IS NULL;

-- Índice para optimistic locking
CREATE INDEX idx_balances_version ON balances_ausencias(id, version);

COMMENT ON TABLE balances_ausencias IS 'Balances anuales con generated column para disponible';
COMMENT ON COLUMN balances_ausencias.version IS 'Optimistic locking - incrementa en cada UPDATE';
COMMENT ON COLUMN balances_ausencias.cantidad_asignada IS 'Días/horas asignados al inicio del año';
COMMENT ON COLUMN balances_ausencias.cantidad_utilizada IS 'Días/horas ya consumidos (solicitudes aprobadas)';
COMMENT ON COLUMN balances_ausencias.cantidad_pendiente IS 'Días/horas en solicitudes pendientes';

-- =====================================================
-- TABLA: historial_balances (Particionada)
-- Auditoría de cambios en balances
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_balances (
  id BIGSERIAL,
  balance_id BIGINT NOT NULL REFERENCES balances_ausencias(id) ON DELETE CASCADE ON UPDATE CASCADE,
  solicitud_id BIGINT,
  tipo_movimiento VARCHAR(50) NOT NULL,
  cantidad_anterior DECIMAL(10,2) NOT NULL,
  cantidad_nueva DECIMAL(10,2) NOT NULL,
  diferencia DECIMAL(10,2) NOT NULL,
  motivo TEXT,
  realizado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  PRIMARY KEY (id, created_at),
  
  -- Check Constraints
  CONSTRAINT chk_historial_diferencia_correcta CHECK (
    diferencia = (cantidad_nueva - cantidad_anterior)
  ),
  CONSTRAINT chk_historial_tipo_movimiento CHECK (
    tipo_movimiento IN (
      'asignacion_inicial',
      'ajuste_manual',
      'consumo_solicitud',
      'reversion_solicitud',
      'solicitud_pendiente',
      'liberacion_solicitud',
      'expiracion',
      'renovacion'
    )
  )
) PARTITION BY RANGE (created_at);

-- Crear particiones para 2025, 2026, 2027
CREATE TABLE IF NOT EXISTS historial_balances_2025 PARTITION OF historial_balances 
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS historial_balances_2026 PARTITION OF historial_balances 
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS historial_balances_2027 PARTITION OF historial_balances 
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- Índices en tabla particionada
CREATE INDEX idx_historial_balance ON historial_balances(balance_id, created_at DESC);
CREATE INDEX idx_historial_solicitud ON historial_balances(solicitud_id) WHERE solicitud_id IS NOT NULL;
CREATE INDEX idx_historial_tipo ON historial_balances(tipo_movimiento, created_at DESC);
CREATE INDEX idx_historial_usuario ON historial_balances(realizado_por, created_at DESC) WHERE realizado_por IS NOT NULL;

COMMENT ON TABLE historial_balances IS 'Auditoría de cambios en balances (particionada por año)';
COMMENT ON COLUMN historial_balances.tipo_movimiento IS 'Tipo de operación que modificó el balance';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Actualizar updated_at
CREATE TRIGGER trg_tipos_ausencia_updated_at 
  BEFORE UPDATE ON tipos_ausencia_config 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_balances_updated_at 
  BEFORE UPDATE ON balances_ausencias 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Incrementar version para optimistic locking
CREATE TRIGGER trg_balances_version 
  BEFORE UPDATE ON balances_ausencias 
  FOR EACH ROW EXECUTE FUNCTION incrementar_version();

-- Registrar cambios en historial automáticamente
CREATE OR REPLACE FUNCTION registrar_cambio_balance()
RETURNS TRIGGER AS $$
DECLARE
  tipo_movimiento_inferido VARCHAR(50);
BEGIN
  -- Inferir tipo de movimiento según el cambio
  IF TG_OP = 'INSERT' THEN
    tipo_movimiento_inferido := 'asignacion_inicial';
  ELSIF OLD.cantidad_utilizada != NEW.cantidad_utilizada THEN
    tipo_movimiento_inferido := CASE 
      WHEN NEW.cantidad_utilizada > OLD.cantidad_utilizada THEN 'consumo_solicitud'
      ELSE 'reversion_solicitud'
    END;
  ELSIF OLD.cantidad_pendiente != NEW.cantidad_pendiente THEN
    tipo_movimiento_inferido := CASE 
      WHEN NEW.cantidad_pendiente > OLD.cantidad_pendiente THEN 'solicitud_pendiente'
      ELSE 'liberacion_solicitud'
    END;
  ELSIF OLD.cantidad_asignada != NEW.cantidad_asignada THEN
    tipo_movimiento_inferido := 'ajuste_manual';
  ELSE
    tipo_movimiento_inferido := 'actualizacion';
  END IF;
  
  -- Registrar cambio en cantidad_utilizada
  IF TG_OP = 'INSERT' OR OLD.cantidad_utilizada != NEW.cantidad_utilizada THEN
    INSERT INTO historial_balances (
      balance_id,
      tipo_movimiento,
      cantidad_anterior,
      cantidad_nueva,
      diferencia,
      motivo
    ) VALUES (
      NEW.id,
      tipo_movimiento_inferido,
      COALESCE(OLD.cantidad_utilizada, 0),
      NEW.cantidad_utilizada,
      NEW.cantidad_utilizada - COALESCE(OLD.cantidad_utilizada, 0),
      'Cambio automático en cantidad_utilizada'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_balance_registrar_cambio 
  AFTER INSERT OR UPDATE ON balances_ausencias 
  FOR EACH ROW EXECUTE FUNCTION registrar_cambio_balance();

-- =====================================================
-- FUNCTION: obtener_balance_disponible
-- Retorna el balance disponible de un usuario para un tipo
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_balance_disponible(
  p_usuario_id BIGINT,
  p_tipo_ausencia_id BIGINT,
  p_anio INTEGER DEFAULT NULL
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  balance_disponible DECIMAL(10,2);
  anio_busqueda INTEGER;
BEGIN
  anio_busqueda := COALESCE(p_anio, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  
  SELECT cantidad_disponible INTO balance_disponible
  FROM balances_ausencias
  WHERE usuario_id = p_usuario_id
    AND tipo_ausencia_id = p_tipo_ausencia_id
    AND anio = anio_busqueda
    AND estado = 'activo'
    AND deleted_at IS NULL;
  
  RETURN COALESCE(balance_disponible, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_balance_disponible IS 'Retorna balance disponible usando generated column';

-- =====================================================
-- FUNCTION: crear_particion_historial
-- Crea partición para nuevo año automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION crear_particion_historial_balances(p_anio INTEGER)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS historial_balances_%s PARTITION OF historial_balances 
     FOR VALUES FROM (%L) TO (%L)',
    p_anio,
    p_anio || '-01-01',
    (p_anio + 1) || '-01-01'
  );
  
  RAISE NOTICE 'Partición historial_balances_% creada', p_anio;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crear_particion_historial_balances IS 'Crea partición para año específico';

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de balances con disponibilidad calculada
CREATE OR REPLACE VIEW v_balances_detalle AS
SELECT 
  b.id,
  b.usuario_id,
  u.nombre_completo as usuario_nombre,
  u.email as usuario_email,
  d.nombre as departamento_nombre,
  b.tipo_ausencia_id,
  t.nombre as tipo_ausencia_nombre,
  t.tipo as tipo_ausencia_codigo,
  b.anio,
  b.cantidad_asignada,
  b.cantidad_utilizada,
  b.cantidad_pendiente,
  b.cantidad_disponible,
  ROUND((b.cantidad_utilizada / NULLIF(b.cantidad_asignada, 0) * 100), 2) as porcentaje_utilizado,
  b.estado,
  b.fecha_vencimiento,
  b.version,
  b.updated_at
FROM balances_ausencias b
INNER JOIN usuarios u ON u.id = b.usuario_id
INNER JOIN departamentos d ON d.id = u.departamento_id
INNER JOIN tipos_ausencia_config t ON t.id = b.tipo_ausencia_id
WHERE b.deleted_at IS NULL
  AND u.deleted_at IS NULL
  AND u.activo = true;

COMMENT ON VIEW v_balances_detalle IS 'Vista completa de balances con datos relacionados y porcentajes';

-- =====================================================
-- VALIDACIÓN
-- =====================================================
SELECT 
  'TABLA: tipos_ausencia_config' as tabla, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE activo = true) as activos
FROM tipos_ausencia_config
UNION ALL
SELECT 
  'TABLA: balances_ausencias', 
  COUNT(*),
  COUNT(*) FILTER (WHERE estado = 'activo')
FROM balances_ausencias
UNION ALL
SELECT 
  'TABLA: historial_balances', 
  COUNT(*),
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
FROM historial_balances;

-- =====================================================
-- END OF FILE
-- =====================================================
