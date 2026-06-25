-- =====================================================
-- VALIDACIÓN: Schema CNI 4.0
-- =====================================================
-- @description Queries de validación para confirmar despliegue correcto
-- @author Arquitecto de Datos Senior
-- @date 2026-02-05
--
-- EJECUTAR: psql $env:DATABASE_URL -f database/validate-cni-schema.sql
-- =====================================================

\echo '═══════════════════════════════════════════════════════════'
\echo '🔍 VALIDACIÓN DE SCHEMA CNI 5.0 (Drizzle)'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

-- =====================================================
-- 1. VALIDAR TABLAS CREADAS
-- =====================================================

\echo '📊 1. VALIDANDO TABLAS...'
\echo ''

SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo 'Esperado: 15 tablas (schema Drizzle actual)'
\echo ''

-- =====================================================
-- 2. VALIDAR ÍNDICES
-- =====================================================

\echo '🔎 2. VALIDANDO ÍNDICES...'
\echo ''

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'usuarios', 'roles', 'permisos', 'roles_permisos', 'usuarios_roles', 'sessions', 'rate_limits',
    'departamentos', 'usuarios_departamentos', 'configuracion',
    'anos_laborales', 'solicitudes', 'balances',
    'historial_balances', 'registros_auditoria'
)
ORDER BY tablename, indexname;

\echo ''
\echo 'Esperado: 77+ índices'
\echo ''

-- =====================================================
-- 3. VALIDAR CONSTRAINTS
-- =====================================================

\echo '🔒 3. VALIDANDO CONSTRAINTS...'
\echo ''

SELECT 
    conrelid::regclass AS tabla,
    conname AS constraint_name,
    contype AS tipo,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype, conname;

\echo ''
\echo 'Esperado: 17+ constraints (unique, check, fk)'
\echo ''

-- =====================================================
-- 4. VALIDAR TRIGGERS
-- =====================================================

\echo '⚙️  4. VALIDANDO TRIGGERS...'
\echo ''

SELECT 
    trigger_name,
    event_object_table AS tabla,
    event_manipulation AS evento,
    action_timing AS timing,
    action_statement AS accion
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

\echo ''
\echo 'Esperado: 6+ triggers'
\echo '  - trg_actualizar_cantidad_disponible (balances)'
\echo '  - trg_actualizar_updated_at_* (usuarios, solicitudes, roles, departamentos, anos_laborales)'
\echo ''

-- =====================================================
-- 5. VALIDAR FUNCIONES
-- =====================================================

\echo '🔧 5. VALIDANDO FUNCIONES...'
\echo ''

SELECT 
    routine_name,
    routine_type,
    data_type AS return_type,
    external_language
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'generar_codigo_cni_solicitud',
    'actualizar_cantidad_disponible_balance',
    'actualizar_updated_at'
)
ORDER BY routine_name;

\echo ''
\echo 'Esperado: 3 funciones'
\echo '  - generar_codigo_cni_solicitud'
\echo '  - actualizar_cantidad_disponible_balance'
\echo '  - actualizar_updated_at'
\echo ''

-- =====================================================
-- 6. VALIDAR CAMPOS CNI EN SOLICITUDES
-- =====================================================

\echo '✨ 6. VALIDANDO CAMPOS CNI (solicitudes)...'
\echo ''

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'solicitudes'
AND column_name IN (
    'codigo',
    'hora_salida',
    'hora_regreso',
    'aprobada_jefe_por',
    'aprobada_rrhh_por',
    'version'
)
ORDER BY column_name;

\echo ''
\echo 'Esperado: 6 campos activos (código CNI, permisos hora, flujo 2 niveles, locking)'
\echo ''

-- =====================================================
-- 7. VALIDAR CANTIDAD_DISPONIBLE EN BALANCES
-- =====================================================

\echo '💰 7. VALIDANDO cantidad_disponible (balances)...'
\echo ''

SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'balances'
AND column_name = 'cantidad_disponible';

\echo ''
\echo 'Esperado: DECIMAL(10,2) NOT NULL DEFAULT 0.00'
\echo ''

-- =====================================================
-- 8. PROBAR FUNCIÓN generar_codigo_cni_solicitud()
-- =====================================================

\echo '🧪 8. PROBANDO GENERACIÓN DE CÓDIGO CNI...'
\echo ''

SELECT 
    generar_codigo_cni_solicitud(2026) AS codigo_2026,
    generar_codigo_cni_solicitud(2027) AS codigo_2027;

\echo ''
\echo 'Esperado: CNI-SOL-2026-0001, CNI-SOL-2027-0001'
\echo ''

-- =====================================================
-- 9. VALIDAR ENUMS
-- =====================================================

\echo '📋 9. VALIDANDO ENUMS...'
\echo ''

SELECT 
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

\echo ''
\echo 'Esperado: 6 enums'
\echo '  - tipo_permiso, tipo_ausencia, metodo_credito'
\echo '  - estado_solicitud, origen_solicitud'
\echo '  - tipo_movimiento, tipo_operacion_auditoria'
\echo ''

-- =====================================================
-- 10. ESTADÍSTICAS FINALES
-- =====================================================

\echo '═══════════════════════════════════════════════════════════'
\echo '📊 ESTADÍSTICAS FINALES'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

SELECT 
    'Tablas' AS tipo,
    COUNT(*) AS cantidad
FROM pg_tables
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Índices' AS tipo,
    COUNT(*) AS cantidad
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Triggers' AS tipo,
    COUNT(*) AS cantidad
FROM information_schema.triggers
WHERE trigger_schema = 'public'

UNION ALL

SELECT 
    'Funciones' AS tipo,
    COUNT(*) AS cantidad
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'

UNION ALL

SELECT 
    'Enums' AS tipo,
    COUNT(DISTINCT typname) AS cantidad
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public';

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '✅ VALIDACIÓN COMPLETADA'
\echo '═══════════════════════════════════════════════════════════'
\echo ''
\echo 'Si todos los valores coinciden con lo esperado:'
\echo '  ✅ Schema CNI 5.0 desplegado correctamente'
\echo '  ✅ Listo para desarrollo'
\echo ''
\echo 'Si hay diferencias:'
\echo '  ❌ Revisar logs de drizzle-kit push'
\echo '  ❌ Verificar ejecución de 09_cni_business_logic.sql'
\echo '═══════════════════════════════════════════════════════════'
