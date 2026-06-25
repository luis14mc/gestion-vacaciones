-- =====================================================
-- CNI BUSINESS LOGIC: Triggers & Functions
-- =====================================================
-- @description Lógica de negocio para CNI (triggers, funciones, auto-generación)
-- @author Arquitecto de Datos Senior
-- @version 4.0
-- @date 2026-02-05
--
-- CONTENIDO:
-- 1. Función para auto-generar código CNI-SOL-YYYY-XXXX
-- 2. Trigger para actualizar cantidad_disponible en balances
-- 3. Función para actualizar updated_at automáticamente
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN: Generar código CNI automáticamente
-- =====================================================
-- Formato: CNI-SOL-YYYY-XXXX
-- Ejemplo: CNI-SOL-2026-0001
-- =====================================================

CREATE OR REPLACE FUNCTION generar_codigo_cni_solicitud(ano_laboral INTEGER)
RETURNS VARCHAR(50) AS $$
DECLARE
    nuevo_codigo VARCHAR(50);
    siguiente_numero INTEGER;
    numero_formateado VARCHAR(4);
BEGIN
    -- Obtener el siguiente número secuencial para el año laboral
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(codigo FROM 'CNI-SOL-[0-9]{4}-([0-9]{4})') 
            AS INTEGER
        )
    ), 0) + 1
    INTO siguiente_numero
    FROM solicitudes
    WHERE SUBSTRING(codigo FROM 'CNI-SOL-([0-9]{4})') = ano_laboral::VARCHAR;

    -- Formatear número con ceros a la izquierda (0001, 0002, etc.)
    numero_formateado := LPAD(siguiente_numero::VARCHAR, 4, '0');

    -- Construir código completo
    nuevo_codigo := 'CNI-SOL-' || ano_laboral::VARCHAR || '-' || numero_formateado;

    RETURN nuevo_codigo;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comentario de la función
-- =====================================================
COMMENT ON FUNCTION generar_codigo_cni_solicitud(INTEGER) IS 
'Genera código único para solicitudes en formato CNI-SOL-YYYY-XXXX. 
Usa secuencia automática por año laboral.';

-- =====================================================
-- 2. TRIGGER: Actualizar cantidad_disponible en balances
-- =====================================================
-- cantidad_disponible = (cantidad_inicial + cantidad_acumulada) - (cantidad_usada + cantidad_pendiente)
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_cantidad_disponible_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular cantidad disponible
    NEW.cantidad_disponible := 
        (NEW.cantidad_inicial + NEW.cantidad_acumulada) - 
        (NEW.cantidad_usada + NEW.cantidad_pendiente);

    -- Asegurar que no sea negativa (validación adicional)
    IF NEW.cantidad_disponible < 0 THEN
        NEW.cantidad_disponible := 0;
    END IF;

    -- Actualizar timestamp de modificación
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Crear trigger en INSERT y UPDATE
-- =====================================================

DROP TRIGGER IF EXISTS trg_actualizar_cantidad_disponible ON balances;

CREATE TRIGGER trg_actualizar_cantidad_disponible
    BEFORE INSERT OR UPDATE OF cantidad_inicial, cantidad_acumulada, cantidad_usada, cantidad_pendiente
    ON balances
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_cantidad_disponible_balance();

-- =====================================================
-- Comentario del trigger
-- =====================================================
COMMENT ON TRIGGER trg_actualizar_cantidad_disponible ON balances IS 
'Actualiza automáticamente el campo cantidad_disponible cuando cambian los valores de balance.
Formula: disponible = (inicial + acumulada) - (usada + pendiente)';

-- =====================================================
-- 3. TRIGGER: Auto-actualizar updated_at
-- =====================================================
-- Aplica a múltiples tablas para mantener timestamps actualizados
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Aplicar trigger a tablas principales
-- =====================================================

-- Usuarios
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_usuarios ON usuarios;
CREATE TRIGGER trg_actualizar_updated_at_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Solicitudes
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_solicitudes ON solicitudes;
CREATE TRIGGER trg_actualizar_updated_at_solicitudes
    BEFORE UPDATE ON solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Roles
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_roles ON roles;
CREATE TRIGGER trg_actualizar_updated_at_roles
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Departamentos
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_departamentos ON departamentos;
CREATE TRIGGER trg_actualizar_updated_at_departamentos
    BEFORE UPDATE ON departamentos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Años Laborales
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_anos_laborales ON anos_laborales;
CREATE TRIGGER trg_actualizar_updated_at_anos_laborales
    BEFORE UPDATE ON anos_laborales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Tipos Ausencia Config
DROP TRIGGER IF EXISTS trg_actualizar_updated_at_tipos_ausencia_config ON tipos_ausencia_config;
CREATE TRIGGER trg_actualizar_updated_at_tipos_ausencia_config
    BEFORE UPDATE ON tipos_ausencia_config
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- =====================================================
-- VERIFICACIÓN: Queries de validación
-- =====================================================

-- Verificar que triggers fueron creados
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('balances', 'solicitudes', 'usuarios', 'roles', 'departamentos', 'anos_laborales', 'tipos_ausencia_config')
ORDER BY event_object_table, trigger_name;

-- Verificar funciones creadas
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('generar_codigo_cni_solicitud', 'actualizar_cantidad_disponible_balance', 'actualizar_updated_at')
ORDER BY routine_name;

-- =====================================================
-- EJEMPLO DE USO
-- =====================================================

-- Generar código para solicitud del año 2026:
-- SELECT generar_codigo_cni_solicitud(2026);
-- Resultado: CNI-SOL-2026-0001

-- Test del trigger de cantidad_disponible:
-- UPDATE balances SET cantidad_usada = cantidad_usada + 5 WHERE id = 1;
-- (cantidad_disponible se actualizará automáticamente)

-- =====================================================
-- FIN: CNI Business Logic
-- =====================================================
