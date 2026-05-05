# Sistema de Gestion de Vacaciones y Permisos - CNI

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.44-green)](https://orm.drizzle.team/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

Sistema web para la gestion de solicitudes de vacaciones, permisos y licencias laborales del Consejo Nacional de Inversiones (CNI), Honduras.

---

## Stack Tecnologico

| Categoria | Tecnologia | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16.0.3 |
| Lenguaje | TypeScript | 5.9.3 |
| Base de Datos | PostgreSQL | 16+ |
| ORM | Drizzle ORM | 0.44.7 |
| DB Client | postgres (pg-native) | 3.4.8 |
| Autenticacion | NextAuth.js v5 (beta) | 5.0.0-beta.30 |
| UI | TailwindCSS + Radix UI | 4.1.17 |
| Formularios | React Hook Form + Zod | 7.71 / 4.3 |
| Data Fetching | TanStack React Query | 5.90 |
| Reportes | ExcelJS + jsPDF | 4.4 / 4.0 |
| Alertas | SweetAlert2 | 11.26 |
| Iconos | Lucide React | 0.554 |
| Testing | Vitest + Testing Library | 4.0 |
| Package Manager | pnpm | Latest |

---

## Estructura del Proyecto

```
gestion-vacaciones/
├── scripts/
│   ├── install-database.mjs          # Instalacion automatica de BD
│   └── seed-database.ts              # Seed: roles, permisos, usuarios, balances
│
├── src/
│   ├── auth.ts                       # Configuracion NextAuth (JWT, callbacks)
│   ├── middleware.ts                  # Proteccion de rutas (auth check)
│   │
│   ├── lib/
│   │   ├── auth.ts                   # getSession(), tienePermiso(), helpers RBAC
│   │   ├── utils.ts                  # cn() y utilidades generales
│   │   ├── swal.ts                   # Configuracion SweetAlert2
│   │   ├── pdfExport.ts              # Generacion de reportes PDF
│   │   ├── db/
│   │   │   ├── index.ts              # Cliente Drizzle + conexion PostgreSQL
│   │   │   └── schema/
│   │   │       ├── index.ts          # Barrel export de schemas
│   │   │       ├── auth.ts           # usuarios, roles, permisos, usuarios_roles
│   │   │       ├── organizacion.ts   # departamentos, configuracion, auditoria
│   │   │       ├── solicitudes.ts    # solicitudes, enums de estado/tipo
│   │   │       └── balances.ts       # balances, anos_laborales, movimientos
│   │   ├── domain/
│   │   │   └── state-machine.ts      # Maquina de estados del workflow
│   │   ├── schemas/                  # Schemas Zod de validacion
│   │   └── validations/             # Validaciones de formularios
│   │
│   ├── services/
│   │   ├── index.ts                  # Barrel export
│   │   ├── solicitudes.service.ts    # CRUD solicitudes, rechazo, cancelacion
│   │   ├── usuarios.service.ts       # CRUD usuarios, asignacion de roles
│   │   ├── workflow.service.ts       # Transiciones de estado, balance de dias
│   │   ├── rbac.service.ts           # Roles, permisos, verificaciones RBAC
│   │   └── excel.service.ts          # Exportacion de reportes Excel
│   │
│   ├── types/
│   │   └── index.ts                  # Interfaces TypeScript del sistema
│   │
│   ├── providers/                    # Context providers (SessionProvider)
│   ├── hooks/                        # Custom hooks
│   │
│   ├── components/
│   │   ├── AuthProvider.tsx          # Provider de sesion NextAuth
│   │   ├── FormularioSolicitud.tsx   # Formulario principal de solicitudes
│   │   ├── layout/
│   │   │   └── AppShell.tsx          # Layout con sidebar y navegacion
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx        # Tarjeta de metrica
│   │   │   ├── CalendarView.tsx      # Vista de calendario
│   │   │   ├── ActivityFeed.tsx      # Feed de actividad reciente
│   │   │   └── QuickActions.tsx      # Acciones rapidas
│   │   ├── solicitudes/
│   │   │   ├── BalanceViewer.tsx     # Visualizador de balance de dias
│   │   │   ├── VacacionesSection.tsx # Seccion vacaciones del formulario
│   │   │   └── PermisoHorasSection.tsx # Seccion permisos de horas
│   │   └── ui/                       # Componentes UI base (Radix/shadcn)
│   │
│   └── app/
│       ├── layout.tsx                # Root layout
│       ├── page.tsx                  # Pagina raiz (redirect)
│       ├── globals.css               # Estilos globales (Tailwind)
│       ├── login/page.tsx            # Login
│       ├── dashboard/page.tsx        # Dashboard principal
│       ├── solicitudes/
│       │   ├── page.tsx              # Lista de solicitudes
│       │   └── nueva/page.tsx        # Nueva solicitud
│       ├── aprobar-solicitudes/page.tsx  # Aprobacion (Jefe/RRHH)
│       ├── usuarios/page.tsx         # Gestion de usuarios
│       ├── mi-perfil/page.tsx        # Perfil personal
│       ├── mi-equipo/page.tsx        # Equipo del jefe
│       ├── asignacion-dias/page.tsx  # Asignacion masiva de dias
│       ├── reportes/page.tsx         # Reportes generales
│       ├── reportes-departamento/page.tsx # Reportes por departamento
│       ├── exportar/page.tsx         # Exportar datos
│       ├── configuracion/page.tsx    # Configuracion del sistema
│       ├── auditoria/page.tsx        # Log de auditoria
│       └── api/                      # 26 API routes (ver seccion API)
│
├── tests/
│   ├── setup.ts                      # Setup Vitest
│   ├── helpers/test-data.ts          # Helpers de datos de prueba
│   ├── unit/
│   │   ├── example.test.ts
│   │   ├── state-machine.test.ts     # Tests de la maquina de estados
│   │   └── services/                 # Tests unitarios de servicios
│   └── integration/                  # Tests de integracion
│
├── drizzle.config.ts                 # Configuracion Drizzle Kit
├── vitest.config.ts                  # Configuracion Vitest
├── package.json
├── tsconfig.json
└── .env.local                        # Variables de entorno (no versionado)
```

---

## Autenticacion y Autorizacion (RBAC)

### Arquitectura

El sistema usa **NextAuth.js v5** con **Credentials Provider** y un modelo RBAC propio:

```
NextAuth (JWT) → getSession() → SessionUser { id, roles[], permisos[], esAdmin, esRrhh, esJefe }
```

- `src/auth.ts` configura NextAuth (JWT callbacks, session callbacks)
- `src/lib/auth.ts` provee `getSession()` que enriquece la sesion leyendo flags actualizados desde la BD
- `src/middleware.ts` protege todas las rutas verificando sesion activa
- Cada API route verifica permisos con `tienePermiso(session, 'permiso.codigo')`

### Roles y Permisos

| Rol | Codigo | Nivel | Descripcion |
|-----|--------|-------|-------------|
| Administrador | `ADMIN` | 10 | Acceso total. Bypass de permisos. |
| Recursos Humanos | `RRHH` | 8 | Gestion de solicitudes, reportes, balances |
| Jefe de Departamento | `JEFE` | 5 | Aprobacion nivel 1, vista de su departamento |
| Empleado | `EMPLEADO` | 1 | Solicitudes propias, balance propio |

**17 permisos** organizados por modulo:

- `sistema.*` - Acceso basico y dashboard
- `usuarios.*` - CRUD de usuarios
- `departamentos.*` - Ver/crear departamentos
- `solicitudes.*` - Crear, ver, aprobar (jefe/rrhh/ejecutiva)
- `balances.*` - Ver/ajustar balances
- `reportes.*` - Reportes por departamento

### Uso en API Routes

```typescript
import { getSession, tienePermiso } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  if (!tienePermiso(session, 'solicitudes.ver_todas')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 });
  }

  // ... logica
}
```

---

## Base de Datos

### Schema (Drizzle ORM)

**4 archivos de schema** en `src/lib/db/schema/`:

| Archivo | Tablas | Contenido |
|---------|--------|-----------|
| `auth.ts` | `usuarios`, `roles`, `permisos`, `rolesPermisos`, `usuariosRoles` | Autenticacion y RBAC |
| `organizacion.ts` | `departamentos`, `usuariosDepartamentos`, `configuracion`, `auditoria` | Estructura organizacional |
| `solicitudes.ts` | `solicitudes` | Solicitudes de ausencia con workflow multi-nivel |
| `balances.ts` | `anosLaborales`, `balances`, `movimientosBalance` | Control de dias disponibles |

### Enums

```
tipo_solicitud: vacaciones, permiso_salida, licencia_medica, permiso_personal, licencia_paternidad, compensacion
tipo_ausencia:  vacaciones, licencia_medica, permiso_personal, dia_libre, licencia_paternidad, licencia_maternidad, compensacion
estado_solicitud: borrador → pendiente_jefe → aprobada_jefe → aprobada_rrhh → [aprobada_ejecutiva] → finalizada
                                            → rechazada_jefe / rechazada_rrhh / cancelada
```

### Relaciones Principales

```
usuarios ←→ usuariosRoles ←→ roles ←→ rolesPermisos ←→ permisos
usuarios → departamentos (departamentoId)
usuarios ←→ usuariosDepartamentos ←→ departamentos
solicitudes → usuarios (usuarioId, aprobadaJefePor, aprobadaRrhhPor, rechazadaPor)
solicitudes → anosLaborales (anoLaboralId)
balances → usuarios + anosLaborales (compuesto)
```

---

## Workflow de Solicitudes

### Maquina de Estados

Definida en `src/lib/domain/state-machine.ts`:

```
[borrador] --enviar--> [pendiente_jefe]
[pendiente_jefe] --aprobar_jefe--> [aprobada_jefe]
[pendiente_jefe] --rechazar_jefe--> [rechazada_jefe]
[aprobada_jefe] --aprobar_rrhh--> [aprobada_rrhh]
[aprobada_jefe] --rechazar_rrhh--> [rechazada_rrhh]
[aprobada_rrhh] --aprobar_ejecutiva--> [aprobada_ejecutiva]  (si dias > umbral)
[aprobada_rrhh|aprobada_ejecutiva] --finalizar--> [finalizada]  (automatico al vencer fecha)
[pendiente_jefe|aprobada_jefe] --cancelar--> [cancelada]
```

### Gestion de Balance de Dias

- `permiso_salida` no consume balance (es temporal, horas)
- Al aprobar: se descuenta de `cantidadDisponible`, se suma a `cantidadPendiente`
- Al finalizar: se mueve de `cantidadPendiente` a `cantidadUsada`
- Al rechazar/cancelar: se devuelve a `cantidadDisponible`
- Optimistic locking via campo `version` para prevenir conflictos de concurrencia

---

## API Endpoints (26 rutas)

### Autenticacion

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `*` | `/api/auth/[...nextauth]` | NextAuth handlers (login, logout, session) |

### Solicitudes

| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| `GET` | `/api/solicitudes` | Listar solicitudes (filtros) | `solicitudes.ver_propias` / `ver_todas` |
| `POST` | `/api/solicitudes` | Crear solicitud | `solicitudes.crear` |
| `PATCH` | `/api/solicitudes` | Actualizar solicitud | `solicitudes.crear` |
| `GET` | `/api/solicitudes/[id]/accion` | Acciones disponibles | Autenticado |
| `POST` | `/api/solicitudes/[id]/accion` | Ejecutar accion workflow | Segun accion |

### Usuarios

| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| `GET` | `/api/usuarios` | Listar usuarios | `usuarios.ver` |
| `POST` | `/api/usuarios` | Crear usuario | `usuarios.crear` |
| `PATCH` | `/api/usuarios` | Actualizar usuario (whitelist) | `usuarios.editar` |
| `DELETE` | `/api/usuarios` | Desactivar usuario (soft) | `usuarios.eliminar` |
| `GET` | `/api/usuarios/me` | Perfil propio | Autenticado |
| `PATCH` | `/api/usuarios/me` | Actualizar perfil (nombre, cargo) | Autenticado |
| `PATCH` | `/api/usuarios/me/password` | Cambiar contrasena | Autenticado |
| `*` | `/api/usuarios/roles` | Gestion de roles de usuario | `usuarios.editar` |

### Balances y Asignacion

| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| `GET` | `/api/balances` | Consultar balances | `balances.ver_propio` / `ver_todos` |
| `POST` | `/api/asignacion-masiva` | Asignar dias masivamente | ADMIN / RRHH |

### Dashboard

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/api/dashboard/mi-balance` | Balance del usuario actual |
| `GET` | `/api/dashboard/actividad` | Actividad reciente |
| `GET` | `/api/dashboard/calendario` | Calendario de ausencias |
| `GET` | `/api/dashboard/admin/metricas` | Metricas admin |
| `GET` | `/api/dashboard/rrhh/metricas` | Metricas RRHH |
| `GET` | `/api/dashboard/jefe/metricas` | Metricas jefe |

### Reportes

| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| `GET` | `/api/reportes` | Reporte general | `reportes.exportar` |
| `GET` | `/api/reportes/departamento` | Reporte por departamento | `reportes.departamento` |
| `GET` | `/api/reportes/exportar` | Exportar datos JSON | `reportes.exportar` |
| `GET` | `/api/reportes/exportar/excel` | Descargar Excel | ADMIN / RRHH |

### Otros

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/api/departamentos` | Listar departamentos |
| `GET` | `/api/tipos-ausencia` | Tipos de ausencia disponibles |
| `GET` | `/api/calendario/ausencias` | Ausencias aprobadas por mes |
| `GET/POST` | `/api/configuracion` | Configuracion del sistema (ADMIN) |
| `GET` | `/api/auditoria` | Log de auditoria |
| `POST` | `/api/cron/transiciones` | Finalizar solicitudes vencidas |

### Formato de Respuesta Estandar

Todas las APIs siguen el formato:

```json
// Exito
{ "success": true, "data": { ... }, "message": "..." }

// Error
{ "success": false, "error": "Descripcion del error" }
```

---

## Paginas del Frontend (15)

| Ruta | Pagina | Acceso |
|------|--------|--------|
| `/login` | Login | Publica |
| `/dashboard` | Dashboard principal | Todos los roles |
| `/solicitudes` | Mis solicitudes | Todos |
| `/solicitudes/nueva` | Crear solicitud | Todos |
| `/aprobar-solicitudes` | Aprobar/rechazar solicitudes | JEFE, RRHH, ADMIN |
| `/mi-perfil` | Perfil personal | Todos |
| `/mi-equipo` | Equipo del departamento | JEFE |
| `/usuarios` | Gestion de usuarios | ADMIN, RRHH |
| `/asignacion-dias` | Asignacion masiva de dias | ADMIN, RRHH |
| `/reportes` | Reportes generales | RRHH, ADMIN |
| `/reportes-departamento` | Reportes por departamento | JEFE, RRHH, ADMIN |
| `/exportar` | Exportar datos | ADMIN, RRHH |
| `/configuracion` | Configuracion del sistema | ADMIN |
| `/auditoria` | Log de auditoria | ADMIN |

---

## Instalacion

### Requisitos

- Node.js 18+
- PostgreSQL 16+
- pnpm

### Configuracion

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd gestion-vacaciones
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
```

### Variables de Entorno (.env.local)

```env
DATABASE_URL="postgresql://usuario:password@host:5432/vacaciones?sslmode=require"
NEXTAUTH_SECRET="un-secreto-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

### Base de Datos

```bash
# Opcion A: Push del schema directamente
pnpm db:push

# Opcion B: Instalacion automatica
pnpm db:install

# Seed de datos iniciales
pnpm db:seed
```

### Ejecutar

```bash
# Desarrollo
pnpm dev

# Build de produccion
pnpm build
pnpm start
```

---

## Usuarios de Prueba (Seed)

| Email | Password | Rol | Departamento |
|-------|----------|-----|--------------|
| admin@cni.cl | Test123! | ADMIN | - |
| rrhh@cni.cl | Test123! | RRHH | Recursos Humanos |
| jefe.ti@cni.cl | Test123! | JEFE | Tecnologia e Innovacion |
| ana.dev@cni.cl | Test123! | EMPLEADO | Tecnologia e Innovacion |
| luis.ops@cni.cl | Test123! | EMPLEADO | Operaciones |

---

## Scripts Disponibles

| Comando | Descripcion |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de produccion |
| `pnpm start` | Iniciar produccion |
| `pnpm lint` | Ejecutar ESLint |
| `pnpm test` | Tests unitarios (watch) |
| `pnpm test:run` | Tests unitarios (single run) |
| `pnpm test:coverage` | Tests con cobertura |
| `pnpm test:integration` | Tests de integracion |
| `pnpm test:all` | Todos los tests |
| `pnpm db:push` | Push schema a BD |
| `pnpm db:generate` | Generar migraciones |
| `pnpm db:studio` | Abrir Drizzle Studio |
| `pnpm db:seed` | Seed de datos iniciales |
| `pnpm db:install` | Instalacion automatica BD |

---

## Seguridad

- Contrasenas hasheadas con **bcrypt** (10 salt rounds)
- Autenticacion via **JWT** (NextAuth.js) con cookies HttpOnly
- **RBAC** con permisos granulares verificados en cada API route
- **Whitelist de campos** en endpoints PATCH (prevencion de mass assignment)
- **Optimistic locking** con campo `version` en solicitudes y balances
- **Middleware** que protege todas las rutas de la aplicacion
- Queries parametrizados via **Drizzle ORM** (prevencion SQL injection)
- **inArray()** de Drizzle en lugar de SQL raw para consultas IN
- Flags de usuario (`esAdmin`, `esRrhh`, `esJefe`) siempre leidos desde BD, no del token JWT

---

## Licencia

Propiedad del Consejo Nacional de Inversiones (CNI) - Honduras, 2026

**Version**: 1.0.0  
**Ultima actualizacion**: Febrero 2026
