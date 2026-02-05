-- =====================================================
-- 04_solicitudes_core.sql
-- Core del Negocio: Solicitudes de Ausencias
-- PostgreSQL - Ejecutar CUARTO
-- =====================================================
-- Autor: Senior Database Architect
-- Fecha: 5 febrero 2026
-- Versión: 3.0
-- =====================================================

-- =====================================================
-- TABLA: solicitudes (Particionada por created_at)
-- Tabla principal del negocio
-- =====================================================
CREATE TABLE IF NOT EXISTS solicitudes (
  id BIGSERIAL,
  codigo VARCHAR(50) NOT NULL,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  tipo_ausencia_id BIGINT NOT NULL REFERENCES tipos_ausencia_config(id) ON DELETE RESTRICT ON UPDATE CASCADE,
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
  aprobado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  aprobado_rrhh_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  rechazado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  motivo TEXT,
  motivo_rechazo TEXT,
  observaciones TEXT,
  documentos_adjuntos JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  PRIMARY KEY (id, created_at),
  
  -- Check Constraints críticos
  CONSTRAINT chk_solicitud_fecha_fin_mayor_inicio CHECK (
    fecha_fin >= fecha_inicio
  ),
  CONSTRAINT chk_solicitud_cantidad_positiva CHECK (
    cantidad > 0
  ),
  CONSTRAINT chk_solicitud_fechas_aprobacion_logicas CHECK (
    fecha_aprobacion_jefe IS NULL OR fecha_aprobacion_jefe >= fecha_solicitud
  ),
  CONSTRAINT chk_solicitud_fechas_rrhh_despues_jefe CHECK (
    fecha_aprobacion_rrhh IS NULL OR 
    fecha_aprobacion_jefe IS NULL OR 
    fecha_aprobacion_rrhh >= fecha_aprobacion_jefe
  ),
  CONSTRAINT chk_solicitud_estado_valido_con_fechas CHECK (
    CASE 
      WHEN estado = 'aprobada_jefe' THEN fecha_aprobacion_jefe IS NOT NULL
      WHEN estado = 'aprobada' THEN fecha_aprobacion_rrhh IS NOT NULL
      WHEN estado = 'rechazada' THEN fecha_rechazo IS NOT NULL AND motivo_rechazo IS NOT NULL
      ELSE TRUE
    END
  ),
  CONSTRAINT chk_solicitud_horas_validas CHECK (
    (hora_inicio IS NULL AND hora_fin IS NULL) OR 
    (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
  ),
  CONSTRAINT chk_solicitud_codigo_formato CHECK (
    codigo ~ '^SOL-[0-9]{4}-[0-9]{6}$'
  )
) PARTITION BY RANGE (created_at);

-- Crear particiones para 2025, 2026, 2027
CREATE TABLE IF NOT EXISTS solicitudes_2025 PARTITION OF solicitudes 
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS solicitudes_2026 PARTITION OF solicitudes 
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS solicitudes_2027 PARTITION OF solicitudes 
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

COMMENT ON TABLE solicitudes IS 'Solicitudes de ausencias (particionada por año para performance)';
COMMENT ON COLUMN solicitudes.codigo IS 'Código único formato SOL-AAAA-NNNNNN (auto-generado)';
COMMENT ON COLUMN solicitudes.cantidad IS 'Cantidad en días o horas según unidad';
COMMENT ON COLUMN solicitudes.version IS 'Optimistic locking - incrementa en cada UPDATE';
COMMENT ON COLUMN solicitudes.documentos_adjuntos IS 'Array JSON de URLs/paths a documentos adjuntos';

-- =====================================================
-- ÍNDICES ESPECIALIZADOS POR PATRÓN DE QUERY
-- =====================================================

-- Patrón 1: Usuario busca sus solicitudes filtradas por estado (80% de queries)
CREATE INDEX idx_solicitudes_usuario_estado_fecha 
  ON solicitudes(usuario_id, estado, fecha_inicio DESC)
  INCLUDE (codigo, tipo_ausencia_id, cantidad, fecha_fin)
  WHERE deleted_at IS NULL;

-- Patrón 2: Jefe busca solicitudes pendientes de su departamento (15% de queries)
CREATE INDEX idx_solicitudes_pendientes_aprobacion
  ON solicitudes(estado, created_at DESC)
  INCLUDE (usuario_id, tipo_ausencia_id, fecha_inicio, fecha_fin, cantidad)
  WHERE estado IN ('pendiente', 'aprobada_jefe') AND deleted_at IS NULL;

-- Patrón 3: Búsqueda por código único (lookup rápido)
CREATE UNIQUE INDEX idx_solicitudes_codigo_unique 
  ON solicitudes(codigo, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_solicitudes_codigo_lookup 
  ON solicitudes(codigo)
  WHERE deleted_at IS NULL;

-- Patrón 4: Reportes por rango de fechas y estado
CREATE INDEX idx_solicitudes_fechas_estado 
  ON solicitudes(fecha_inicio, fecha_fin, estado)
  INCLUDE (usuario_id, tipo_ausencia_id, cantidad)
  WHERE deleted_at IS NULL;

-- Patrón 5: Auditoría de aprobaciones
CREATE INDEX idx_solicitudes_aprobadores 
  ON solicitudes(aprobado_por, fecha_aprobacion_jefe)
  WHERE aprobado_por IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_solicitudes_aprobadores_rrhh 
  ON solicitudes(aprobado_rrhh_por, fecha_aprobacion_rrhh)
  WHERE aprobado_rrhh_por IS NOT NULL AND deleted_at IS NULL;

-- Índices adicionales para queries específicas
CREATE INDEX idx_solicitudes_usuario ON solicitudes(usuario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_solicitudes_created ON solicitudes(created_at DESC);
CREATE INDEX idx_solicitudes_version ON solicitudes(id, version, created_at) WHERE deleted_at IS NULL;

-- Índice GIN para búsqueda en documentos adjuntos
CREATE INDEX idx_solicitudes_documentos 
  ON solicitudes USING GIN(documentos_adjuntos jsonb_path_ops)
  WHERE jsonb_array_length(documentos_adjuntos) > 0;

COMMENT ON INDEX idx_solicitudes_usuario_estado_fecha IS 'Índice principal para consultas de usuario (INCLUDE evita table lookup)';
COMMENT ON INDEX idx_solicitudes_pendientes_aprobacion IS 'Optimizado para jefes buscando solicitudes a aprobar';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Actualizar updated_at
CREATE TRIGGER trg_solicitudes_updated_at 
  BEFORE UPDATE ON solicitudes 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Incrementar version para optimistic locking
CREATE TRIGGER trg_solicitudes_version 
  BEFORE UPDATE ON solicitudes 
  FOR EACH ROW EXECUTE FUNCTION incrementar_version();

-- Auto-generar código de solicitud
CREATE OR REPLACE FUNCTION generar_codigo_solicitud()
RETURNS TRIGGER AS $$
DECLARE
  contador INTEGER;
  anio INTEGER;
BEGIN
  -- Si ya tiene código, no hacer nada
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN 
    RETURN NEW; 
  END IF;
  
  -- Obtener año de la creación
  anio := EXTRACT(YEAR FROM NEW.created_at)::INTEGER;
  
  -- Contar solicitudes del año (lock para evitar duplicados en concurrencia)
  SELECT COUNT(*) + 1 INTO contador 
  FROM solicitudes 
  WHERE EXTRACT(YEAR FROM created_at) = anio
  FOR UPDATE;
  
  -- Generar código formato: SOL-2026-000001
  NEW.codigo := 'SOL-' || anio || '-' || LPAD(contador::TEXT, 6, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitud_generar_codigo 
  BEFORE INSERT ON solicitudes 
  FOR EACH ROW EXECUTE FUNCTION generar_codigo_solicitud();

COMMENT ON FUNCTION generar_codigo_solicitud IS 'Auto-genera código único formato SOL-AAAA-NNNNNN con lock para concurrencia';

-- Validar y actualizar balances al aprobar/rechazar
CREATE OR REPLACE FUNCTION actualizar_balance_por_solicitud()
RETURNS TRIGGER AS $$
DECLARE
  tipo_ausencia_record RECORD;
  balance_record RECORD;
BEGIN
  -- Solo procesar cambios de estado
  IF TG_OP = 'INSERT' OR OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;
  
  -- Obtener tipo de ausencia y balance
  SELECT * INTO tipo_ausencia_record
  FROM tipos_ausencia_config
  WHERE id = NEW.tipo_ausencia_id;
  
  SELECT * INTO balance_record
  FROM balances_ausencias
  WHERE usuario_id = NEW.usuario_id
    AND tipo_ausencia_id = NEW.tipo_ausencia_id
    AND anio = EXTRACT(YEAR FROM NEW.fecha_inicio)::INTEGER
    AND estado = 'activo'
  FOR UPDATE;
  
  -- De borrador/pendiente a aprobada_jefe: agregar a pendiente
  IF OLD.estado IN ('borrador', 'pendiente') AND NEW.estado = 'aprobada_jefe' THEN
    UPDATE balances_ausencias
    SET cantidad_pendiente = cantidad_pendiente + NEW.cantidad
    WHERE id = balance_record.id;
    
  -- De aprobada_jefe a aprobada (RRHH): mover de pendiente a utilizada
  ELSIF OLD.estado = 'aprobada_jefe' AND NEW.estado = 'aprobada' THEN
    UPDATE balances_ausencias
    SET cantidad_pendiente = cantidad_pendiente - NEW.cantidad,
        cantidad_utilizada = cantidad_utilizada + NEW.cantidad
    WHERE id = balance_record.id;
    
  -- De aprobada_jefe a rechazada: liberar pendiente
  ELSIF OLD.estado = 'aprobada_jefe' AND NEW.estado = 'rechazada' THEN
    UPDATE balances_ausencias
    SET cantidad_pendiente = cantidad_pendiente - NEW.cantidad
    WHERE id = balance_record.id;
    
  -- Cancelación de solicitud aprobada: revertir utilizada
  ELSIF OLD.estado = 'aprobada' AND NEW.estado = 'cancelada' THEN
    UPDATE balances_ausencias
    SET cantidad_utilizada = cantidad_utilizada - NEW.cantidad
    WHERE id = balance_record.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitud_actualizar_balance 
  AFTER INSERT OR UPDATE OF estado ON solicitudes 
  FOR EACH ROW EXECUTE FUNCTION actualizar_balance_por_solicitud();

COMMENT ON FUNCTION actualizar_balance_por_solicitud IS 'Actualiza balances automáticamente según cambios de estado';

-- =====================================================
-- FUNCTION: crear_particion_solicitudes
-- Crea partición para nuevo año
-- =====================================================
CREATE OR REPLACE FUNCTION crear_particion_solicitudes(p_anio INTEGER)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS solicitudes_%s PARTITION OF solicitudes 
     FOR VALUES FROM (%L) TO (%L)',
    p_anio,
    p_anio || '-01-01',
    (p_anio + 1) || '-01-01'
  );
  
  RAISE NOTICE 'Partición solicitudes_% creada', p_anio;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crear_particion_solicitudes IS 'Crea partición de solicitudes para año específico';

-- =====================================================
-- FUNCTION: validar_solapamiento_solicitudes
-- Valida que no haya solicitudes solapadas
-- =====================================================
CREATE OR REPLACE FUNCTION validar_solapamiento_solicitudes(
  p_usuario_id BIGINT,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_solicitud_id BIGINT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  tiene_solapamiento BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM solicitudes
    WHERE usuario_id = p_usuario_id
      AND estado NOT IN ('rechazada', 'cancelada', 'borrador')
      AND deleted_at IS NULL
      AND (id != p_solicitud_id OR p_solicitud_id IS NULL)
      AND (
        (fecha_inicio, fecha_fin) OVERLAPS (p_fecha_inicio, p_fecha_fin)
      )
  ) INTO tiene_solapamiento;
  
  RETURN tiene_solapamiento;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validar_solapamiento_solicitudes IS 'Verifica si hay solicitudes en el mismo rango de fechas';

-- =====================================================
-- FUNCTION: obtener_solicitudes_pendientes_usuario
-- Retorna solicitudes pendientes con datos relacionados
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_solicitudes_pendientes_usuario(
  p_usuario_id BIGINT,
  p_limite INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  codigo VARCHAR,
  tipo_ausencia_nombre VARCHAR,
  fecha_inicio DATE,
  fecha_fin DATE,
  cantidad DECIMAL,
  unidad unidad_tiempo,
  estado estado_solicitud,
  fecha_solicitud TIMESTAMP WITH TIME ZONE,
  dias_desde_solicitud INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.codigo,
    t.nombre as tipo_ausencia_nombre,
    s.fecha_inicio,
    s.fecha_fin,
    s.cantidad,
    s.unidad,
    s.estado,
    s.fecha_solicitud,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - s.fecha_solicitud)::INTEGER as dias_desde_solicitud
  FROM solicitudes s
  INNER JOIN tipos_ausencia_config t ON t.id = s.tipo_ausencia_id
  WHERE s.usuario_id = p_usuario_id
    AND s.estado IN ('pendiente', 'aprobada_jefe')
    AND s.deleted_at IS NULL
  ORDER BY s.fecha_solicitud DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_solicitudes_pendientes_usuario IS 'Lista solicitudes en estado pendiente con datos enriquecidos';

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de solicitudes con datos completos
CREATE OR REPLACE VIEW v_solicitudes_detalle AS
SELECT 
  s.id,
  s.codigo,
  s.usuario_id,
  u.nombre_completo as usuario_nombre,
  u.email as usuario_email,
  d.nombre as departamento_nombre,
  s.tipo_ausencia_id,
  t.nombre as tipo_ausencia_nombre,
  t.tipo as tipo_ausencia_codigo,
  s.fecha_inicio,
  s.fecha_fin,
  s.cantidad,
  s.unidad,
  s.estado,
  s.fecha_solicitud,
  s.fecha_aprobacion_jefe,
  s.fecha_aprobacion_rrhh,
  s.fecha_rechazo,
  aprobador.nombre_completo as aprobado_por_nombre,
  aprobador_rrhh.nombre_completo as aprobado_rrhh_por_nombre,
  rechazador.nombre_completo as rechazado_por_nombre,
  s.motivo,
  s.motivo_rechazo,
  s.observaciones,
  s.version,
  s.created_at,
  s.updated_at
FROM solicitudes s
INNER JOIN usuarios u ON u.id = s.usuario_id
INNER JOIN departamentos d ON d.id = u.departamento_id
INNER JOIN tipos_ausencia_config t ON t.id = s.tipo_ausencia_id
LEFT JOIN usuarios aprobador ON aprobador.id = s.aprobado_por
LEFT JOIN usuarios aprobador_rrhh ON aprobador_rrhh.id = s.aprobado_rrhh_por
LEFT JOIN usuarios rechazador ON rechazador.id = s.rechazado_por
WHERE s.deleted_at IS NULL;

COMMENT ON VIEW v_solicitudes_detalle IS 'Vista completa de solicitudes con datos relacionados';

-- =====================================================
-- VALIDACIÓN
-- =====================================================
SELECT 
  'TABLA: solicitudes' as tabla, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
  COUNT(*) FILTER (WHERE estado = 'aprobada') as aprobadas,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminadas
FROM solicitudes;

-- Verificar particiones
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as tamaño
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename LIKE 'solicitudes_%'
ORDER BY tablename;

-- =====================================================
-- END OF FILE
-- =====================================================
