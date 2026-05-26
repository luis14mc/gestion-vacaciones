ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "numero_empleado" varchar(50);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "telefono" varchar(50);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "direccion" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usuarios_numero_empleado" ON "usuarios" USING btree ("numero_empleado");
