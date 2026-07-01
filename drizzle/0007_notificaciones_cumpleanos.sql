CREATE TABLE IF NOT EXISTS "notificaciones_cumpleanos_mensuales" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "usuario_id" bigint NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "anio" integer NOT NULL,
  "mes" integer NOT NULL,
  "enviada_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_notificacion_cumpleanos_usuario_periodo" UNIQUE("usuario_id", "anio", "mes")
);

CREATE INDEX IF NOT EXISTS "idx_notificaciones_cumpleanos_periodo"
  ON "notificaciones_cumpleanos_mensuales" ("anio", "mes");
