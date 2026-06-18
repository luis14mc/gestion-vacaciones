CREATE TABLE IF NOT EXISTS "registros_auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"accion" varchar(50) NOT NULL,
	"tabla_afectada" varchar(50) NOT NULL,
	"registro_id" bigint,
	"detalles" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario" ON "registros_auditoria" USING btree ("usuario_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auditoria_accion" ON "registros_auditoria" USING btree ("accion");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auditoria_tabla" ON "registros_auditoria" USING btree ("tabla_afectada");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auditoria_fecha" ON "registros_auditoria" USING btree ("created_at");
