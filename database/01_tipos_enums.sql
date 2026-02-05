-- =====================================================
-- 01_tipos_enums.sql
-- Tipos ENUM personalizados
-- PostgreSQL Local - Ejecutar PRIMERO
-- =====================================================

CREATE TYPE estado_solicitud AS ENUM (
  'borrador',
  'pendiente',
  'aprobada_jefe',
  'aprobada',
  'rechazada',
  'cancelada',
  'en_uso'
);

CREATE TYPE tipo_ausencia AS ENUM (
  'vacaciones',
  'permiso_personal',
  'permiso_medico',
  'permiso_maternidad',
  'permiso_paternidad',
  'permiso_estudio',
  'permiso_duelo',
  'permiso_otro'
);

CREATE TYPE unidad_tiempo AS ENUM (
  'dias',
  'horas'
);

CREATE TYPE estado_balance AS ENUM (
  'activo',
  'vencido',
  'suspendido'
);

SELECT typname FROM pg_type WHERE typname IN ('estado_solicitud', 'tipo_ausencia', 'unidad_tiempo', 'estado_balance');
