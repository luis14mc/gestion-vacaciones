-- =====================================================
-- 05_auditoria_logs.sql
-- Sistema de Auditoría y Configuración
-- PostgreSQL - Ejecutar QUINTO
-- =====================================================
-- Autor: Senior Database Architect
-- Fecha: 5 febrero 2026
-- Versión: 3.0
-- =====================================================

-- =====================================================
-- TABLA: auditoria (Particionada por fecha_creacion)
-- Log completo de acciones del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  accion VARCHAR(50) NOT NULL,
  tabla_afectada VARCHAR(100) NOT NULL,
  registro_id BIGINT,
  detalles JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  PRIMARY KEY (id, fecha_creacion),
  
  -- Check Constraints
  CONSTRAINT chk_auditoria_accion_valida CHECK (
    accion IN (
      'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
      'APROBAR', 'RECHAZAR', 'CANCELAR',
      'EXPORT', 'IMPORT', 'CONFIG_CHANGE',
      'PASSWORD_CHANGE', 'ROLE_ASSIGN', 'ROLE_REMOVE'
    )
  ),
  CONSTRAINT chk_auditoria_ip_formato CHECK (
    ip_address IS NULL OR 
    ip_address ~ '^(\d{1,3}\.){3}\d{1,3}$' OR  -- IPv4
    ip_address ~ '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$'  -- IPv6
  )
) PARTITION BY RANGE (fecha_creacion);

-- Crear particiones mensuales para 2026 (Enero - Diciembre)
CREATE TABLE IF NOT EXISTS auditoria_2026_01 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_02 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_03 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_04 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_05 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_06 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_07 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_08 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_09 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_10 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_11 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS auditoria_2026_12 PARTITION OF auditoria 
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

COMMENT ON TABLE auditoria IS 'Log de auditoría completo (particionado mensualmente)';
COMMENT ON COLUMN auditoria.accion IS 'Tipo de acción realizada (CREATE, UPDATE, DELETE, etc)';
COMMENT ON COLUMN auditoria.detalles IS 'Datos JSON con información específica de la acción';

-- =====================================================
-- ÍNDICES PARA AUDITORÍA
-- =====================================================

-- Patrón 1: Búsqueda por usuario y fecha
CREATE INDEX idx_auditoria_usuario_fecha 
  ON auditoria(usuario_id, fecha_creacion DESC)
  INCLUDE (accion, tabla_afectada, registro_id)
  WHERE usuario_id IS NOT NULL;

-- Patrón 2: Búsqueda por tabla y registro específico
CREATE INDEX idx_auditoria_tabla_registro 
  ON auditoria(tabla_afectada, registro_id, fecha_creacion DESC)
  WHERE registro_id IS NOT NULL;

-- Patrón 3: Búsqueda por acción
CREATE INDEX idx_auditoria_accion 
  ON auditoria(accion, fecha_creacion DESC);

-- Patrón 4: Búsqueda por tabla afectada
CREATE INDEX idx_auditoria_tabla 
  ON auditoria(tabla_afectada, fecha_creacion DESC);

-- Índice para búsquedas recientes
CREATE INDEX idx_auditoria_fecha 
  ON auditoria(fecha_creacion DESC);

-- Índice GIN para búsqueda en detalles JSON
CREATE INDEX idx_auditoria_detalles 
  ON auditoria USING GIN(detalles jsonb_path_ops);

COMMENT ON INDEX idx_auditoria_usuario_fecha IS 'Optimizado para historial de acciones por usuario';
COMMENT ON INDEX idx_auditoria_tabla_registro IS 'Optimizado para auditoría de registros específicos';

-- =====================================================
-- TABLA: configuracion_sistema
-- Configuración dinámica del sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(100) NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  tipo_dato VARCHAR(20) NOT NULL DEFAULT 'string',
  descripcion TEXT,
  categoria VARCHAR(50),
  es_publico BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Check Constraints
  CONSTRAINT chk_config_tipo_dato_valido CHECK (
    tipo_dato IN ('string', 'number', 'boolean', 'json', 'date', 'array')
  ),
  CONSTRAINT chk_config_clave_formato CHECK (
    clave ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
  )
);

-- Índices
CREATE INDEX idx_config_clave ON configuracion_sistema(clave);
CREATE INDEX idx_config_categoria ON configuracion_sistema(categoria) WHERE categoria IS NOT NULL;
CREATE INDEX idx_config_publico ON configuracion_sistema(es_publico) WHERE es_publico = true;

