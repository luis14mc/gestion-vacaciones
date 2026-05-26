CREATE TYPE "public"."duracion_permiso" AS ENUM('1-2h', '2-4h', 'dia_completo');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud" AS ENUM('borrador', 'pendiente_jefe', 'aprobada_jefe', 'rechazada_jefe', 'pendiente_rrhh', 'aprobada_rrhh', 'rechazada_rrhh', 'pendiente_ejecutiva', 'aprobada_ejecutiva', 'rechazada_ejecutiva', 'cancelada', 'finalizada');--> statement-breakpoint
CREATE TYPE "public"."tipo_solicitud" AS ENUM('vacaciones', 'permiso_salida', 'licencia_medica', 'permiso_personal', 'licencia_paternidad', 'compensacion');--> statement-breakpoint
CREATE TYPE "public"."tipo_ausencia" AS ENUM('vacaciones', 'licencia_medica', 'permiso_personal', 'dia_libre', 'licencia_paternidad', 'licencia_maternidad', 'compensacion');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('credito_inicial', 'credito_mensual', 'credito_manual', 'debito_solicitud', 'debito_ajuste', 'credito_devolucion', 'expiracion');--> statement-breakpoint
CREATE TABLE "permisos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(100) NOT NULL,
	"modulo" varchar(50) NOT NULL,
	"recurso" varchar(50) NOT NULL,
	"accion" varchar(50) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_permisos_codigo" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"nivel" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"es_rol_sistema" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_roles_codigo" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "roles_permisos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rol_id" bigint NOT NULL,
	"permiso_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_rol_permiso" UNIQUE("rol_id","permiso_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"usuario_id" bigint NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_session_token" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"departamento_id" bigint,
	"cargo" varchar(100),
	"es_jefe" boolean DEFAULT false NOT NULL,
	"es_rrhh" boolean DEFAULT false NOT NULL,
	"es_admin" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"fecha_ingreso" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_usuarios_email" UNIQUE("email","deleted_at")
);
--> statement-breakpoint
CREATE TABLE "usuarios_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"rol_id" bigint NOT NULL,
	"fecha_asignacion" timestamp with time zone DEFAULT now() NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "uq_usuario_rol" UNIQUE("usuario_id","rol_id")
);
--> statement-breakpoint
CREATE TABLE "departamentos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"descripcion" text,
	"jefe_id" bigint,
	"departamento_padre_id" bigint,
	"nivel" integer DEFAULT 1 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_departamentos_codigo" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "usuarios_departamentos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"departamento_id" bigint NOT NULL,
	"fecha_asignacion" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_baja" timestamp with time zone,
	"es_asignacion_actual" boolean DEFAULT true NOT NULL,
	"cargo" varchar(100),
	"motivo" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anos_laborales" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ano" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"cerrado" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_anos_laborales_ano" UNIQUE("ano"),
	CONSTRAINT "chk_anos_laborales_fecha_fin" CHECK ("anos_laborales"."fecha_fin" > "anos_laborales"."fecha_inicio")
);
--> statement-breakpoint
CREATE TABLE "solicitudes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"usuario_id" bigint NOT NULL,
	"ano_laboral_id" bigint NOT NULL,
	"tipo" "tipo_solicitud" NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"dias_solicitados" numeric(10, 2),
	"duracion_permiso" "duracion_permiso",
	"hora_salida" time,
	"hora_regreso" time,
	"motivo" text,
	"comentario_empleado" text,
	"documentos_adjuntos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado" "estado_solicitud" DEFAULT 'borrador' NOT NULL,
	"estado_anterior" "estado_solicitud",
	"aprobada_jefe_por" bigint,
	"aprobada_jefe_fecha" timestamp with time zone,
	"comentario_jefe" text,
	"aprobada_rrhh_por" bigint,
	"aprobada_rrhh_fecha" timestamp with time zone,
	"comentario_rrhh" text,
	"autorizada_ejecutiva_por" bigint,
	"autorizada_ejecutiva_fecha" timestamp with time zone,
	"comentario_ejecutiva" text,
	"rechazada_por" bigint,
	"rechazada_fecha" timestamp with time zone,
	"motivo_rechazo" text,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uq_solicitudes_codigo" UNIQUE("codigo"),
	CONSTRAINT "chk_solicitudes_vacaciones_fechas" CHECK (("solicitudes"."tipo" != 'vacaciones') OR ("solicitudes"."fecha_inicio" IS NOT NULL AND "solicitudes"."fecha_fin" IS NOT NULL)),
	CONSTRAINT "chk_solicitudes_permiso_horas" CHECK (("solicitudes"."tipo" != 'permiso_salida') OR ("solicitudes"."hora_salida" IS NOT NULL AND "solicitudes"."hora_regreso" IS NOT NULL)),
	CONSTRAINT "chk_solicitudes_fecha_fin" CHECK ("solicitudes"."fecha_fin" IS NULL OR "solicitudes"."fecha_fin" >= "solicitudes"."fecha_inicio")
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"ano_laboral_id" bigint NOT NULL,
	"tipo_ausencia" "tipo_ausencia" NOT NULL,
	"cantidad_inicial" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cantidad_acumulada" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cantidad_usada" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cantidad_pendiente" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cantidad_disponible" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"fecha_expiracion" date,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"motivo_bloqueo" text,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_balances_usuario_ano_tipo" UNIQUE("usuario_id","ano_laboral_id","tipo_ausencia"),
	CONSTRAINT "chk_balances_inicial" CHECK ("balances"."cantidad_inicial" >= 0),
	CONSTRAINT "chk_balances_usada" CHECK ("balances"."cantidad_usada" >= 0),
	CONSTRAINT "chk_balances_pendiente" CHECK ("balances"."cantidad_pendiente" >= 0),
	CONSTRAINT "chk_balances_disponible" CHECK ("balances"."cantidad_disponible" >= 0)
);
--> statement-breakpoint
CREATE TABLE "historial_balances" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"balance_id" bigint NOT NULL,
	"usuario_id" bigint NOT NULL,
	"tipo_movimiento" "tipo_movimiento" NOT NULL,
	"cantidad" numeric(10, 2) NOT NULL,
	"cantidad_anterior" numeric(10, 2) NOT NULL,
	"cantidad_nueva" numeric(10, 2) NOT NULL,
	"solicitud_id" bigint,
	"referencia" varchar(255),
	"motivo" text,
	"descripcion" text,
	"realizado_por" bigint,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_permisos_id_fk" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_roles" ADD CONSTRAINT "usuarios_roles_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_departamentos" ADD CONSTRAINT "usuarios_departamentos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_departamentos" ADD CONSTRAINT "usuarios_departamentos_departamento_id_departamentos_id_fk" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_ano_laboral_id_anos_laborales_id_fk" FOREIGN KEY ("ano_laboral_id") REFERENCES "public"."anos_laborales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_aprobada_jefe_por_usuarios_id_fk" FOREIGN KEY ("aprobada_jefe_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_aprobada_rrhh_por_usuarios_id_fk" FOREIGN KEY ("aprobada_rrhh_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_autorizada_ejecutiva_por_usuarios_id_fk" FOREIGN KEY ("autorizada_ejecutiva_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_rechazada_por_usuarios_id_fk" FOREIGN KEY ("rechazada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_ano_laboral_id_anos_laborales_id_fk" FOREIGN KEY ("ano_laboral_id") REFERENCES "public"."anos_laborales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_balances" ADD CONSTRAINT "historial_balances_balance_id_balances_id_fk" FOREIGN KEY ("balance_id") REFERENCES "public"."balances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_balances" ADD CONSTRAINT "historial_balances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_balances" ADD CONSTRAINT "historial_balances_realizado_por_usuarios_id_fk" FOREIGN KEY ("realizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_permisos_codigo" ON "permisos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_permisos_modulo" ON "permisos" USING btree ("modulo","recurso");--> statement-breakpoint
