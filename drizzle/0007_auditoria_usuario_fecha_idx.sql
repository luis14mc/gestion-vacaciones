CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario_fecha" ON "registros_auditoria" ("usuario_id", "created_at");
