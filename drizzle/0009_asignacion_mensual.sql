-- Fase 5 — Asignación mensual automática de vacaciones.
-- Tabla historial_asignaciones_mensuales: una fila por (usuario, anio, mes).
-- Restricción UNIQUE para evitar doble asignación del mismo período.
-- Tabla notificaciones: sistema in-app para avisos al empleado
-- (no email). Usada por la asignación mensual y otros eventos.

CREATE TABLE "historial_asignaciones_mensuales" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"dias_asignados" numeric(6, 4) NOT NULL,
	"balance_anterior" numeric(8, 4) NOT NULL,
	"balance_nuevo" numeric(8, 4) NOT NULL,
	"dias_anuales_aplicados" numeric(6, 2) NOT NULL,
	"anios_antiguedad" integer NOT NULL,
	"origen_asignacion" varchar(20) DEFAULT 'automatico' NOT NULL,
	"ejecutado_por" bigint,
	"ejecutado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"observacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_hist_asig_mensual_usuario_anio_mes" UNIQUE("usuario_id","anio","mes"),
	CONSTRAINT "chk_hist_asig_mensual_mes" CHECK ("mes" BETWEEN 1 AND 12),
	CONSTRAINT "chk_hist_asig_mensual_anio" CHECK ("anio" BETWEEN 2000 AND 2100),
	CONSTRAINT "chk_hist_asig_mensual_dias_no_neg" CHECK ("dias_asignados" >= 0)
);
--> statement-breakpoint
ALTER TABLE "historial_asignaciones_mensuales" ADD CONSTRAINT "historial_asignaciones_mensuales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "historial_asignaciones_mensuales" ADD CONSTRAINT "historial_asignaciones_mensuales_ejecutado_por_fkey" FOREIGN KEY ("ejecutado_por") REFERENCES "usuarios"("id") ON DELETE set null;--> statement-breakpoint
CREATE INDEX "idx_hist_asig_mensual_usuario_anio" ON "historial_asignaciones_mensuales" USING btree ("usuario_id","anio" DESC);--> statement-breakpoint
CREATE INDEX "idx_hist_asig_mensual_anio_mes" ON "historial_asignaciones_mensuales" USING btree ("anio","mes");--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"tipo" varchar(50) DEFAULT 'sistema' NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"mensaje" text NOT NULL,
	"referencia" varchar(200),
	"leida" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "idx_notificaciones_usuario_leida" ON "notificaciones" USING btree ("usuario_id","leida");--> statement-breakpoint
CREATE INDEX "idx_notificaciones_usuario_created" ON "notificaciones" USING btree ("usuario_id","created_at");