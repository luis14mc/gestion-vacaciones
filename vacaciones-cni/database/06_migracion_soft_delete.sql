-- =====================================================
-- MIGRACIÓN: Agregar columnas deleted_at
-- Fecha: 2025-11-18
-- Descripción: Agrega soft delete a tablas que lo necesitan
-- =====================================================

-- Agregar deleted_at a departamentos
ALTER TABLE departamentos 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Agregar deleted_at a usuarios (si no existe)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Agregar deleted_at a solicitudes (si no existe)
ALTER TABLE solicitudes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Crear índices para mejorar performance de queries con soft delete
CREATE INDEX IF NOT EXISTS idx_departamentos_deleted ON departamentos(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_deleted ON usuarios(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_solicitudes_deleted ON solicitudes(deleted_at, created_at) WHERE deleted_at IS NULL;

-- Verificación
SELECT 
    'departamentos' as tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'departamentos' 
  AND column_name = 'deleted_at'
UNION ALL
SELECT 
    'usuarios' as tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'usuarios' 
  AND column_name = 'deleted_at'
UNION ALL
SELECT 
    'solicitudes' as tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'solicitudes' 
  AND column_name = 'deleted_at';
