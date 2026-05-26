CREATE TABLE "configuracion" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"clave" varchar(255) NOT NULL,
	"valor" text DEFAULT '' NOT NULL,
	"descripcion" text,
	"categoria" varchar(100) DEFAULT 'general' NOT NULL,
	"tipo_dato" varchar(50) DEFAULT 'string' NOT NULL,
	"es_publico" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_configuracion_clave" UNIQUE("clave")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "es_director" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "jefe_superior_id" bigint;--> statement-breakpoint
CREATE INDEX "idx_configuracion_categoria" ON "configuracion" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "idx_usuarios_director" ON "usuarios" USING btree ("es_director","activo");--> statement-breakpoint
CREATE INDEX "idx_usuarios_jefe_superior" ON "usuarios" USING btree ("jefe_superior_id");