COMMENT ON TABLE configuracion_sistema IS 'Configuración dinámica key-value con versionado';
COMMENT ON COLUMN configuracion_sistema.clave IS 'Formato: categoria.subcategoria.nombre (snake_case)';
COMMENT ON COLUMN configuracion_sistema.tipo_dato IS 'Tipo del valor para validación en aplicación';
COMMENT ON COLUMN configuracion_sistema.es_publico IS 'true si puede ser leído sin autenticación';
COMMENT ON COLUMN configuracion_sistema.version IS 'Versionado para caché invalidation';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Actualizar updated_at
CREATE TRIGGER trg_config_updated_at 
  BEFORE UPDATE ON configuracion_sistema 
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Incrementar version
CREATE TRIGGER trg_config_version 
  BEFORE UPDATE ON configuracion_sistema 
  FOR EACH ROW EXECUTE FUNCTION incrementar_version();

-- Auditar cambios en configuración automáticamente
CREATE OR REPLACE FUNCTION auditar_cambio_configuracion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (
    usuario_id,
    accion,
    tabla_afectada,
    registro_id,
    detalles
  ) VALUES (
    CURRENT_SETTING('app.current_user_id', true)::BIGINT,
    TG_OP,
    'configuracion_sistema',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'clave', COALESCE(NEW.clave, OLD.clave),
      'valor_anterior', CASE WHEN TG_OP != 'INSERT' THEN OLD.valor END,
      'valor_nuevo', CASE WHEN TG_OP != 'DELETE' THEN NEW.valor END,
      'tipo_dato', COALESCE(NEW.tipo_dato, OLD.tipo_dato)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla auditoría, continuar con operación
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_config_auditar 
  AFTER INSERT OR UPDATE OR DELETE ON configuracion_sistema 
  FOR EACH ROW EXECUTE FUNCTION auditar_cambio_configuracion();

COMMENT ON FUNCTION auditar_cambio_configuracion IS 'Registra automáticamente cambios en configuración';

-- =====================================================
-- FUNCTION: crear_particion_auditoria
-- Crea partición mensual de auditoría
-- =====================================================
CREATE OR REPLACE FUNCTION crear_particion_auditoria(p_anio INTEGER, p_mes INTEGER)
RETURNS VOID AS $$
DECLARE
  fecha_inicio TEXT;
  fecha_fin TEXT;
  nombre_particion TEXT;
BEGIN
  fecha_inicio := p_anio || '-' || LPAD(p_mes::TEXT, 2, '0') || '-01';
  
  -- Calcular primer día del siguiente mes
  fecha_fin := (DATE(fecha_inicio) + INTERVAL '1 month')::TEXT;
  
  nombre_particion := 'auditoria_' || p_anio || '_' || LPAD(p_mes::TEXT, 2, '0');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF auditoria 
     FOR VALUES FROM (%L) TO (%L)',
    nombre_particion,
    fecha_inicio,
    fecha_fin
  );
  
  RAISE NOTICE 'Partición % creada para % a %', nombre_particion, fecha_inicio, fecha_fin;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crear_particion_auditoria IS 'Crea partición mensual de auditoría';

