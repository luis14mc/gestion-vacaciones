-- ============================================================
-- 🔥 HARD RESET TOTAL - Purga Completa de Base de Datos
-- ============================================================
-- @author Database Architect Senior
-- @date 2026-02-05
-- @warning DESTRUCTIVO - Elimina TODO sin posibilidad de recuperación
-- ============================================================

-- Paso 1: Desconectar sesiones activas (opcional, útil si hay locks)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

-- Paso 2: Drop SCHEMA PUBLIC con CASCADE (elimina tablas, triggers, functions, enums)
DROP SCHEMA IF EXISTS public CASCADE;

-- Paso 3: Recrear schema limpio
CREATE SCHEMA public;

-- Paso 4: Restaurar permisos estándar
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Paso 5: Verificación de limpieza
SELECT 
  'Tablas' as tipo, 
  COUNT(*) as cantidad 
FROM pg_tables 
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'Enums' as tipo, 
  COUNT(DISTINCT typname) as cantidad
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'

UNION ALL

SELECT 
  'Functions' as tipo,
  COUNT(*) as cantidad
FROM information_schema.routines
WHERE routine_schema = 'public'

UNION ALL

SELECT 
  'Triggers' as tipo,
  COUNT(*) as cantidad
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Resultado esperado: Todos los conteos deben ser 0
-- ============================================================
-- ✅ BASE DE DATOS LIMPIA - Lista para nueva arquitectura
-- ============================================================
