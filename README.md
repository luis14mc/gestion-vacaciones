# Sistema de Gestión de Vacaciones y Permisos — CNI

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

Plataforma web para la gestión de solicitudes de vacaciones, permisos y licencias del **Consejo Nacional de Inversiones (CNI)**, Honduras. Centraliza el flujo de aprobación entre empleados, jefes de departamento y Recursos Humanos, con control automático de saldos y trazabilidad completa.

**Versión:** 0.1.0 · **Estado:** [Listo para piloto departamental (Fase 1)](./docs/ESTADO_PRODUCCION.md)

---

## Características

- **Solicitudes digitales** — vacaciones, permisos, licencias, cumpleaños; feriados HN excluidos del conteo
- **Vista Mi Balance** — días vencidos, proporcionales y disponibles por colaborador
- **Aprobación en dos niveles** — Jefe/Director → RRHH, con reglas CNI (alcance por departamento, VoBo de director, sin auto-aprobación)
- **Saldos automáticos** — reserva al enviar, confirmación al aprobar, liberación al rechazar/cancelar
- **RBAC** — roles Admin, RRHH, Jefe, Empleado con permisos granulares
- **Asignación de días** — individual por antigüedad (tabla Honduras) y masiva por departamento
- **Reportes y exportación** — PDF, CSV, Excel; dashboard por rol
- **Auditoría** — registro de acciones con IP y user-agent
- **Despliegue Docker** — optimizado para AWS EC2 (t3.medium) con Nginx y respaldos S3

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend | API Routes, capa de servicios, state machine de dominio |
| Auth | NextAuth.js v5 (JWT + Credentials) |
| Base de datos | PostgreSQL 16, Drizzle ORM |
| Validación | Zod 4, React Hook Form |
| Exportación | ExcelJS, jsPDF |
| Email | Nodemailer (SMTP configurable) |
| Tests | Vitest (unit + integración) |

---

## Inicio rápido

### Requisitos

- Node.js 20+ (22 recomendado en producción)
- PostgreSQL 16+
- [pnpm](https://pnpm.io/)

### Instalación

```bash
git clone <repo-url>
cd gestion-vacaciones
pnpm install

# Configurar entorno
cp .env.example .env.local
# Editar DATABASE_URL y AUTH_SECRET (no subir .env.local a Git)

# Tests de integración (opcional): cp .env.test.example .env.test
# Neon u otra BD local — ver docs/ARCHIVOS_NO_VERSIONADOS.md

# Base de datos
pnpm db:push
pnpm db:seed
pnpm db:create-admin

# Desarrollo
pnpm dev
```

La aplicación estará en `http://localhost:3000`.

---

## Scripts principales

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción (standalone) |
| `pnpm start` | Servidor de producción |
| `pnpm test:run` | Tests unitarios |
| `pnpm test:integration:run` | Tests con PostgreSQL real |
| `pnpm test:all` | Todos los tests |
| `pnpm db:push` | Aplicar esquema Drizzle |
| `pnpm db:seed` | Datos base (roles, departamentos, config) |
| `pnpm db:create-admin` | Crear administrador |
| `pnpm db:setup` | Inicialización completa (producción) |
| `pnpm lint` | ESLint |

---

## Despliegue en producción

El despliegue principal es **Docker en AWS EC2**:

```bash
cp .env.production.example .env.production
# Completar secrets y contraseñas

sudo ./scripts/setup-ec2.sh   # Primera vez
./scripts/deploy-ec2.sh       # Actualizaciones
```

Ver [Manual Técnico — Despliegue](./MANUAL_TECNICO.md#12-guía-de-despliegue-aws-ec2) y [Estado de Producción](./docs/ESTADO_PRODUCCION.md).

---

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [docs/README.md](./docs/README.md) | Índice de documentación |
| [MANUAL_TECNICO.md](./MANUAL_TECNICO.md) | Arquitectura, API, BD, seguridad |
| [docs/MANUAL_USUARIO.md](./docs/MANUAL_USUARIO.md) | Guía por rol (empleado, jefe, RRHH, admin) |
| [docs/ESTADO_PRODUCCION.md](./docs/ESTADO_PRODUCCION.md) | Evaluación de preparación para producción |
| [AUDITORIA.md](./AUDITORIA.md) | Auditoría de seguridad y funcionalidad |
| [docs/ARCHIVOS_NO_VERSIONADOS.md](./docs/ARCHIVOS_NO_VERSIONADOS.md) | Qué archivos no van a Git (Neon, `.env.local`, etc.) |
| [.env.example](./.env.example) | Variables de entorno (desarrollo) |
| [.env.production.example](./.env.production.example) | Variables de entorno (producción) |

---

## Estructura del proyecto

```
src/
├── app/           # Páginas y API Routes
├── components/    # UI React
├── services/      # Lógica de negocio
├── lib/           # DB, auth, dominio, validaciones
├── hooks/         # Hooks de cliente
├── auth.ts        # NextAuth
└── middleware.ts  # Protección de rutas

drizzle/           # Migraciones SQL
scripts/           # Seed, deploy, backup
tests/             # Vitest unit + integración
docs/              # Manuales y estado de producción
```

---

## Licencia

Proyecto desarrollado como propiedad intelectual del **Consejo Nacional de Inversiones (CNI) — Honduras, 2026**.