-- =====================================================
-- FUNCTION: purgar_auditoria_antigua
-- Elimina particiones de auditoría antiguas (data retention)
-- =====================================================
CREATE OR REPLACE FUNCTION purgar_auditoria_antigua(p_meses_retention INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
  particion RECORD;
  contador INTEGER := 0;
  fecha_limite TEXT;
BEGIN
  -- Calcular fecha límite
  fecha_limite := 'auditoria_' || TO_CHAR(CURRENT_DATE - (p_meses_retention || ' months')::INTERVAL, 'YYYY_MM');
  
  -- Buscar particiones antiguas
  FOR particion IN 
    SELECT tablename
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename LIKE 'auditoria_%'
      AND tablename < fecha_limite
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || particion.tablename || ' CASCADE';
    contador := contador + 1;
    RAISE NOTICE 'Partición % eliminada', particion.tablename;
  END LOOP;
  
  RETURN contador;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purgar_auditoria_antigua IS 'Elimina particiones de auditoría mayores a X meses';

-- =====================================================
-- FUNCTION: registrar_auditoria
-- Helper para registrar acciones desde aplicación
-- =====================================================
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_usuario_id BIGINT,
  p_accion VARCHAR,
  p_tabla_afectada VARCHAR,
  p_registro_id BIGINT DEFAULT NULL,
  p_detalles JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  auditoria_id BIGINT;
BEGIN
  INSERT INTO auditoria (
    usuario_id,
    accion,
    tabla_afectada,
    registro_id,
    detalles,
    ip_address,
    user_agent
  ) VALUES (
    p_usuario_id,
    p_accion,
    p_tabla_afectada,
    p_registro_id,
    p_detalles,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO auditoria_id;
  
  RETURN auditoria_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_auditoria IS 'Helper para registrar acciones de auditoría desde aplicación';

-- =====================================================
-- FUNCTION: obtener_historial_registro
-- Retorna historial completo de un registro
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_historial_registro(
  p_tabla VARCHAR,
  p_registro_id BIGINT,
  p_limite INTEGER DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  accion VARCHAR,
  usuario_nombre VARCHAR,
  detalles JSONB,
  fecha_creacion TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.accion,
    u.nombre_completo as usuario_nombre,
    a.detalles,
    a.fecha_creacion
  FROM auditoria a
  LEFT JOIN usuarios u ON u.id = a.usuario_id
  WHERE a.tabla_afectada = p_tabla
    AND a.registro_id = p_registro_id
  ORDER BY a.fecha_creacion DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_historial_registro IS 'Retorna historial de auditoría de un registro específico';

-- =====================================================
-- FUNCTION: estadisticas_auditoria
-- Retorna estadísticas de auditoría
-- =====================================================
CREATE OR REPLACE FUNCTION estadisticas_auditoria(
  p_fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_fecha_fin TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
  accion VARCHAR,
  tabla VARCHAR,
  cantidad BIGINT,
  usuarios_unicos BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.accion,
    a.tabla_afectada as tabla,
    COUNT(*) as cantidad,
    COUNT(DISTINCT a.usuario_id) as usuarios_unicos
  FROM auditoria a
  WHERE a.fecha_creacion BETWEEN p_fecha_inicio AND p_fecha_fin
  GROUP BY a.accion, a.tabla_afectada
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION estadisticas_auditoria IS 'Estadísticas de auditoría por acción y tabla';

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de actividad reciente
CREATE OR REPLACE VIEW v_actividad_reciente AS
SELECT 
  a.id,
  a.accion,
  a.tabla_afectada,
  a.registro_id,
  u.nombre_completo as usuario_nombre,
  u.email as usuario_email,
  a.ip_address,
  a.fecha_creacion,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.fecha_creacion))::INTEGER as segundos_atras
FROM auditoria a
LEFT JOIN usuarios u ON u.id = a.usuario_id
WHERE a.fecha_creacion >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY a.fecha_creacion DESC
LIMIT 100;

COMMENT ON VIEW v_actividad_reciente IS 'Últimas 100 acciones registradas en las últimas 24 horas';

-- Vista de configuración por categoría
CREATE OR REPLACE VIEW v_configuracion_categorias AS
SELECT 
  c.categoria,
  COUNT(*) as total_configuraciones,
  COUNT(*) FILTER (WHERE c.es_publico = true) as configuraciones_publicas,
  MAX(c.updated_at) as ultima_actualizacion
FROM configuracion_sistema c
GROUP BY c.categoria
ORDER BY c.categoria;

COMMENT ON VIEW v_configuracion_categorias IS 'Resumen de configuraciones agrupadas por categoría';

-- =====================================================
-- JOB PARA MANTENIMIENTO (Ejecutar con pg_cron)
-- =====================================================

-- Crear particiones futuras automáticamente
-- SELECT cron.schedule('crear-particiones-auditoria', '0 0 1 * *', 
--   'SELECT crear_particion_auditoria(EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL ''1 month'')::INTEGER, EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL ''1 month'')::INTEGER)');

-- Purgar particiones antiguas mensualmente
-- SELECT cron.schedule('purgar-auditoria-antigua', '0 2 1 * *', 
--   'SELECT purgar_auditoria_antigua(12)');

-- =====================================================
-- VALIDACIÓN
-- =====================================================
SELECT 
  'TABLA: auditoria' as tabla, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE fecha_creacion >= CURRENT_DATE) as hoy,
  COUNT(*) FILTER (WHERE fecha_creacion >= CURRENT_DATE - INTERVAL '7 days') as ultima_semana
FROM auditoria
UNION ALL
SELECT 
  'TABLA: configuracion_sistema', 
  COUNT(*),
  COUNT(*) FILTER (WHERE es_publico = true),
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days')
FROM configuracion_sistema;

-- Verificar particiones de auditoría
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as tamaño
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename LIKE 'auditoria_%'
ORDER BY tablename DESC
LIMIT 12;

-- =====================================================
-- END OF FILE
-- =====================================================
