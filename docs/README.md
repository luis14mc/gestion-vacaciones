# Documentación — Sistema de Gestión de Vacaciones CNI

Índice central de la documentación del proyecto **vacaciones-cni** (Consejo Nacional de Inversiones, Honduras).

**Última actualización:** Junio 2026 · **Versión del sistema:** 0.1.0

**Versión del sistema:** 0.1.0

Novedades documentadas: Mi Balance, día libre por cumpleaños, feriados Honduras, código `CNI-SOL`, estado de producción actualizado.

---

## Documentos principales

| Documento | Audiencia | Contenido |
|-----------|-----------|-----------|
| [README.md](../README.md) | Todos | Visión general, instalación rápida, scripts y enlaces |
| [MANUAL_TECNICO.md](../MANUAL_TECNICO.md) | Desarrolladores / TI | Arquitectura, API, base de datos, despliegue, seguridad |
| [MANUAL_USUARIO.md](./MANUAL_USUARIO.md) | Empleados, jefes, RRHH, admin | Guía de uso por rol y flujos operativos |
| [ESTADO_PRODUCCION.md](./ESTADO_PRODUCCION.md) | Dirección / TI | Evaluación de preparación para producción |
| [AUDITORIA.md](../AUDITORIA.md) | TI / seguridad | Hallazgos corregidos y pendientes |
| [ARCHIVOS_NO_VERSIONADOS.md](./ARCHIVOS_NO_VERSIONADOS.md) | Desarrolladores | Qué no subir a Git (Neon, `.env.local`, secretos) |
| [validaciones.md](../validaciones.md) | TI | Estado de auditoría y pendientes |

---

## Configuración y despliegue

| Recurso | Descripción |
|---------|-------------|
| [.env.example](../.env.example) | Plantilla para desarrollo local |
| [.env.test.example](../.env.test.example) | Plantilla tests integración (copiar a `.env.test`, no versionar) |
| [.env.production.example](../.env.production.example) | Plantilla para EC2 / Docker en producción |
| [docker-compose.yml](../docker-compose.yml) | Orquestación PostgreSQL + app + Nginx |
| [scripts/setup-ec2.sh](../scripts/setup-ec2.sh) | Configuración inicial del servidor |
| [scripts/deploy-ec2.sh](../scripts/deploy-ec2.sh) | Despliegue y actualización en EC2 |
| [scripts/backup-s3.sh](../scripts/backup-s3.sh) | Respaldo de base de datos a S3 |

---

## Pruebas de API

| Recurso | Descripción |
|---------|-------------|
| [postman/](../postman/) | Colección Postman para endpoints RBAC |
| [thunder-tests/](../thunder-tests/) | Exportaciones Thunder Client |

---

## Scripts npm / pnpm útiles

```bash
pnpm dev                    # Servidor de desarrollo (puerto 3000)
pnpm build && pnpm start      # Build y servidor de producción
pnpm test:run               # Tests unitarios
pnpm test:integration:run   # Tests de integración (requiere PostgreSQL)
pnpm test:all               # Todos los tests
pnpm db:push                # Aplicar esquema Drizzle
pnpm db:seed                # Datos base (roles, departamentos, config)
pnpm db:create-admin        # Crear usuario administrador
pnpm db:setup               # Inicialización completa para producción
pnpm lint                   # ESLint
```

---

## Estructura del código

```
src/
├── app/           # Páginas y API Routes (Next.js App Router)
├── components/    # UI React (shadcn/ui, formularios, layout)
├── services/      # Lógica de negocio (solicitudes, workflow, email…)
├── lib/           # DB, auth, dominio, validaciones Zod
├── hooks/         # Hooks de cliente
├── auth.ts        # Configuración NextAuth
└── middleware.ts  # Protección de rutas
```

Para detalle completo, ver [MANUAL_TECNICO.md](../MANUAL_TECNICO.md).
