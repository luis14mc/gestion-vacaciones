-- Fase 2 — Secretario General como aprobador sustituto.
-- 1) usuarios.es_secretario_general: flag institucional (max 1 activo).
-- 2) solicitudes: nuevos estados para el flujo Director → SG → RRHH,
--    y columnas de aprobación equivalentes a las del jefe/RRHH.

ALTER TABLE "usuarios" ADD COLUMN "es_secretario_general" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_usuarios_secretario_general" ON "usuarios" USING btree ("es_secretario_general","activo");

-- Extender el enum estado_solicitud con los nuevos valores del flujo.
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'pendiente_director';--> statement-breakpoint
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'aprobada_director';--> statement-breakpoint
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'rechazada_director';--> statement-breakpoint
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'pendiente_secretario_general';--> statement-breakpoint
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'aprobada_secretario_general';--> statement-breakpoint
ALTER TYPE "estado_solicitud" ADD VALUE IF NOT EXISTS 'rechazada_secretario_general';

-- Columnas para registrar aprobación/rechazo por Director o Secretario General.
ALTER TABLE "solicitudes" ADD COLUMN "aprobada_director_por" bigint REFERENCES usuarios(id);--> statement-breakpoint
ALTER TABLE "solicitudes" ADD COLUMN "aprobada_director_fecha" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD COLUMN "comentario_director" text;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD COLUMN "aprobada_secretario_por" bigint REFERENCES usuarios(id);--> statement-breakpoint
ALTER TABLE "solicitudes" ADD COLUMN "aprobada_secretario_fecha" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD COLUMN "comentario_secretario" text;

CREATE INDEX "idx_solicitudes_aprobada_director_por" ON "solicitudes" USING btree ("aprobada_director_por");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_aprobada_secretario_por" ON "solicitudes" USING btree ("aprobada_secretario_por");