CREATE INDEX "idx_roles_codigo" ON "roles" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_roles_nivel" ON "roles" USING btree ("nivel","activo");--> statement-breakpoint
CREATE INDEX "idx_roles_permisos_rol" ON "roles_permisos" USING btree ("rol_id");--> statement-breakpoint
CREATE INDEX "idx_roles_permisos_permiso" ON "roles_permisos" USING btree ("permiso_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_sessions_usuario" ON "sessions" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "idx_usuarios_email" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_usuarios_activo" ON "usuarios" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_usuarios_departamento" ON "usuarios" USING btree ("departamento_id");--> statement-breakpoint
CREATE INDEX "idx_usuarios_jefe" ON "usuarios" USING btree ("es_jefe","activo");--> statement-breakpoint
CREATE INDEX "idx_usuarios_rrhh" ON "usuarios" USING btree ("es_rrhh","activo");--> statement-breakpoint
CREATE INDEX "idx_usuarios_roles_usuario" ON "usuarios_roles" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_usuarios_roles_rol" ON "usuarios_roles" USING btree ("rol_id");--> statement-breakpoint
CREATE INDEX "idx_departamentos_codigo" ON "departamentos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_departamentos_jefe" ON "departamentos" USING btree ("jefe_id");--> statement-breakpoint
CREATE INDEX "idx_departamentos_padre" ON "departamentos" USING btree ("departamento_padre_id");--> statement-breakpoint
CREATE INDEX "idx_departamentos_activo" ON "departamentos" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_departamentos_nivel" ON "departamentos" USING btree ("nivel");--> statement-breakpoint
CREATE INDEX "idx_usuarios_departamentos_usuario" ON "usuarios_departamentos" USING btree ("usuario_id","es_asignacion_actual");--> statement-breakpoint
CREATE INDEX "idx_usuarios_departamentos_departamento" ON "usuarios_departamentos" USING btree ("departamento_id","es_asignacion_actual");--> statement-breakpoint
CREATE INDEX "idx_usuarios_departamentos_actual" ON "usuarios_departamentos" USING btree ("usuario_id","departamento_id","es_asignacion_actual");--> statement-breakpoint
CREATE INDEX "idx_anos_laborales_ano" ON "anos_laborales" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "idx_anos_laborales_activo" ON "anos_laborales" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_codigo" ON "solicitudes" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_usuario" ON "solicitudes" USING btree ("usuario_id","estado");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_estado" ON "solicitudes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_tipo" ON "solicitudes" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_ano" ON "solicitudes" USING btree ("ano_laboral_id");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_fechas" ON "solicitudes" USING btree ("fecha_inicio","fecha_fin");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_horas" ON "solicitudes" USING btree ("hora_salida","hora_regreso");--> statement-breakpoint
CREATE INDEX "idx_solicitudes_version" ON "solicitudes" USING btree ("id","version");--> statement-breakpoint
CREATE INDEX "idx_balances_usuario" ON "balances" USING btree ("usuario_id","ano_laboral_id");--> statement-breakpoint
CREATE INDEX "idx_balances_ano" ON "balances" USING btree ("ano_laboral_id");--> statement-breakpoint
CREATE INDEX "idx_balances_tipo" ON "balances" USING btree ("tipo_ausencia");--> statement-breakpoint
CREATE INDEX "idx_balances_disponible" ON "balances" USING btree ("usuario_id","cantidad_disponible","bloqueado");--> statement-breakpoint
CREATE INDEX "idx_balances_expiracion" ON "balances" USING btree ("fecha_expiracion");--> statement-breakpoint
CREATE INDEX "idx_balances_version" ON "balances" USING btree ("id","version");--> statement-breakpoint
CREATE INDEX "idx_historial_balances_balance" ON "historial_balances" USING btree ("balance_id");--> statement-breakpoint
CREATE INDEX "idx_historial_balances_usuario" ON "historial_balances" USING btree ("usuario_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_historial_balances_solicitud" ON "historial_balances" USING btree ("solicitud_id");--> statement-breakpoint
CREATE INDEX "idx_historial_balances_tipo" ON "historial_balances" USING btree ("tipo_movimiento","created_at");--> statement-breakpoint
CREATE INDEX "idx_historial_balances_fecha" ON "historial_balances" USING btree ("created_at");