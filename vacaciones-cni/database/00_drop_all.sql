-- ============================================
-- Script para DROP de todas las tablas
-- ⚠️ CUIDADO: Esto eliminará TODOS los datos
-- ============================================

-- Desactivar constraints temporalmente
SET session_replication_role = 'replica';

-- Drop tablas en orden inverso (respetando foreign keys)
DROP TABLE IF EXISTS usuarios_roles CASCADE;
DROP TABLE IF EXISTS roles_permisos CASCADE;
DROP TABLE IF EXISTS permisos CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS balances CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS departamentos CASCADE;
DROP TABLE IF EXISTS anos_laborales CASCADE;

-- Drop tipos enum
DROP TYPE IF EXISTS estado_solicitud CASCADE;
DROP TYPE IF EXISTS tipo_solicitud CASCADE;

-- Reactivar constraints
SET session_replication_role = 'origin';

-- Confirmar limpieza
SELECT 'Base de datos limpiada exitosamente' as status;
