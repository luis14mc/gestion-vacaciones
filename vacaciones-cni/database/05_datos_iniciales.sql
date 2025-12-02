-- =====================================================
-- 05_datos_iniciales.sql
-- PostgreSQL Local - Ejecutar QUINTO
-- =====================================================

INSERT INTO departamentos (nombre, codigo, descripcion, activo) VALUES
('Dirección General', 'DIR-GEN', 'Dirección ejecutiva', true),
('Recursos Humanos', 'RRHH', 'Gestión de talento humano', true),
('Tecnología', 'TI', 'Desarrollo y soporte tecnológico', true),
('Finanzas', 'FIN', 'Administración financiera', true),
('Operaciones', 'OPS', 'Gestión de operaciones', true),
('Legal', 'LEG', 'Asesoría jurídica', true),
('Comunicaciones', 'COM', 'Comunicación corporativa', true);

INSERT INTO usuarios (email, nombre, apellido, password_hash, departamento_id, cargo, es_admin, es_rrhh, es_jefe, activo, fecha_ingreso) VALUES
('admin@cni.gob.ni', 'Administrador', 'Sistema', '$2b$10$rZ5yRFGxGxm.JxP4VxOxje6KqH8qYqKZ5qVqGxYqKqKqKqKqKqKqK', 
  (SELECT id FROM departamentos WHERE codigo = 'DIR-GEN'), 'Administrador del Sistema', true, true, true, true, '2024-01-01'),
('rrhh@cni.gob.ni', 'RRHH', 'Principal', '$2b$10$sZ6zSGHyHyn.KyQ5WyPyke7LrI9rZrLZ6rWrHyZrLrLrLrLrLrLrL', 
  (SELECT id FROM departamentos WHERE codigo = 'RRHH'), 'Jefe de Recursos Humanos', false, true, true, true, '2024-01-01');

INSERT INTO tipos_ausencia_config (tipo, nombre, descripcion, requiere_aprobacion_jefe, requiere_aprobacion_rrhh, dias_maximos_por_solicitud, dias_anticipacion_minima, permite_medio_dia, permite_horas, requiere_documento, activo, color_hex) VALUES
('vacaciones', 'Vacaciones', 'Vacaciones anuales reglamentarias', true, true, 15, 7, true, false, false, true, '#3B82F6'),
('permiso_personal', 'Permiso Personal', 'Asuntos personales urgentes', true, false, 3, 1, true, true, false, true, '#10B981'),
('permiso_medico', 'Permiso Médico', 'Citas médicas o enfermedad', true, true, 5, 0, true, true, true, true, '#EF4444'),
('permiso_maternidad', 'Permiso de Maternidad', 'Licencia por maternidad', true, true, 90, 30, false, false, true, true, '#EC4899'),
('permiso_paternidad', 'Permiso de Paternidad', 'Licencia por paternidad', true, true, 5, 7, false, false, true, true, '#8B5CF6'),
('permiso_estudio', 'Permiso de Estudio', 'Tiempo para estudios', true, true, 10, 7, true, true, true, true, '#F59E0B'),
('permiso_duelo', 'Permiso por Duelo', 'Fallecimiento de familiar', true, true, 5, 0, false, false, true, true, '#6B7280'),
('permiso_otro', 'Otro Permiso', 'Otras ausencias justificadas', true, true, 5, 1, true, true, false, true, '#14B8A6');

INSERT INTO configuracion_sistema (clave, valor, tipo_dato, descripcion, categoria, es_publico) VALUES
('sistema.nombre', 'Sistema de Gestión de Vacaciones', 'string', 'Nombre del sistema', 'general', true),
('sistema.version', '2.0.0', 'string', 'Versión actual', 'general', true),
('vacaciones.dias_por_anio', '30', 'integer', 'Días de vacaciones por año', 'vacaciones', true),
('vacaciones.max_dias_consecutivos', '15', 'integer', 'Máximo días consecutivos', 'vacaciones', true);

INSERT INTO balances_ausencias (usuario_id, tipo_ausencia_id, anio, cantidad_asignada, estado)
SELECT u.id, ta.id, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  CASE WHEN ta.tipo = 'vacaciones' THEN 30.00 WHEN ta.tipo = 'permiso_personal' THEN 12.00 WHEN ta.tipo = 'permiso_medico' THEN 10.00 ELSE 0.00 END, 'activo'
FROM usuarios u CROSS JOIN tipos_ausencia_config ta
WHERE u.activo = true AND ta.activo = true AND ta.tipo IN ('vacaciones', 'permiso_personal', 'permiso_medico');

SELECT 'Departamentos' AS tabla, COUNT(*)::TEXT AS registros FROM departamentos
UNION ALL SELECT 'Usuarios', COUNT(*)::TEXT FROM usuarios
UNION ALL SELECT 'Tipos Ausencia', COUNT(*)::TEXT FROM tipos_ausencia_config
UNION ALL SELECT 'Configuración', COUNT(*)::TEXT FROM configuracion_sistema
UNION ALL SELECT 'Balances', COUNT(*)::TEXT FROM balances_ausencias;

SELECT u.nombre || ' ' || u.apellido AS nombre_completo, u.email, d.nombre AS departamento, u.cargo
FROM usuarios u JOIN departamentos d ON d.id = u.departamento_id ORDER BY u.id;
