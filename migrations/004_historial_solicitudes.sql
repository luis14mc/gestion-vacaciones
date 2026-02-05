-- =====================================================
-- Migración 004: Sistema de Auditoría y Historial
-- Descripción: Crear tabla para registrar todos los 
--              cambios de estado en las solicitudes
-- Fecha: 2026-01-08
-- =====================================================

-- Tabla: solicitudes_historial
-- Registra cada cambio de estado de una solicitud
CREATE TABLE IF NOT EXISTS solicitudes_historial (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  accion VARCHAR(50) NOT NULL,
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20) NOT NULL,
  comentario TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_historial_solicitud 
    FOREIGN KEY (solicitud_id) 
    REFERENCES solicitudes(id) 
    ON DELETE CASCADE,
  
  CONSTRAINT fk_historial_usuario 
    FOREIGN KEY (usuario_id) 
    REFERENCES usuarios(id) 
    ON DELETE RESTRICT
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_historial_solicitud 
  ON solicitudes_historial(solicitud_id);

CREATE INDEX IF NOT EXISTS idx_historial_usuario 
  ON solicitudes_historial(usuario_id);

CREATE INDEX IF NOT EXISTS idx_historial_fecha 
  ON solicitudes_historial(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historial_accion 
  ON solicitudes_historial(accion);

-- Comentarios para documentación
COMMENT ON TABLE solicitudes_historial IS 
  'Registro de auditoría de todos los cambios de estado en solicitudes';

COMMENT ON COLUMN solicitudes_historial.accion IS 
  'Tipo de acción: crear, aprobar_jefe, aprobar_rrhh, rechazar, cancelar';

COMMENT ON COLUMN solicitudes_historial.metadata IS 
  'Información adicional como IP, user agent, motivo de rechazo, etc.';

-- =====================================================
-- Datos de prueba (opcional para desarrollo)
-- =====================================================

-- Registrar historial de solicitudes existentes
-- (Esto es opcional, solo si quieres crear historial retroactivo)
/*
INSERT INTO solicitudes_historial (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, created_at)
SELECT 
  id,
  usuario_id,
  'crear',
  NULL,
  'pendiente',
  created_at
FROM solicitudes
WHERE estado = 'pendiente';
*/

-- =====================================================
-- Verificación
-- =====================================================

-- Ver estructura de la tabla
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'solicitudes_historial'
ORDER BY ordinal_position;

-- Verificar índices creados
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'solicitudes_historial';
