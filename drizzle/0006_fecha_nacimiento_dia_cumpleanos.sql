-- Fecha de nacimiento del colaborador y tipo de solicitud día libre por cumpleaños
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

ALTER TYPE tipo_solicitud ADD VALUE IF NOT EXISTS 'dia_cumpleanos';
