-- =====================================================
-- 04_vistas_funciones.sql
-- PostgreSQL Local - Ejecutar CUARTO
-- =====================================================

CREATE OR REPLACE VIEW v_solicitudes_completas AS
SELECT 
  s.id, s.codigo, s.estado, s.cantidad, s.unidad, s.fecha_inicio, s.fecha_fin, s.motivo,
  u.id AS usuario_id, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email,
  d.id AS departamento_id, d.nombre AS departamento_nombre,
  ta.id AS tipo_id, ta.nombre AS tipo_nombre, ta.color_hex AS tipo_color,
  s.created_at
FROM solicitudes s
JOIN usuarios u ON u.id = s.usuario_id
JOIN departamentos d ON d.id = u.departamento_id
JOIN tipos_ausencia_config ta ON ta.id = s.tipo_ausencia_id
WHERE s.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_balances_actuales AS
SELECT 
  b.id, b.anio, b.cantidad_asignada, b.cantidad_utilizada, b.cantidad_pendiente, b.cantidad_disponible, b.estado,
  u.id AS usuario_id, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido,
  d.nombre AS departamento_nombre,
  ta.nombre AS tipo_nombre, ta.color_hex AS tipo_color
FROM balances_ausencias b
JOIN usuarios u ON u.id = b.usuario_id
JOIN departamentos d ON d.id = u.departamento_id
JOIN tipos_ausencia_config ta ON ta.id = b.tipo_ausencia_id
WHERE b.anio = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AND u.activo = true;

CREATE OR REPLACE FUNCTION obtener_balance_usuario(p_usuario_id BIGINT, p_tipo_ausencia_id BIGINT, p_anio INTEGER DEFAULT NULL)
RETURNS TABLE (balance_id BIGINT, cantidad_asignada DECIMAL, cantidad_utilizada DECIMAL, cantidad_pendiente DECIMAL, cantidad_disponible DECIMAL, estado estado_balance) AS $$
BEGIN
  IF p_anio IS NULL THEN p_anio := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER; END IF;
  RETURN QUERY SELECT b.id, b.cantidad_asignada, b.cantidad_utilizada, b.cantidad_pendiente, b.cantidad_disponible, b.estado
  FROM balances_ausencias b WHERE b.usuario_id = p_usuario_id AND b.tipo_ausencia_id = p_tipo_ausencia_id AND b.anio = p_anio;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION verificar_disponibilidad(p_usuario_id BIGINT, p_tipo_ausencia_id BIGINT, p_cantidad DECIMAL, p_anio INTEGER DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE v_disponible DECIMAL;
BEGIN
  IF p_anio IS NULL THEN p_anio := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER; END IF;
  SELECT cantidad_disponible INTO v_disponible FROM balances_ausencias WHERE usuario_id = p_usuario_id AND tipo_ausencia_id = p_tipo_ausencia_id AND anio = p_anio;
  IF v_disponible IS NULL THEN RETURN false; END IF;
  RETURN v_disponible >= p_cantidad;
END;
$$ LANGUAGE plpgsql STABLE;

SELECT 'Vistas' AS tipo, viewname AS nombre FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'Funciones', proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f' AND proname NOT LIKE 'trg_%'
ORDER BY tipo, nombre;
